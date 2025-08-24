import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../device/device.service';
import Redis from 'ioredis';

@Injectable()
export class DeviceJwtStrategy extends PassportStrategy(Strategy, 'device-jwt') {
    private redis: Redis;

    constructor(
        private config: ConfigService,
        private deviceService: DeviceService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get<string>('JWT_PUBLIC_KEY_B64'),
            algorithms: ['RS256'],
            ignoreExpiration: false,
        });

        this.redis = new Redis(config.get<string>('REDIS_URL'));
    }

    async validate(payload: any) {
        if (!payload || !payload.deviceId) throw new UnauthorizedException();
        // check jti blacklist
        // check jti blacklist via injected redis
        const jti = (payload as any).jti;
        if (jti) {
            const blacklisted = await this.redis.get(`app:jti:blacklist:${jti}`);
            if (blacklisted) throw new UnauthorizedException('Token revoked');
        }
        const device = await this.deviceService.findOne(payload.deviceId);
        if (!device) throw new UnauthorizedException();
        if (device.revoked) throw new UnauthorizedException('Device revoked');
        if ((payload.tokenVersion ?? 0) !== (device.tokenVersion ?? 0))
            throw new UnauthorizedException('Token version mismatch');
        return { deviceId: device.id, ownerId: device.ownerId, claims: payload };
    }
}
