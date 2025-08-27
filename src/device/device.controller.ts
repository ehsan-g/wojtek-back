import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import { DeviceService } from "./device.service";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DeviceAuthService } from "../auth/services/device-auth.service";
import { DeviceCertGuard } from "../auth/guards/device-cert.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiBearerAuth("bearerAuth")
@ApiTags("devices")
@Controller("device")
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly deviceAuth: DeviceAuthService
  ) {}

  @Get("ping")
  @UseGuards(DeviceCertGuard)
  ping(@Request() req: any) {
    return { ok: true, deviceId: req.device.id, serial: req.mtls.serial };
  }
  @Post('token')
  @UseGuards(DeviceCertGuard)
  async token(@Request() req: any) {
    // DeviceCertGuard sets req.device and req.mtls.serial
    const deviceId = req.device.id;
    const certSerial = req.mtls.serial;
    return this.deviceAuth.generateDeviceTokenFromMtls(deviceId, certSerial);
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  findMyDevices(@Request() req) {
    const userId = req.user.sub;
    return this.deviceService.findByOwner(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createDevice(@Request() req, @Body() dto: CreateDeviceDto) {
    // 1- first device is created by user
    // 2- deviceId is used to call challenge api to create nonce and start auth
    // 3- ... refer to readMe.md
    const userId = req.user.sub;
    return await this.deviceService.createDevice(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async deleteDevice(
    @Request() req,
    @Param("id", new ParseUUIDPipe()) id: string
  ): Promise<void> {
    const userId = req.user.sub;
    await this.deviceService.delete(userId, id);
  }
}
