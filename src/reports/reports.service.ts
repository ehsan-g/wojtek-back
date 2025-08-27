import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import * as MelipayamakApi from "melipayamak";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateReportDto } from "./dto/create-report.dto";
import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as sharp from "sharp";
import { ReportEntity } from "./entities/report.entity";
import { DeviceEntity } from "../device/entities/device.entity";
import { DeviceEntity2 } from "../device/entities/device.entity2";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private uploadDir: string;
  private serveRoot: string;

  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    @InjectRepository(DeviceEntity2)
    private readonly deviceRepository2: Repository<DeviceEntity2>
  ) {
    this.uploadDir = process.env.UPLOAD_DIR || "uploads";
    this.serveRoot = process.env.UPLOAD_SERVE_ROOT || "/uploads";
    // ensure upload dir exists
    fs.mkdir(this.uploadDir, { recursive: true }).catch((err) => {
      console.error("Failed to create upload dir", err);
    });
  }

  smsApi = new MelipayamakApi(process.env.SMS_USER, process.env.SMS_PASSWORD);
  smsRest = this.smsApi.sms();

  private makeFilename(original: string) {
    const safe = original.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const stamp = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    return `${stamp}-${rnd}-${safe}`;
  }

  async create(
    file: Express.Multer.File,
    dto: CreateReportDto,
    ownerId?: string
  ) {
    if (!file) throw new BadRequestException("No file provided");

    const filename = this.makeFilename(file.originalname);
    const diskPath = path.join(this.uploadDir, filename);

    // Write file buffer to disk
    await fs.writeFile(diskPath, file.buffer);

    // Generate thumbnail (store bytes in DB)
    const thumbBuffer = await sharp(file.buffer)
      .resize({ width: Number(process.env.THUMBNAIL_WIDTH || 400) })
      .jpeg({ quality: Number(process.env.THUMBNAIL_QUALITY || 80) })
      .toBuffer();

    const url = `${this.serveRoot}/${encodeURIComponent(filename)}`;

    const report = this.reportRepository.create({
      filename: file.originalname,
      mimetype: file.mimetype,
      url,
      thumbnail: thumbBuffer,
      size: file.size,
      title: dto.title,
      description: dto.description,
      ownerId,
    });

    return this.reportRepository.save(report);
  }

  async findAll() {
    return this.reportRepository.find({
      select: [
        "id",
        "filename",
        "mimetype",
        "url",
        "size",
        "createdAt",
        "title",
        "description",
        "ownerId",
      ],
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: string) {
    const p = await this.reportRepository.findOne({ where: { id } });
    if (!p) throw new NotFoundException("ReportEntity not found");
    return p;
  }

  async remove(id: string, requesterId?: string) {
    const report = await this.findOne(id);
    if (report.ownerId && requesterId && report.ownerId !== requesterId) {
      throw new BadRequestException("Not authorized to delete this report");
    }

    // delete file from disk if it exists
    try {
      const filename = decodeURIComponent(report.url.split("/").pop() ?? "");
      const diskPath = path.join(this.uploadDir, filename);
      if (fsSync.existsSync(diskPath)) {
        await fs.unlink(diskPath);
      }
    } catch (e) {
      console.warn("Failed to delete file from disk", e);
    }

    await this.reportRepository.delete(id);
    return { deleted: true };
  }

  async createMotionReport(
    deviceId: string,
    ownerId: string
  ): Promise<ReportEntity> {
    const report = this.reportRepository.create({
      deviceId,
      ownerId,
    });
    await this.deviceRepository.update(deviceId, { updatedAt: new Date() });

    return await this.reportRepository.save(report);
  }

  async createMotionReport2(
    deviceId: string,
    ownerId: string
  ): Promise<ReportEntity> {
    const report = this.reportRepository.create({
      deviceId,
      ownerId,
    });
    await this.deviceRepository2.update(deviceId, { updatedAt: new Date() });

    return await this.reportRepository.save(report);
  }
  
  async findLast50ByOwner(ownerId: string): Promise<ReportEntity[]> {
    return this.reportRepository
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.theDevice", "device")
      .where("(report.ownerId = :ownerId)", { ownerId })
      .orderBy("report.createdAt", "DESC") // requires a createdAt column on ReportEntity
      .take(50)
      .getMany();
  }

  async sendSMS(to: string, from: string, text: string) {
    return await this.smsRest.send(to, from, text);
  }
}
