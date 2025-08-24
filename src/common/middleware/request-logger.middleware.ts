// common/middleware/request-logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private logger = new Logger('Request');

    use(req: Request, res: Response, next: NextFunction) {
        this.logger.warn(`➡️  ${req.method} ${req.originalUrl}`);
        next();
    }
}
