import { Strategy, ExtractJwt } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>("JWT_SECRET"),
      algorithms: ["HS256"],
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    console.log("JWT Payload:", payload);
    const user = await this.usersService.findByUserName(payload.username);
    console.log("User found:", user);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, username: user.username, roles: user.roles || [] };
  }
}
