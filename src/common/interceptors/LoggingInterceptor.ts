import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const { method, url, body, user } = req;

        const userInfo = user ? `User: ${user.id}` : 'Unauthenticated';

        const now = Date.now();
        this.logger.log(
            `➡️  ${method} ${url} | ${userInfo} | Body: ${JSON.stringify(body)}`,
        );

        return next.handle().pipe(
            tap((data) =>
                this.logger.log(
                    `⬅️  ${method} ${url} | ${userInfo} | ${Date.now() - now}ms | Response: ${JSON.stringify(
                        data,
                    )}`,
                ),
            ),
        );
    }
}
