import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/** 技术能力适配器模块：全局单例，业务模块注入 QueueService 投递与消费任务（ADR-0015）。 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
