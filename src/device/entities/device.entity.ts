import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "../../users/user.entity";
import { ReportEntity } from "../../reports/entities/report.entity";
import { DeviceEnum } from "../../enum/device.enum";

@Entity("devices")
export class DeviceEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  type: DeviceEnum;

  @Column({ type: 'text' })
  secretHash: string; // bcrypt hash of the device secret

  @Column({ default: 0 })
  tokenVersion: number; // increment to revoke all previously issued tokens

  @Column({ default: false })
  revoked: boolean;


  @Column({ nullable: false })
  hashedSecret: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.devices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ownerId" })
  owner: UserEntity;

  @Index()
  @Column({ nullable: false })
  ownerId: string;

  @OneToMany(() => ReportEntity, (report) => report.theDevice, {
    cascade: true,
  })
  reports: ReportEntity[];

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description?: string;
}
