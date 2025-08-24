import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  // This returns the "user" that will be attached to req.user
  async validate(payload: any) {
    if (!payload || !payload.username) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findByUserName(payload.username);
    if (!user) {
      throw new UnauthorizedException();
    }

    // return a minimal principal (avoid returning DB password fields)
    return { id: user.id, username: user.username ?? user.email, roles: user.roles || [] };
  }
}
