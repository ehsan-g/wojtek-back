// src/modules/auth/services/token.service.ts
import {
  Injectable,
  Inject,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { loadPrivateKeyFromEnv, loadPublicKeyFromEnv } from "../../config/keys";

export interface SignedToken {
  token: string;
  jti: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;
  private readonly privateKeyPem: string;
  private readonly publicKeyPem?: string;
  private readonly jwtKid?: string;
  private readonly jtiBlacklistPrefix = "jti:blacklist:";
  private readonly refreshKeyPrefix = "refresh:";

  constructor(
    private readonly config: ConfigService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis
  ) {
    this.accessTtlSec = Number(
      this.config.get<number>("JWT_ACCESS_TTL_SEC") ?? 600
    );
    this.refreshTtlSec = Number(
      this.config.get<number>("JWT_REFRESH_TTL_SEC") ?? 60 * 60 * 24 * 7
    );

    const pk = loadPrivateKeyFromEnv();
    if (!pk)
      throw new InternalServerErrorException(
        "JWT private key is not configured"
      );
    this.privateKeyPem = pk;

    this.publicKeyPem = loadPublicKeyFromEnv(); // optional, may be used for verification locally
    this.jwtKid = this.config.get<string>("JWT_KID");
  }

  private signJwt(
    payload: object,
    expiresInSec: number,
    opts: jwt.SignOptions = {}
  ): SignedToken {
    const jti = uuidv4();
    const signOpts: jwt.SignOptions = {
      algorithm: "RS256",
      expiresIn: expiresInSec,
      jwtid: jti,
      ...(this.jwtKid ? { keyid: this.jwtKid } : {}),
      ...opts,
    };
    const token = jwt.sign(payload, this.privateKeyPem, signOpts);
    return { token, jti, expiresIn: expiresInSec };
  }

  private async isJtiBlacklisted(jti: string): Promise<boolean> {
    if (!jti) return true;
    const v = await this.redis.get(`${this.jtiBlacklistPrefix}${jti}`);
    return v !== null;
  }

  private async blacklistJti(jti: string, ttlSec: number) {
    if (!jti) return;
    await this.redis.set(`${this.jtiBlacklistPrefix}${jti}`, "1", "EX", ttlSec);
  }

  async createAccessToken(payload: object): Promise<SignedToken> {
    return this.signJwt(payload, this.accessTtlSec);
  }

  async createRefreshToken(
    subjectId: string,
    meta: object = {}
  ): Promise<SignedToken> {
    const payload = { sub: subjectId, type: "refresh", meta };
    const signed = this.signJwt(payload, this.refreshTtlSec);
    const key = `${this.refreshKeyPrefix}${signed.jti}`;
    await this.redis.set(key, subjectId, "EX", this.refreshTtlSec);
    return signed;
  }

  async verifyAccessToken(token: string): Promise<jwt.JwtPayload> {
    try {
      const payload = jwt.verify(
        token,
        this.publicKeyPem ?? this.privateKeyPem,
        {
          algorithms: ["RS256"],
        }
      ) as jwt.JwtPayload;

      if (payload.jti && (await this.isJtiBlacklisted(payload.jti))) {
        throw new Error("token_revoked");
      }

      return payload;
    } catch (err) {
      throw err;
    }
  }

  async verifyAndConsumeRefreshToken(
    token: string
  ): Promise<{ payload: jwt.JwtPayload; jti: string }> {
    const decoded = jwt.verify(token, this.publicKeyPem ?? this.privateKeyPem, {
      algorithms: ["RS256"],
    }) as jwt.JwtPayload;

    const jti = decoded?.jti;
    if (!jti) throw new Error("missing_jti");

    if (await this.isJtiBlacklisted(jti)) throw new Error("token_revoked");

    const key = `${this.refreshKeyPrefix}${jti}`;
    const subject = await this.redis.get(key);
    if (!subject) throw new Error("refresh_token_invalid_or_consumed");

    await this.redis.del(key);

    const now = Math.floor(Date.now() / 1000);
    const exp = decoded.exp ?? now + this.refreshTtlSec;
    const remaining = Math.max(1, exp - now);
    await this.blacklistJti(jti, remaining);

    return { payload: decoded, jti };
  }

  async revokeJti(jti: string, ttlSeconds: number) {
    await this.blacklistJti(jti, ttlSeconds);
    await this.redis.del(`${this.refreshKeyPrefix}${jti}`);
  }

  decode(token: string): jwt.JwtPayload | null {
    return jwt.decode(token) as jwt.JwtPayload | null;
  }
}
