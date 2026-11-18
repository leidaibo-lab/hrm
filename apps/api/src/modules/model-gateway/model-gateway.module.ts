import { Module } from '@nestjs/common';
import { CatalogService } from './application/catalog.service';
import { FxService } from './application/fx.service';
import { GatewayExportService } from './application/gateway-export.service';
import { ModelService } from './application/model.service';
import { PriceService } from './application/price.service';
import { ProviderService } from './application/provider.service';
import { RoutingService } from './application/routing.service';
import { UsageService } from './application/usage.service';
import { CatalogController } from './catalog.controller';
import { CATALOG_PORT } from './domain/catalog.port';
import { CATALOG_SYNC_REPOSITORY } from './domain/catalog.repository';
import { FX_REPOSITORY } from './domain/fx.repository';
import { MODEL_REPOSITORY } from './domain/model.repository';
import { PRICE_REPOSITORY } from './domain/price.repository';
import { PROVIDER_REPOSITORY } from './domain/provider.repository';
import {
  BREAKER_PORT,
  GATEWAY_RUNTIME_PORT,
  RATE_LIMIT_PORT,
  SNAPSHOT_PORT,
} from './domain/runtime.port';
import { USAGE_REPOSITORY, USAGE_SINK_PORT } from './domain/usage.repository';
import { FxController } from './fx.controller';
import { CircuitBreaker } from './infrastructure/breaker.service';
import { CatalogSyncPrismaRepository } from './infrastructure/catalog.prisma.repository';
import { FxPrismaRepository } from './infrastructure/fx.prisma.repository';
import { MastraService } from './infrastructure/mastra.service';
import { ModelPrismaRepository } from './infrastructure/model.prisma.repository';
import { ModelsDevService } from './infrastructure/modelsdev.service';
import { PricePrismaRepository } from './infrastructure/price.prisma.repository';
import { ProviderPrismaRepository } from './infrastructure/provider.prisma.repository';
import { RateLimitService } from './infrastructure/rate-limit.service';
import { SnapshotService } from './infrastructure/snapshot.service';
import { UsagePrismaRepository } from './infrastructure/usage.prisma.repository';
import { UsageQueueService } from './infrastructure/usage-queue.service';
import { ModelController } from './model.controller';
import { PriceController } from './price.controller';
import { ProviderController } from './provider.controller';
import { UsageController } from './usage.controller';

/**
 * model-gateway 域（ADR-0084）：供应商、逻辑模型与候选、路由、价格与汇率、目录、用量。
 * 分层见 ADR-0014 / ADR-0021：application 经 domain 端口令牌绑定 infrastructure 实现。
 * 对外只导出 GatewayExportService。
 */
@Module({
  controllers: [
    ProviderController,
    ModelController,
    PriceController,
    FxController,
    CatalogController,
    UsageController,
  ],
  providers: [
    { provide: PROVIDER_REPOSITORY, useClass: ProviderPrismaRepository },
    { provide: MODEL_REPOSITORY, useClass: ModelPrismaRepository },
    { provide: PRICE_REPOSITORY, useClass: PricePrismaRepository },
    { provide: FX_REPOSITORY, useClass: FxPrismaRepository },
    { provide: USAGE_REPOSITORY, useClass: UsagePrismaRepository },
    {
      provide: CATALOG_SYNC_REPOSITORY,
      useClass: CatalogSyncPrismaRepository,
    },
    { provide: CATALOG_PORT, useClass: ModelsDevService },
    { provide: SNAPSHOT_PORT, useClass: SnapshotService },
    { provide: BREAKER_PORT, useClass: CircuitBreaker },
    { provide: RATE_LIMIT_PORT, useClass: RateLimitService },
    UsageQueueService,
    { provide: USAGE_SINK_PORT, useExisting: UsageQueueService },
    { provide: GATEWAY_RUNTIME_PORT, useClass: MastraService },
    ProviderService,
    ModelService,
    PriceService,
    FxService,
    CatalogService,
    UsageService,
    RoutingService,
    GatewayExportService,
  ],
  exports: [GatewayExportService],
})
export class ModelGatewayModule {}
