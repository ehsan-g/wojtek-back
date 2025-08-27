import { Injectable, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as forge from 'node-forge';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createVerify } from 'crypto';

const execFileAsync = promisify(execFile);

@Injectable()
export class EnrollService {
    constructor(private readonly ds: DataSource) { }

    async createNonce(deviceId: string) {
        const nonce = randomUUID();
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        await this.ds.query(`INSERT INTO device_nonces (nonce, device_id, expires_at, used) VALUES ($1,$2,$3,false)`, [nonce, deviceId, expiresAt.toISOString()]);
        return nonce;
    }

    async verifyAndIssue(deviceId: string, csrPem: string, nonce: string, signatureB64: string) {
        const rows = await this.ds.query(`SELECT * FROM device_nonces WHERE nonce = $1`, [nonce]);
        if (!rows || rows.length === 0) throw new BadRequestException('invalid nonce');
        const row = rows[0];
        if (row.device_id !== deviceId) throw new BadRequestException('nonce device mismatch');
        if (row.used) throw new BadRequestException('nonce already used');
        if (new Date(row.expires_at) < new Date()) throw new BadRequestException('nonce expired');

        let csr;
        try {
            csr = forge.pki.certificationRequestFromPem(csrPem);
        } catch (e) {
            throw new BadRequestException('invalid CSR');
        }
        if (!csr.verify()) throw new BadRequestException('CSR signature invalid');

        const pubPem = forge.pki.publicKeyToPem(csr.publicKey);

        const verifier = createVerify('sha256');
        verifier.update(nonce);
        verifier.end();
        const sigOk = verifier.verify(pubPem, signatureB64, 'base64');
        if (!sigOk) throw new ForbiddenException('signature verification failed');

        await this.ds.query(`UPDATE device_nonces SET used = true WHERE nonce = $1`, [nonce]);

        const signerResult = await this.signCsrWithCa(csrPem);
        const { certPem, serialNumber, notBefore, notAfter } = signerResult;

        await this.ds.query(
            `INSERT INTO device_certs (serial_number, subject, valid_from, valid_to, device_id) VALUES ($1,$2,$3,$4,$5)`,
            [serialNumber, JSON.stringify(csr.subject.attributes || {}), notBefore.toISOString(), notAfter.toISOString(), deviceId]
        );

        return certPem;
    }

    private async signCsrWithCa(csrPem: string) {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-'));
        try {
            const csrPath = path.join(tmp, 'req.csr');
            const outCert = path.join(tmp, 'device.crt');
            const extFile = path.join(tmp, 'ext.cnf');
            const caCertPath = process.env.CA_CERT_PATH || '/ca/intermediate.crt';
            const caKeyPath = process.env.CA_KEY_PATH || '/ca/intermediate.key';
            if (!caCertPath || !caKeyPath) throw new Error('CA paths not configured');

            await fs.writeFile(csrPath, csrPem, 'utf8');
            const extData = `extendedKeyUsage = clientAuth\nsubjectAltName=URI:urn:device:${Date.now()}`;
            await fs.writeFile(extFile, extData, 'utf8');

            await execFileAsync('openssl', ['x509', '-req', '-in', csrPath, '-CA', caCertPath, '-CAkey', caKeyPath, '-CAcreateserial', '-out', outCert, '-days', '365', '-sha256', '-extfile', extFile], { env: process.env });

            const certPem = await fs.readFile(outCert, 'utf8');
            const { stdout: serialOut } = await execFileAsync('openssl', ['x509', '-in', outCert, '-noout', '-serial'], {});
            const serialMatch = /serial=([0-9A-Fa-f]+)/.exec(serialOut);
            const serialNumber = serialMatch ? serialMatch[1] : (Date.now().toString(16));

            const { stdout: notBeforeOut } = await execFileAsync('openssl', ['x509', '-in', outCert, '-noout', '-startdate'], {});
            const { stdout: notAfterOut } = await execFileAsync('openssl', ['x509', '-in', outCert, '-noout', '-enddate'], {});
            const nb = /notBefore=(.+)/.exec(notBeforeOut)?.[1];
            const na = /notAfter=(.+)/.exec(notAfterOut)?.[1];
            const notBefore = nb ? new Date(nb) : new Date();
            const notAfter = na ? new Date(na) : new Date(Date.now() + 365 * 24 * 3600 * 1000);

            return { certPem, serialNumber, notBefore, notAfter };
        } finally {
            try { await fs.rm(tmp, { recursive: true, force: true }); } catch (e) { }
        }
    }
}
