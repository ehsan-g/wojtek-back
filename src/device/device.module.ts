import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DeviceService } from "./device.service";
import { DeviceController } from "./device.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DeviceEntity } from "./entities/device.entity";
import { ServeStaticModule } from "@nestjs/serve-static";
import * as path from "path";
import { ReportEntity } from "../reports/entities/report.entity";
import { UserEntity } from "../users/user.entity";
import { SharedModule } from "../shared/shared.module";
import { DeviceCertEntity } from "./entities/device-cert.entity";
import { ClientCertMiddleware } from "../common/middleware/client-cert.middleware";
import { DeviceNonceEntity } from "./entities/device-nonce.entity";
import { EnrollController } from "./enroll.controller";
import { EnrollService } from "./enroll.service";
import { DeviceNonceService } from "./device-nonce.service";
import { DeviceAuthService } from "../auth/services/device-auth.service";
import { TokenService } from "../auth/services/token.service";
import { DeviceTelemetryController } from "./device-telemetry.controller";
import { DeviceEntity2 } from "./entities/device.entity2";

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([
      DeviceEntity,
      DeviceEntity2,
      DeviceNonceEntity,
      DeviceCertEntity,
      UserEntity,
      ReportEntity,
    ]),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
      serveRoot: process.env.UPLOAD_SERVE_ROOT || "/uploads/devices",
    }),
  ],
  controllers: [DeviceController, EnrollController, DeviceTelemetryController],
  providers: [
    DeviceService,
    DeviceAuthService,
    EnrollService,
    DeviceNonceService,
    TokenService,
  ],
  exports: [DeviceService],
})
export class DeviceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClientCertMiddleware) // order matters
      .forRoutes(DeviceController); // only for device endpoints
  }
}
