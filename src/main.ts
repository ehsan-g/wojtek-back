// src/main.ts
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { LoggingInterceptor } from "./common/interceptors/LoggingInterceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug"], // include debug
  });
  const configService = app.get(ConfigService);

  // Parse and normalize FRONTEND_ORIGINS (trim, drop surrounding quotes)
  const rawOrigins =
    configService.get<string>("FRONTEND_ORIGINS") ||
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:3000";
  const FRONTEND_ORIGINS = rawOrigins
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  // Trust proxy (useful when behind Traefik / Cloudflare)
  try {
    const expressInstance: any = app.getHttpAdapter().getInstance();
    if (expressInstance && typeof expressInstance.set === "function") {
      expressInstance.set("trust proxy", true);
    }
  } catch (e) {
    // noop
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields
      forbidNonWhitelisted: true, // throws if extra fields provided
      transform: true, // auto-transform payloads to DTO instances
    })
  );

  const GLOBAL_PREFIX = "api/v1";
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger (only if enabled)
  const swaggerEnabled =
    (
      configService.get<string>("SWAGGER_ENABLE") ||
      process.env.SWAGGER_ENABLE ||
      "false"
    ).toLowerCase() === "true";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("API")
      .setDescription("API docs")
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          // 'in' isn't needed for http bearer, it's for apiKey
        },
        "bearerAuth" // <--- name of the security scheme
      )
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, doc);
  }

  // CORS config: origin matcher tolerant to undefined (non-browser) and trimmed origins
  app.enableCors({
    origin: (origin, callback) => {
      // log for debug (can be removed)
      console.log("CORS check origin:", origin);
      if (!origin) {
        // non-browser or same-origin (allow)
        return callback(null, true);
      }
      // exact match against list
      if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);

      // try matching origins without trailing slash, or allow scheme-less comparison
      const originNormalized = origin.replace(/\/$/, "");
      const found = FRONTEND_ORIGINS.some((o) => {
        const oNorm = o.replace(/\/$/, "");
        return oNorm === originNormalized;
      });
      if (found) return callback(null, true);

      console.warn("CORS rejected origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "*",
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ensure port & host defaults so Number(...) doesn't produce NaN
  const port =
    Number(configService.get<number>("APP_PORT")) ||
    Number(process.env.APP_PORT) ||
    2008;
  const host =
    configService.get<string>("HOST") || process.env.HOST || "0.0.0.0";

  if (process.env.TRUST_PROXY === "true") {
    (app as any).set("trust proxy", 1);
  }

  // graceful shutdown
  app.enableShutdownHooks();

  // Force bind to configured host (0.0.0.0) so other containers can reach it
  await app.listen(port, host);

  // don't rely on app.getUrl() for bind interface; print server address directly
  const server: any = app.getHttpServer();
  console.log(`Bootstrap: host=${host} port=${port}`);
  try {
    console.log("server.address():", server.address && server.address());
  } catch (err) {
    console.log(
      "could not read server.address():",
      (err as any)?.message || err
    );
  }
}

bootstrap();
