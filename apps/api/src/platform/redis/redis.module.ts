import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** 技术能力适配器模块：全局单例，业务模块注入 RedisService 访问 Redis。 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
