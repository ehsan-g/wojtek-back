import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Res,
  Delete,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
  Req, Request,
  NotFoundException,
  ServiceUnavailableException,

} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { CreateReportDto, DeviceIssueDto } from "./dto/create-report.dto";
import { Response, } from "express";
import * as fs from "fs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/get-user.decorator";
import { ReportEntity } from "./entities/report.entity";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DeviceService } from "../device/device.service";
import { DeviceEnum } from "../enum/device.enum";
import { DeviceAuthService } from "../auth/services/device-auth.service";

@ApiBearerAuth('bearerAuth')
@ApiTags('reports')
@Controller("report")
@UsePipes(new ValidationPipe({ transform: true }))
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly deviceAuthService: DeviceAuthService,
    private readonly deviceService: DeviceService
  ) { }

  // Exchange device credentials for a JWT
  @Post('issue')
  async issue(@Body() dto: DeviceIssueDto) {
    if (!dto?.deviceId || !dto?.secret) throw new BadRequestException('deviceId and secret required');
    return this.deviceAuthService.generateDeviceToken(dto.deviceId, dto.secret);
  }

  @UseGuards(JwtAuthGuard)
  @Post("motion/:deviceId")
  @UsePipes(new ValidationPipe({ transform: true }))
  async createMotionReport(@Request() req, @Param("deviceId") deviceId: string): Promise<ReportEntity> {
    const userId = req.user.sub;
    const to = process.env.SMS_ADMIN;
    const from = process.env.SMS_FROM;
    try {
      const device = await this.deviceService.findOne(deviceId);
      if (device.type !== DeviceEnum.MOTION) {
        throw new BadRequestException("Incorrect Device")
      }
      if (device.ownerId !== userId) {
        throw new BadRequestException("Not your Device!")
      }
      await this.reportsService.sendSMS(from, to, deviceId);
      return this.reportsService.createMotionReport(deviceId, userId);
    } catch (err) {
      throw new ServiceUnavailableException(err);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("last")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getLastReports(@Request() req): Promise<ReportEntity[]> {
    const userId = req.user.sub;
    return this.reportsService.findLast50ByOwner(userId);
  }

  // Upload — authenticated
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("report", {
      storage: diskStorage({
        destination: (req, file, cb) =>
          cb(null, process.env.UPLOAD_DIR || "uploads"),
        filename: (req, file, cb) => {
          // keep original name? we'll let service create safe name, but Multer requires a filename
          cb(
            null,
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname
            }`
          );
        },
      }),
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024),
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype || !file.mimetype.startsWith("image/")) {
          cb(
            new BadRequestException("Only image files are allowed") as any,
            false
          );
        } else cb(null, true);
      },
    })
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateReportDto,
    @GetUser() user: any
  ) {
    // Multer with diskStorage saves file to disk and sets file.path
    // But service expects file.buffer; to reuse thumbnail creation we can read the file back into buffer
    if (!file) throw new BadRequestException("No file uploaded");

    // read into buffer
    const buffer = await fs.promises.readFile(file.path);
    // adapt to Express.Multer.File shape expected by service
    const mul = { ...file, buffer } as Express.Multer.File;

    const saved = await this.reportsService.create(mul, dto, user?.id);
    // return metadata including URL
    const { thumbnail, ...meta } = saved as any;
    return meta;
  }

  @Get()
  async fetchAll() {
    return this.reportsService.findAll();
  }

  @Get(":id")
  async getMeta(@Param("id", ParseUUIDPipe) id: string) {
    const p = await this.reportsService.findOne(id);
    const { thumbnail, ...meta } = p as any;
    return meta;
  }

  // Return small thumbnail quickly (served from DB)
  @Get(":id/thumbnail")
  async thumbnail(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response
  ) {
    const p = await this.reportsService.findOne(id);
    if (!p.thumbnail) throw new NotFoundException("Thumbnail not available");
    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": String(p.thumbnail.length),
    });
    return res.send(p.thumbnail);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id", ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.reportsService.remove(id, user?.id);
  }
}
