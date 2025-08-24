import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}


export class DeviceIssueDto {
  deviceId: string;
  secret: string;
}
