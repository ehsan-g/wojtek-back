import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { ReportEntity } from '../reports/entities/report.entity';
import { UserEntity } from '../users/user.entity';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([DeviceEntity, UserEntity, ReportEntity]),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
      serveRoot: process.env.UPLOAD_SERVE_ROOT || '/uploads/devices',
    }),
  ],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],

})
export class DeviceModule { }
