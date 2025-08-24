import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  IsBoolean,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(128)
  firstName: string;

  @IsString()
  @MaxLength(128)
  lastName: string;

  @IsString()
  @MaxLength(128)
  username: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roles?: string[] = ['user'];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
