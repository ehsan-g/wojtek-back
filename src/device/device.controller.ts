import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UsePipes, ValidationPipe, Request, ParseUUIDPipe } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { DeviceJwtAuthGuard } from '../auth/device-jwt.guard';

@ApiBearerAuth('bearerAuth')
@ApiTags('devices')
@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) { }

  // Device-level route: device sends telemetry using device token
  @Post('telemetry')
  @UseGuards(DeviceJwtAuthGuard)
  async telemetry(@Request() req, @Body() body: any) {
    const device = req.user; // { deviceId, ownerId, claims }
    // handle telemetry body...
    return { ok: true, receivedFrom: device.deviceId };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMyDevices(@Request() req) {
    const userId = req.user.sub;
    return this.deviceService.findByOwner(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createDevice(@Request() req, @Body() dto: CreateDeviceDto) {
    const userId = req.user.sub;
    return await this.deviceService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteDevice(
    @Request() req,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const userId = req.user.sub;
    await this.deviceService.delete(userId, id);
  }
}
