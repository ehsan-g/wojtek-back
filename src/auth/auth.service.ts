import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {
    console.log('validating...');

    // ✅ explicitly select password
    const user = await this.usersService.findOneWithPassword(username);
    if (!user) {
      return null;
    }
    // ✅ check password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }
    // ✅ remove password before returning
    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }


  async register(dto: RegisterDto) {
    const { firstName, lastName, email, password } = dto;

    // check existing user
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // hash password
    let hashed: string;
    try {
      hashed = await bcrypt.hash(password, Number(process.env.SALT));
    } catch (err) {
      throw new InternalServerErrorException('Failed to hash password');
    }
    // create user (expects UsersService.create to return the created user object)
    const userPayload = { firstName, lastName, username: email, email, password: hashed };
    const user = await this.usersService.create(userPayload);

    // sign JWT
    const payload = { username: user.email, sub: user.id };
    const token = await this.jwtService.signAsync(payload);

    // sanitize user output (remove sensitive fields)
    const { password: _p, ...safeUser } = user as any;

    return { user: safeUser, token };
  }
}

