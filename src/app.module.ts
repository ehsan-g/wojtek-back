import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { UserEntity } from "./users/user.entity";
import { ReportsModule } from "./reports/reports.module";
import { DeviceModule } from "./device/device.module";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";
import { AuthService } from "./auth/auth.service";
import { JwtStrategy } from "./auth/strategies/jwt.strategy";
import { JwtModule, JwtService } from "@nestjs/jwt";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ".env", // hardcode for now
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const user = cfg.get<string>("POSTGRES_USER");
        const pass = cfg.get<string>("POSTGRES_PASSWORD");
        const host = cfg.get<string>("DB_HOST") || "localhost";
        const dbName = cfg.get<string>("POSTGRES_DB");
        const port = cfg.get<number>("DB_PORT") || 5432;

        const dbUrl1 = process.env.DATABASE_URL;
        const dbUrl2 = `postgres://${user}:${pass}@${host}:${port}/${dbName}`;

        console.log("DATABASE_URL:", dbUrl1);
        console.log("DATABASE_URL:", dbUrl2);

        return {
          type: "postgres",
          url: dbUrl2,
          autoLoadEntities: true,
          synchronize: true,
          logging: true,
          timezone: "Asia/Tehran",
        };
      },
    }),

    AuthModule,
    UsersModule,
    ReportsModule,
    DeviceModule,
    JwtModule,
  ],
  providers: [AuthService, JwtStrategy, JwtService],
  exports: [AuthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
