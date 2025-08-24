import { Module } from '@nestjs/common';
import { Service } from './.service';
import { Controller } from './.controller';
import { DeviceModule } from './device/device.module';

@Module({
  controllers: [Controller],
  providers: [Service],
  imports: [DeviceModule],
})
export class Module {}
