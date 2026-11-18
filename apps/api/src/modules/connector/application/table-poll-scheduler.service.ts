import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { TablePollService } from './table-poll.service';

/** 表格轮询间隔（毫秒）。 */
const TICK_INTERVAL_MS = 60_000;

/** 表格轮询周期任务：worker 进程执行。 */
@Injectable()
export class TablePollSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TablePollSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly polls: TablePollService) {}

  /** 启动周期轮询。 */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  /** 停止轮询。 */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 执行一轮；上一轮未完成时跳过。 */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.polls.pollAll(now);
    } catch (error) {
      this.logger.error(
        `表格轮询失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
