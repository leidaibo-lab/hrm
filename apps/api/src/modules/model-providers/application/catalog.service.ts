import { ERROR_CODE } from '@cip/shared';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CATALOG_PORT,
  type CatalogPort,
  type CatalogProviderView,
} from '../domain/catalog.port';

/**
 * 目录代理服务（应用层）：models.dev 数据出口与错误语义收口。
 * 上游不可达 → 503；目录无该服务商 → 404；返回 domain 读模型，DTO 映射由接入层完成。
 */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_PORT)
    private readonly catalog: CatalogPort,
  ) {}

  /** 目录全量：上游不可达时翻译为 503（前端可降级为手动录入）。 */
  list(): Promise<CatalogProviderView[]> {
    return this.catalog.fetchCatalog().catch((cause: unknown) => {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.model.catalogUnavailable,
        message: `模型目录拉取失败（可手动录入）: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    });
  }

  /** 目录中的单个服务商；不存在时 404。 */
  async get(providerId: string): Promise<CatalogProviderView> {
    const provider = (await this.list()).find(
      (row) => row.providerId === providerId,
    );
    if (!provider) {
      throw new NotFoundException({
        code: ERROR_CODE.model.catalogProviderNotFound,
        message: '目录中不存在该服务商',
      });
    }
    return provider;
  }
}
