import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeviceEntity } from "./entities/device.entity";
import { DataSource, Repository } from "typeorm";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UserEntity } from "../users/user.entity";
import { randomUUID, createVerify } from "crypto";
import { DeviceCertEntity } from "./entities/device-cert.entity";
import * as forge from "node-forge";
import { DeviceNonceEntity } from "./entities/device-nonce.entity";
import { promisify } from "util";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { DeviceEntity2 } from "./entities/device.entity2";

const execFileAsync = promisify(execFile);

@Injectable()
export class DeviceService {
  private bcryptRounds: number;

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    @InjectRepository(DeviceEntity2)
    private readonly deviceRepository2: Repository<DeviceEntity2>,
    @InjectRepository(DeviceCertEntity)
    private readonly certRepository: Repository<DeviceCertEntity>,
    @InjectRepository(DeviceNonceEntity)
    private readonly nonceRepository: Repository<DeviceNonceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>
  ) {}
  async findOne(id: string) {
    return this.deviceRepository.findOne({ where: { id } });
  }

  async findByCertSerial(serial: string) {
    return this.certRepository.findOne({
      where: { serialNumber: serial },
      relations: ["device"],
    });
  }

  async isCertRegisteredForDevice(deviceId: string, serial: string) {
    const c = await this.certRepository.findOne({
      where: { serialNumber: serial, device: { id: deviceId } },
    });
    return !!c;
  }

  async touchDevice(id: string) {
    await this.deviceRepository.update({ id }, { updatedAt: new Date() });
  }

  async registerCert(
    deviceId: string,
    serial: string,
    subject: string,
    validFrom: Date,
    validTo: Date
  ) {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });
    if (!device) throw new Error("Device not found");
    const cert = this.certRepository.create({
      serialNumber: serial,
      subject,
      validFrom,
      validTo,
      device,
    });
    return this.certRepository.save(cert);
  }

  async findByOwner(ownerId: string): Promise<DeviceEntity[]> {
    return this.deviceRepository
      .createQueryBuilder("device")
      .leftJoinAndSelect("device.reports", "report")
      .where("device.ownerId = :ownerId", { ownerId })
      .loadRelationCountAndMap("device.reportCount", "device.reports")
      .getMany();
  }

  async findByOwner2(ownerId: string): Promise<DeviceEntity[]> {
    return this.deviceRepository2
      .createQueryBuilder("device")
      .leftJoinAndSelect("device.reports", "report")
      .where("device.ownerId = :ownerId", { ownerId })
      .loadRelationCountAndMap("device.reportCount", "device.reports")
      .getMany();
  }

  async createDevice(
    ownerId: string,
    dto: CreateDeviceDto
  ): Promise<DeviceEntity> {
    const user = this.userRepository.findOne({ where: { id: ownerId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const device = this.deviceRepository.create({
      ...dto,
      ownerId,
    });
    await this.userRepository.update(ownerId, { updatedAt: new Date() });
    return this.deviceRepository.save(device);
  }

  async delete(userId: string, id: string): Promise<void> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException("Device not found");
    }

    // adjust the field name to match your schema (e.g. ownerId / userId)
    if (String(device.ownerId) !== String(userId)) {
      throw new ForbiddenException(
        "You do not have permission to delete this device"
      );
    }

    await this.deviceRepository.remove(device);
  }

  async revokeDevice(deviceId: string) {
    const device = await this.findOne(deviceId);
    if (!device) return null;
    device.revoked = true;
    device.tokenVersion = (device.tokenVersion || 0) + 1;
    return this.deviceRepository.save(device);
  }

  async verifyAndIssue(
    deviceId: string,
    csrPem: string,
    nonce: string,
    signatureB64: string
  ) {
    // 1) validate nonce exists/unexpired/un-used and belongs to deviceId
    const rows = await this.ds.query(
      `SELECT * FROM device_nonces WHERE nonce = $1`,
      [nonce]
    );
    if (!rows || rows.length === 0)
      throw new BadRequestException("invalid nonce");
    const row = rows[0];
    if (row.device_id !== deviceId)
      throw new BadRequestException("nonce device mismatch");
    if (row.used) throw new BadRequestException("nonce already used");
    if (new Date(row.expires_at) < new Date())
      throw new BadRequestException("nonce expired");

    // 2) parse CSR, verify CSR signature
    let csr;
    try {
      csr = forge.pki.certificationRequestFromPem(csrPem);
    } catch (e) {
      throw new BadRequestException("invalid CSR");
    }
    if (!csr.verify()) throw new BadRequestException("CSR signature invalid");

    const pubPem = forge.pki.publicKeyToPem(csr.publicKey);

    // 3) verify signature over nonce with public key
    const verifier = createVerify("sha256");
    verifier.update(nonce);
    verifier.end();
    const sigOk = verifier.verify(pubPem, signatureB64, "base64");
    if (!sigOk) throw new ForbiddenException("signature verification failed");

    // 4) mark nonce used (atomic ideally)
    await this.ds.query(
      `UPDATE device_nonces SET used = true WHERE nonce = $1`,
      [nonce]
    );

    // 5) sign CSR with CA using openssl CLI (ensure CA files accessible)
    const signerResult = await this.signCsrWithCa(csrPem);
    const { certPem, serialNumber, notBefore, notAfter } = signerResult;

    // 6) store cert metadata
    await this.ds
      .query(
        `INSERT INTO device_certs (serial_number, subject, valid_from, valid_to, created_at, deviceId) VALUES ($1,$2,$3,$4,now(),$5)`,
        [
          serialNumber,
          JSON.stringify(csr.subject.attributes || {}),
          notBefore.toISOString(),
          notAfter.toISOString(),
          deviceId,
        ]
      )
      .catch((err) => {
        // try different insert shape depending on DB schema; the above is generic
        throw new InternalServerErrorException(
          "failed to store cert metadata: " + (err.message || err)
        );
      });

    return certPem;
  }

  // OPENSSL CLI SIGNER - simple implementation that uses mounted CA files
  private async signCsrWithCa(csrPem: string) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "csr-"));
    try {
      const csrPath = path.join(tmp, "req.csr");
      const outCert = path.join(tmp, "device.crt");
      const extFile = path.join(tmp, "ext.cnf");
      const caCertPath = process.env.CA_CERT_PATH || "/ca/intermediate.crt";
      const caKeyPath = process.env.CA_KEY_PATH || "/ca/intermediate.key";
      const caChainPath = process.env.CA_CHAIN_PATH || "/ca/chain.crt";
      if (!caCertPath || !caKeyPath) throw new Error("CA paths not configured");

      await fs.writeFile(csrPath, csrPem, "utf8");

      // ext file to request clientAuth EKU
      const extData = `extendedKeyUsage = clientAuth\nsubjectAltName=URI:urn:device:${Date.now()}`;
      await fs.writeFile(extFile, extData, "utf8");

      // Sign CSR
      // Use "openssl x509 -req -in req.csr -CA intermediate.crt -CAkey intermediate.key -CAcreateserial -out device.crt -days 365 -sha256 -extfile ext.cnf"
      const args = [
        "x509",
        "-req",
        "-in",
        csrPath,
        "-CA",
        caCertPath,
        "-CAkey",
        caKeyPath,
        "-CAcreateserial",
        "-out",
        outCert,
        "-days",
        "365",
        "-sha256",
        "-extfile",
        extFile,
      ];
      await execFileAsync("openssl", args, { env: process.env });

      const certPem = await fs.readFile(outCert, "utf8");

      // extract serial and validity
      const { stdout: serialOut } = await execFileAsync(
        "openssl",
        ["x509", "-in", outCert, "-noout", "-serial"],
        {}
      );
      const serialMatch = /serial=([0-9A-Fa-f]+)/.exec(serialOut);
      const serialNumber = serialMatch
        ? serialMatch[1]
        : Date.now().toString(16);

      const { stdout: notBeforeOut } = await execFileAsync(
        "openssl",
        ["x509", "-in", outCert, "-noout", "-startdate"],
        {}
      );
      const { stdout: notAfterOut } = await execFileAsync(
        "openssl",
        ["x509", "-in", outCert, "-noout", "-enddate"],
        {}
      );
      // parse lines like: notBefore=May 10 12:34:56 2025 GMT
      const nb = /notBefore=(.+)/.exec(notBeforeOut)?.[1];
      const na = /notAfter=(.+)/.exec(notAfterOut)?.[1];
      const notBefore = nb ? new Date(nb) : new Date();
      const notAfter = na
        ? new Date(na)
        : new Date(Date.now() + 365 * 24 * 3600 * 1000);

      return { certPem, serialNumber, notBefore, notAfter };
    } finally {
      // cleanup tmp
      try {
        await fs.rm(tmp, { recursive: true, force: true });
      } catch (e) {}
    }
  }
}
