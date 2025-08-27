import { Provider, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { RedisOptions } from "ioredis";

export const RedisProvider: Provider = {
  provide: "REDIS_CLIENT",
  useFactory: async (config: ConfigService): Promise<Redis> => {
    const logger = new Logger("RedisProvider");
    const url = config.get<string>("REDIS_URL");

    if (!url) {
      throw new Error(
        "REDIS_URL is not configured. Set REDIS_URL in environment / secrets."
      );
    }

    const connectTimeout = Number(
      config.get<number>("REDIS_CONNECT_TIMEOUT_MS", 10000)
    );
    const maxRetriesPerRequest = Number(
      config.get<number>("REDIS_MAX_RETRIES_PER_REQUEST", 3)
    );
    const maxRetries = Number(config.get<number>("REDIS_MAX_RETRIES", 5));

    const options: RedisOptions = {
      lazyConnect: false,
      maxRetriesPerRequest,
      retryStrategy: (times: number) => {
        if (times > maxRetries) return null;
        return Math.min(200 * Math.pow(2, times), 5000); // Increased retry backoff
      },
      connectTimeout,
      enableReadyCheck: true,
    };

    const redis = new Redis(url, options);

    redis.on("error", (err) => {
      logger.error(`Redis error: ${err?.message ?? String(err)}`, err?.stack);
    });
    redis.on("connect", () => logger.log("Redis connecting..."));
    redis.on("ready", () => logger.log("Redis ready"));
    redis.on("close", () => logger.warn("Redis closed"));
    redis.on("end", () => logger.warn("Redis connection ended"));
    redis.on("reconnecting", () => logger.log("Redis reconnecting..."));

    // Custom ping with retry logic
    const attemptPing = async () => {
      let retries = 5;
      while (retries > 0) {
        try {
          await redis.ping();
          logger.log("Connected to Redis successfully.");
          return;
        } catch (err) {
          retries--;
          if (retries <= 0) {
            throw new Error(
              `Failed to connect to Redis after several attempts: ${
                err?.message ?? String(err)
              }`
            );
          }
          logger.warn(`Redis ping failed, retrying... (${5 - retries} of 5)`);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds retry
        }
      }
    };

    try {
      await attemptPing();
    } catch (err) {
      logger.error(
        "Failed to connect to Redis on startup — aborting application startup.",
        err?.message ?? String(err)
      );
      await redis.quit().catch(() => undefined);
      throw new Error(
        `Cannot connect to Redis: ${err?.message ?? String(err)}`
      );
    }

    // Graceful shutdown
    const cleanup = async () => {
      logger.log("Closing Redis connection...");
      await redis
        .quit()
        .catch((err) =>
          logger.error(
            "Error during Redis cleanup: ",
            err?.message ?? String(err)
          )
        );
      logger.log("Redis connection closed.");
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    return redis;
  },
  inject: [ConfigService],
};
