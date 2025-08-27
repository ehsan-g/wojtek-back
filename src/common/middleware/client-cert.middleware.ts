import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ClientCertMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction) {
        // Traefik headers (lowercased in Node)
        const serial = (req.headers['x-forwarded-tls-client-cert-serial'] || req.headers['x-forwarded-tls-client-cert-serialnumber'])?.toString();
        const subject = (req.headers['x-forwarded-tls-client-cert-subject'] || req.headers['x-forwarded-tls-client-cert-subjectdn'])?.toString();
        const sans = (req.headers['x-forwarded-tls-client-cert-sans'] || req.headers['x-forwarded-tls-client-cert-sanslist'])?.toString();
        const notBefore = (req.headers['x-forwarded-tls-client-cert-notbefore'])?.toString();
        const notAfter = (req.headers['x-forwarded-tls-client-cert-notafter'])?.toString();

        if (serial && subject) {
            (req as any).mtls = {
                serial,
                subject,
                sans,
                notBefore,
                notAfter,
            };
        }
        next();
    }
}
