import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeviceEntity } from '../../device/entities/device.entity';

@Entity('reports')
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  filename?: string;

  @Column({ nullable: true })
  mimetype?: string;

  @Column({ nullable: true })
  url?: string;

  @Column('bytea', { nullable: true })
  thumbnail?: Buffer;

  @Column('int', { nullable: true })
  size?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => DeviceEntity, (device) => device.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  theDevice: DeviceEntity;

  @Column()
  deviceId: string;

  @Index()
  @Column({ nullable: true })
  ownerId?: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  description?: string;
}
