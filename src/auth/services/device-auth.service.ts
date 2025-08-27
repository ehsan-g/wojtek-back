import { Injectable, UnauthorizedException, InternalServerErrorException, Inject } from '@nestjs/common';
import { DeviceService } from '../../device/device.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';
import { TokenService } from './token.service';

@Injectable()
export class DeviceAuthService {
    private readonly expiresIn: string;
    private readonly jwtKid?: string;

    constructor(
        private readonly deviceService: DeviceService,
        private readonly config: ConfigService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        private readonly tokenService: TokenService,
    ) {
        if (!this.redis) throw new InternalServerErrorException('Redis client not injected');
        this.expiresIn = this.config.get<string>('DEVICE_JWT_EXPIRES_IN', '600');
        this.jwtKid = this.config.get<string>('JWT_KID');
    }

    async revokeJti(jti: string, ttlSeconds: number) {
        await this.tokenService.revokeJti(jti, ttlSeconds);
    }

    async isJtiRevoked(jti: string) {
        return this.redis.get(`jti:blacklist:${jti}`) !== null;
    }

    async generateDeviceToken(deviceId: string, presentedSecret?: string) {
        const device = await this.deviceService.findOne(deviceId);
        if (!device) throw new UnauthorizedException('Invalid credentials');
        if ((device as any).revoked) throw new UnauthorizedException('Device revoked');

        if (presentedSecret && typeof (this.deviceService as any).verifySecret === 'function') {
            const ok = await (this.deviceService as any).verifySecret(deviceId, presentedSecret);
            if (!ok) throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: device.id, aud: 'devices', iss: this.config.get('APP_ISSUER') || 'app', tokenVersion: (device as any).tokenVersion ?? 0 };
        const signed = await this.tokenService.createAccessToken(payload);
        return { token: signed.token, expiresIn: signed.expiresIn, jti: signed.jti };
    }

    async generateDeviceTokenFromMtls(deviceId: string, certSerial: string) {
        const device = await this.deviceService.findOne(deviceId);
        if (!device) throw new UnauthorizedException('Unknown device');
        if ((device as any).revoked) throw new UnauthorizedException('Device revoked');
        if (typeof (this.deviceService as any).isCertRegisteredForDevice === 'function') {
            const ok = await (this.deviceService as any).isCertRegisteredForDevice(deviceId, certSerial);
            if (!ok) throw new UnauthorizedException('Client certificate not registered for device');
        }
        const payload = { sub: device.id, aud: 'devices', iss: this.config.get('APP_ISSUER') || 'app', tokenVersion: (device as any).tokenVersion ?? 0, certSerial };
        const signed = await this.tokenService.createAccessToken(payload);
        return { token: signed.token, expiresIn: signed.expiresIn, jti: signed.jti };
    }

    async revokeDevice(deviceId: string) {
        await this.deviceService.revokeDevice(deviceId);
    }
}
