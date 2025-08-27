// src/modules/auth/strategies/device-jwt.strategy.ts
import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy as JwtStrategyBase, ExtractJwt } from "passport-jwt";
import { TokenService } from "../services/token.service";
import { DeviceService } from "../../device/device.service";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import { loadPublicKeyFromEnv } from "../../config/keys";

@Injectable()
export class DeviceJwtStrategy extends PassportStrategy(
  JwtStrategyBase,
  "device-jwt"
) {
  constructor(
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly config: ConfigService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis
  ) {
    const publicKey = loadPublicKeyFromEnv();
    if (!publicKey)
      throw new Error("JWT public key not configured for device-jwt strategy");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: publicKey,
      algorithms: ["RS256"],
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    if (payload?.jti) {
      const v = await this.redis.get(`jti:blacklist:${payload.jti}`);
      if (v) throw new UnauthorizedException("token_revoked");
    }

    const device = await this.deviceService.findOne(payload.sub);
    if (!device) throw new UnauthorizedException("Unknown device");

    if (
      (device as any).tokenVersion !== undefined &&
      (device as any).tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException("stale token");
    }

    return {
      deviceId: payload.sub,
      aud: payload.aud,
      certSerial: payload.certSerial,
    };
  }
}
