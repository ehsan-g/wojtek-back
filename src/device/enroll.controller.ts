import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Param,
  ParseUUIDPipe,
  Get,
} from "@nestjs/common";
import { EnrollService } from "./enroll.service";
import { ApiTags } from "@nestjs/swagger";
import { ReportsService } from "../reports/reports.service";

@ApiTags("devices/enroll")
@Controller("device/enroll")
export class EnrollController {
  constructor(
    private readonly enrollService: EnrollService,
    private readonly reportService: ReportsService
  ) {}

  @Post("challenge")
  async challenge(@Body() body: { deviceId: string }) {
    if (!body?.deviceId) throw new BadRequestException("deviceId required");
    const nonce = await this.enrollService.createNonce(body.deviceId);
    return { nonce };
  }

  @Post("verify")
  async verify(
    @Body()
    body: {
      deviceId: string;
      csrPem: string;
      nonce: string;
      signatureB64: string;
    }
  ) {
    const certPem = await this.enrollService.verifyAndIssue(
      body.deviceId,
      body.csrPem,
      body.nonce,
      body.signatureB64
    );
    return { cert: certPem };
  }

  @Get("temp/:id")
  async temp(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.reportService.createMotionReport(
      id,
      "56f384ee-3715-45f2-b0e8-10320023935b"
    );
  }
}
