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

@Entity("devices")
export class DeviceEntity2 {
  @PrimaryGeneratedColumn("uuid")
  id: string;

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

  @Column({ nullable: true })
  @OneToMany(() => ReportEntity, (report) => report.theDevice, {
    cascade: true,
  })
  reports: ReportEntity[];

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description?: string;
}
