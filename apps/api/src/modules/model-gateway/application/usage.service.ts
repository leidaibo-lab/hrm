import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import {
  USAGE_REPOSITORY,
  type UsageRepository,
  type UsageSummaryFilter,
  type UsageSummaryView,
  type UsageTableResult,
} from '../domain/usage.repository';

/** 用量应用服务：表格查询与汇总同筛选条件；成本只对 success 求和。 */
@Injectable()
export class UsageService {
  constructor(
    @Inject(USAGE_REPOSITORY)
    private readonly usages: UsageRepository,
  ) {}

  async queryTable(query: TableQueryRequest): Promise<UsageTableResult> {
    return this.usages.queryTable(query);
  }

  async summary(filter: UsageSummaryFilter): Promise<UsageSummaryView> {
    return this.usages.summarize(filter);
  }
}
