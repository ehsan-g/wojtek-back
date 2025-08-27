import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { DeviceJwtAuthGuard } from "../auth/guards/device-jwt.guard";

@Controller("devices/telemetry")
export class DeviceTelemetryController {
  @Post()
  @UseGuards(DeviceJwtAuthGuard)
  async receiveTelemetry(@Request() req, @Body() body: any) {
    const deviceId = req.user.sub; // from JWT "sub"
    const { event } = body;

    // TODO: Save event to DB, Redis, Kafka, etc.
    console.log(`Telemetry from device ${deviceId}:`, event);

    return { status: "ok", deviceId, event };
  }
}
