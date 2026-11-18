import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

/** 横切能力模块：固定窗口限流，业务按需注入。 */
@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
