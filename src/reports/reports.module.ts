import { forwardRef, Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { DeviceEntity } from '../device/entities/device.entity';
import { ReportEntity } from './entities/report.entity';
import { DeviceService } from '../device/device.service';
import { UserEntity } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity, UserEntity, DeviceEntity]),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
      serveRoot: process.env.UPLOAD_SERVE_ROOT || '/uploads/reports',
    }),
    forwardRef(() => AuthModule), // use forwardRef if AuthModule imports DeviceModule (circular)
  ],
  controllers: [ReportsController],
  providers: [ReportsService, DeviceService],
  exports: [ReportsService],
})
export class ReportsModule { }
