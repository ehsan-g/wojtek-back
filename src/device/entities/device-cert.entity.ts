import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { DeviceEntity } from './device.entity';

@Entity({ name: 'device_certs' })
export class DeviceCertEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    serialNumber: string;

    @Column({ type: 'text', nullable: true })
    subject: string;

    @Column({ type: 'timestamp with time zone', nullable: true })
    validFrom: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    validTo: Date;

    @ManyToOne(() => DeviceEntity, (device) => device.certs, { onDelete: 'CASCADE' })
    device: DeviceEntity;

    @CreateDateColumn()
    createdAt: Date;
}
