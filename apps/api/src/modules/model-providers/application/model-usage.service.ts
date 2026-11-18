import type { TableQueryRequest } from '@cip/shared';
import { Inject, Injectable } from '@nestjs/common';
import {
  MODEL_USAGE_REPOSITORY,
  type ModelUsageRepository,
  type UsageTableResult,
} from '../domain/model-usage.repository';

/** 用量查询服务（应用层）：表格查询用例；items/total/meta 同条件，读模型直返。 */
@Injectable()
export class ModelUsageService {
  constructor(
    @Inject(MODEL_USAGE_REPOSITORY)
    private readonly usages: ModelUsageRepository,
  ) {}

  async queryTable(query: TableQueryRequest): Promise<UsageTableResult> {
    return this.usages.queryTable(query);
  }
}
