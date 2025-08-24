// src/common/redis.provider.ts
import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const RedisProvider: Provider = {
    provide: 'REDIS_CLIENT',
    useFactory: async (config: ConfigService): Promise<Redis> => {
        const logger = new Logger('RedisProvider');
        const url = config.get<string>('REDIS_URL');

        if (!url) {
            throw new Error('REDIS_URL is not configured. Set REDIS_URL in environment / secrets.');
        }

        const connectTimeout = Number(config.get<number>('REDIS_CONNECT_TIMEOUT_MS', 10000));
        const maxRetriesPerRequest = Number(config.get<number>('REDIS_MAX_RETRIES_PER_REQUEST', 3));
        const maxRetries = Number(config.get<number>('REDIS_MAX_RETRIES', 5));

        const options: RedisOptions = {
            lazyConnect: false,
            maxRetriesPerRequest,
            retryStrategy: (times: number) => {
                if (times > maxRetries) return null;
                return Math.min(50 * Math.pow(2, times), 2000);
            },
            connectTimeout,
            enableReadyCheck: true,
        };

        const redis = new Redis(url, options);

        redis.on('error', (err) => {
            logger.error(`Redis error: ${err?.message ?? String(err)}`, err?.stack);
        });
        redis.on('connect', () => logger.log('Redis connecting...'));
        redis.on('ready', () => logger.log('Redis ready'));
        redis.on('close', () => logger.warn('Redis closed'));
        redis.on('end', () => logger.warn('Redis connection ended'));
        redis.on('reconnecting', () => logger.log('Redis reconnecting...'));

        try {
            await redis.ping();
            logger.log('Connected to Redis successfully.');
        } catch (err) {
            logger.error('Failed to connect to Redis on startup — aborting application startup.', err?.message ?? String(err));
            try { await redis.quit().catch(() => undefined); } catch { }
            throw new Error(`Cannot connect to Redis: ${err?.message ?? String(err)}`);
        }

        const cleanup = async () => {
            try {
                logger.log('Closing Redis connection...');
                await redis.quit();
                logger.log('Redis connection closed.');
            } catch (e) {
                logger.error('Error while closing Redis connection', (e as Error)?.message ?? String(e));
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        return redis;
    },
    inject: [ConfigService],
};
