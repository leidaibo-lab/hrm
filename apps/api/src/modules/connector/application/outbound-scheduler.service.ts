import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { OutboundDispatcherService } from './outbound-dispatcher.service';

/** 周期任务间隔（毫秒）：出站派发与关注过期清理。 */
const TICK_INTERVAL_MS = 5_000;
/** 单次派发上限。 */
const DISPATCH_LIMIT = 20;

/**
 * worker 周期任务：派发到期的出站消息。
 * 只由 WorkerModule 装配；api 进程不启动，避免多实例重复执行。
 */
@Injectable()
export class OutboundSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly outbound: OutboundDispatcherService) {}

  /** 启动周期任务；定时器 unref，不阻止进程退出。 */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  /** 停止周期任务。 */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 执行一轮；上一轮未结束时跳过，避免重复派发。 */
  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.outbound.dispatchDue(DISPATCH_LIMIT, now);
    } catch (error) {
      this.logger.error(
        `周期任务失败：${error instanceof Error ? error.message : '未知错误'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
