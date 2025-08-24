import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { DeviceJwtStrategy } from './device-jwt.strategy';
import { DeviceAuthService } from './device-auth.service';
import { DeviceModule } from '../device/device.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    SharedModule,
    DeviceModule, // so DeviceJwtStrategy and DeviceAuthService can inject DeviceService
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, DeviceJwtStrategy, DeviceAuthService],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    DeviceAuthService,
  ],
})
export class AuthModule { }
