// src/shared/shared.module.ts
import { Module } from '@nestjs/common';
import { RedisProvider } from '../common/redis.provider';

@Module({
    providers: [RedisProvider],
    exports: ['REDIS_CLIENT'],
})
export class SharedModule { }
