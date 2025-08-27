import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { DeviceService } from '../../device/device.service';

@Injectable()
export class DeviceCertGuard implements CanActivate {
    constructor(private readonly deviceService: DeviceService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<any>();
        const mtls = req.mtls;
        if (!mtls?.serial) throw new UnauthorizedException('Client certificate required');

        const found = await this.deviceService.findByCertSerial(mtls.serial);
        if (!found) throw new UnauthorizedException('Certificate not registered');

        if (!found.device || found.device.status !== 'active') throw new ForbiddenException('Device not active');

        // optional: validate notBefore/notAfter headers vs DB/stored cert validity
        req.device = found.device;
        await this.deviceService.touchDevice(found.device.id);
        return true;
    }
}
