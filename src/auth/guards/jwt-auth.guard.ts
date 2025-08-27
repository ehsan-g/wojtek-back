// src/auth/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard for user authentication.
 * Extends passport-jwt guard and ensures missing/invalid tokens become Unauthorized responses.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    // Optional: customize the default behavior so we consistently throw UnauthorizedException
    // when authentication fails (instead of letting passport or framework return undefined).
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        if (err) {
            // propagate internal errors (e.g. strategy throwing)
            throw err;
        }
        if (!user) {
            // ensures controllers protected by this guard always return 401 on failure
            throw new UnauthorizedException();
        }
        return user;
    }
}
