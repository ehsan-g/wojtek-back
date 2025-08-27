import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DeviceNonceEntity } from './entities/device-nonce.entity';

@Injectable()
export class DeviceNonceService {
  constructor(@InjectRepository(DeviceNonceEntity) private repo: Repository<DeviceNonceEntity>) {}

  async create(deviceId: string) {
    const nonce = randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const ent = this.repo.create({ nonce, deviceId, expiresAt, used: false });
    await this.repo.save(ent);
    return nonce;
  }
}
