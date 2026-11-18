import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalTokenGuard, Public } from '../../pipeline/guards';
import { MetricsQueryService } from './application/metrics-query.service';

/** 内部指标导出：Prometheus 文本格式，共享令牌鉴权。 */
@ApiTags('internal')
@Controller('internal')
@Public()
@UseGuards(InternalTokenGuard)
export class InternalMetricsController {
  constructor(private readonly metrics: MetricsQueryService) {}

  /** 导出进程内指标。 */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: '内部：Prometheus 指标' })
  @ApiOkResponse({ description: 'Prometheus 文本' })
  getMetrics(): string {
    return this.metrics.render();
  }
}
