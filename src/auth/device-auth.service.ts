import { Injectable, UnauthorizedException, InternalServerErrorException, Inject } from '@nestjs/common';
import { DeviceService } from '../device/device.service';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

@Injectable()
export class DeviceAuthService {
    private privateKey: string;
    private expiresIn: string;

    constructor(
        private deviceService: DeviceService,
        private config: ConfigService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) {
        this.privateKey = this.config.get<string>('JWT_PRIVATE_KEY_B64');
        if (!this.privateKey) throw new InternalServerErrorException('JWT private key not configured');
        this.expiresIn = this.config.get<string>('DEVICE_JWT_EXPIRES_IN', '1h');

        this.redis = new Redis(this.config.get<string>('REDIS_URL'));
    }

    async revokeJti(jti: string, ttlSeconds: number) {
        // set key with EX TTL
        await this.redis.set(`app:jti:blacklist:${jti}`, '1', 'EX', ttlSeconds);
    }

    async isJtiRevoked(jti: string) {
        const v = await this.redis.get(`app:jti:blacklist:${jti}`);
        return v !== null;
    }

    // Exchange deviceId + secret for a short-lived RS256 JWT
    async generateDeviceToken(deviceId: string, presentedSecret: string) {
        const device = await this.deviceService.findOne(deviceId);
        if (!device) throw new UnauthorizedException('Invalid credentials');

        if (device.revoked) throw new UnauthorizedException('Device revoked');

        const ok = await this.deviceService.verifySecret(deviceId, presentedSecret);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        const jti = uuidv4();
        const payload = {
            deviceId: device.id,
            aud: 'devices',
            iss: 'your-company-or-app',
            tokenVersion: device.tokenVersion ?? 0,
        };

        const token = sign(payload, this.privateKey, {
            algorithm: 'RS256',
            expiresIn: this.expiresIn,
            jwtid: jti,
        });

        // Optionally store active jti -> device mapping for auditing (not strictly required)
        // await this.redis.set(`device:jti:${jti}`, deviceId, 'EX', 60*60);

        return { token, expiresIn: this.expiresIn, jti };
    }

    // Revoke a specific jti immediately
    async revokeTokenJti(jti: string, ttlSeconds: number) {
        // store blacklisted jti until it naturally expires
        await this.redis.set(`jti:blacklist:${jti}`, '1', 'EX', ttlSeconds);
    }

    // full device revoke (revokes all previous tokens via tokenVersion and marks revoked)
    async revokeDevice(deviceId: string) {
        await this.deviceService.revokeDevice(deviceId);
    }
}
