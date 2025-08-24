import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { Repository } from 'typeorm';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UserEntity } from '../users/user.entity';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DeviceService {

  private bcryptRounds: number;

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) { }


  // Provision a device (called by admin/operator). Returns raw secret once.
  async provisionDevice(ownerId: string, deviceId?: string, name?: string) {
    const id = deviceId ?? `dev-${randomBytes(8).toString('hex')}`;
    const rawSecret = randomBytes(32).toString('hex'); // 64 hex chars ~ 32 bytes
    const secretHash = await bcrypt.hash(rawSecret, this.bcryptRounds);

    const device = this.deviceRepository.create({
      id,
      ownerId,
      name,
      secretHash,
      tokenVersion: 0,
      revoked: false,
    });

    await this.deviceRepository.save(device);

    // IMPORTANT: return rawSecret only once (caller must persist it securely to the device)
    return { deviceId: id, secret: rawSecret };
  }


  async incrementTokenVersion(deviceId: string) {
    const device = await this.findOne(deviceId);
    if (!device) return null;
    device.tokenVersion = (device.tokenVersion || 0) + 1;
    return this.deviceRepository.save(device);
  }

  async revokeDevice(deviceId: string) {
    const device = await this.findOne(deviceId);
    if (!device) return null;
    device.revoked = true;
    device.tokenVersion = (device.tokenVersion || 0) + 1;
    return this.deviceRepository.save(device);
  }

  // verify raw secret against hash
  async verifySecret(deviceId: string, presentedSecret: string) {
    const device = await this.findOne(deviceId);
    if (!device) return false;
    return bcrypt.compare(presentedSecret, device.secretHash);
  }

  async findOne(deviceId: string): Promise<DeviceEntity> {
    const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException("ReportEntity not found");
    return device;
  }

  async findByOwner(ownerId: string): Promise<DeviceEntity[]> {
    return this.deviceRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.reports', 'report')
      .where('device.ownerId = :ownerId', { ownerId })
      .loadRelationCountAndMap('device.reportCount', 'device.reports')
      .getMany();
  }

  async create(ownerId: string, dto: CreateDeviceDto): Promise<DeviceEntity> {
    const user = this.userRepository.findOne({ where: { id: ownerId } })
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const device = this.deviceRepository.create({
      ...dto,
      ownerId,
    });
    await this.userRepository.update(ownerId, { updatedAt: new Date() });
    return this.deviceRepository.save(device);
  }

  async delete(userId: string, id: string): Promise<void> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // adjust the field name to match your schema (e.g. ownerId / userId)
    if (String(device.ownerId) !== String(userId)) {
      throw new ForbiddenException('You do not have permission to delete this device');
    }

    await this.deviceRepository.remove(device);
  }

}
