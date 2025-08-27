import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiTags } from "@nestjs/swagger";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtService } from "@nestjs/jwt";
import { DeviceCertGuard } from "./guards/device-cert.guard";
import { DeviceAuthService } from "./services/device-auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly deviceAuth: DeviceAuthService
  ) {}

  @Post("device/token") // also mapped at /device/token in device.controller
  @UseGuards(DeviceCertGuard)
  async deviceToken(@Request() req: any) {
    return this.deviceAuth.generateDeviceTokenFromMtls(
      req.device.id,
      req.mtls.serial
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@Request() req) {
    return req.user; // assuming Passport puts the user on the request
  }

  @UseGuards(LocalAuthGuard)
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("profile")
  async getProfile(@Request() req) {
    // This route is protected by JWT
    return req.user;
  }

  @Post("register")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
