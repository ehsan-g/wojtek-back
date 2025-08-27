import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { UsersModule } from "../users/users.module";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { AuthController } from "./auth.controller";
import { DeviceJwtStrategy } from "./strategies/device-jwt.strategy";
import { DeviceAuthService } from "./services/device-auth.service";
import { DeviceModule } from "../device/device.module";
import { SharedModule } from "../shared/shared.module";
import { DeviceCertGuard } from "./guards/device-cert.guard";
import { TokenService } from "./services/token.service";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    SharedModule,
    DeviceModule, // so DeviceJwtStrategy and DeviceAuthService can inject DeviceService
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "1h" },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    DeviceJwtStrategy,
    DeviceCertGuard,
    DeviceAuthService,
    TokenService,
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenService, DeviceCertGuard, DeviceAuthService],
})
export class AuthModule {}
