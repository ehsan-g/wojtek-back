import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UserEntity } from './users/user.entity';
import { ReportsModule } from './reports/reports.module';
import { DeviceModule } from './device/device.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',   // hardcode for now
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const dbUrl = cfg.get<string>('DATABASE_URL');
        console.log('DATABASE_URL:', dbUrl); // log to check the value
        // test-env.js
        console.log('DATABASE_URL:', process.env.DATABASE_URL);

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: true,
          logging: true,
          timezone: 'Asia/Tehran',
        };
      },

    }),

    AuthModule,
    UsersModule,
    ReportsModule,
    DeviceModule,
    JwtModule
  ],
  providers: [AuthService, JwtStrategy, JwtService],
  exports: [AuthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}