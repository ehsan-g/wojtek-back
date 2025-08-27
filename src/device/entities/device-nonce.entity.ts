import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'device_nonces' })
export class DeviceNonceEntity {
    @PrimaryColumn({ type: 'uuid' })
    nonce: string;

    @Column()
    deviceId: string;

    @Column({ type: 'timestamp with time zone' })
    expiresAt: Date;

    @Column({ default: false })
    used: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
