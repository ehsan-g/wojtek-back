import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { EnrollService } from "./enroll.service";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("devices/enroll")
@Controller("device/enroll")
export class EnrollController {
  constructor(private readonly enrollService: EnrollService) {}

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

  @Get("temp")
  async temp() {
    const certPem = await this.enrollService.verifyAndIssue(
      body.deviceId,
      body.csrPem,
      body.nonce,
      body.signatureB64
    );
    return { cert: certPem };
  }
}
