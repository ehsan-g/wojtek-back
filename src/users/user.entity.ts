import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';
import { RoleEnum } from '../enum/user.enum';
import { DeviceEntity } from '../device/entities/device.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 254 })
  username: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 254 })
  email: string;

  @Column({ select: false, type: 'varchar', length: 255 })
  password: string;

  @Column({ nullable: true, length: 128 })
  firstName?: string | null;


  @Column({ nullable: true, length: 128 })
  lastName?: string | null;

  @Column({
    type: 'enum',
    enum: RoleEnum,
    array: true,
    default: [RoleEnum.USER],
  })
  roles: RoleEnum[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => DeviceEntity, (device) => device.owner, { cascade: true })
  devices: DeviceEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    if (!this.roles || this.roles.length === 0) {
      this.roles = [RoleEnum.USER];
    }
  }
}
