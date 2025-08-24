// dto/create-device.dto.ts
import { IsString, IsOptional, Length, IsNumber } from 'class-validator';
import { DeviceEnum } from '../../enum/device.enum';

export class CreateDeviceDto {
  @IsNumber()
  type: DeviceEnum;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
