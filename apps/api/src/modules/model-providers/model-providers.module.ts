import { Module } from '@nestjs/common';
import { CatalogService } from './application/catalog.service';
import { GatewayExportService } from './application/gateway-export.service';
import { ModelPricingService } from './application/model-pricing.service';
import { ModelProviderService } from './application/model-provider.service';
import { ModelUsageService } from './application/model-usage.service';
import { ProviderModelService } from './application/provider-model.service';
import { UsageRecordService } from './application/usage-record.service';
import { CatalogController } from './catalog.controller';
import { CATALOG_PORT } from './domain/catalog.port';
import { MODEL_GATEWAY_PORT } from './domain/model-gateway.port';
import { MODEL_PRICING_REPOSITORY } from './domain/model-pricing.repository';
import { PROVIDER_REPOSITORY } from './domain/model-provider.repository';
import { MODEL_REGISTRATION_PORT } from './domain/model-registration.port';
import { MODEL_USAGE_REPOSITORY } from './domain/model-usage.repository';
import { PROVIDER_CONNECTION_PORT } from './domain/provider-connection.port';
import { PROVIDER_MODEL_REPOSITORY } from './domain/provider-model.repository';
import { GatewayFactory } from './infrastructure/gateway/gateway-factory.service';
import { ModelRateLimiter } from './infrastructure/gateway/model-rate-limiter.service';
import { ModelPricingPrismaRepository } from './infrastructure/model-pricing.prisma.repository';
import { ModelProviderPrismaRepository } from './infrastructure/model-provider.prisma.repository';
import { ModelRegistrationPrismaService } from './infrastructure/model-registration.prisma.service';
import { ModelUsagePrismaRepository } from './infrastructure/model-usage.prisma.repository';
import { ModelsDevClient } from './infrastructure/modelsdev/modelsdev-client.service';
import { ProviderConnectionService } from './infrastructure/provider-connection.service';
import { ProviderModelPrismaRepository } from './infrastructure/provider-model.prisma.repository';
import { ModelController } from './model.controller';
import { ProviderController } from './provider.controller';
import { UsageController } from './usage.controller';

/**
 * model-providers 域（ADR-0015）：模型服务商网关（mastra 封装、计量、限流、计价）。
 * 分层见 ADR-0014 / ADR-0021：application 经 domain 端口令牌绑定 infrastructure 实现。
 * 导出面收敛为 GatewayExportService：跨域模型接入唯一入口（agents 域经 createGateway 消费）。
 */
@Module({
  controllers: [
    ProviderController,
    ModelController,
    CatalogController,
    UsageController,
  ],
  providers: [
    {
      provide: MODEL_REGISTRATION_PORT,
      useClass: ModelRegistrationPrismaService,
    },
    { provide: PROVIDER_CONNECTION_PORT, useClass: ProviderConnectionService },
    CatalogService,
    ModelProviderService,
    ProviderModelService,
    ModelPricingService,
    ModelUsageService,
    UsageRecordService,
    GatewayExportService,
    ModelRateLimiter,
    { provide: CATALOG_PORT, useClass: ModelsDevClient },
    { provide: MODEL_GATEWAY_PORT, useClass: GatewayFactory },
    {
      provide: PROVIDER_REPOSITORY,
      useClass: ModelProviderPrismaRepository,
    },
    {
      provide: PROVIDER_MODEL_REPOSITORY,
      useClass: ProviderModelPrismaRepository,
    },
    {
      provide: MODEL_PRICING_REPOSITORY,
      useClass: ModelPricingPrismaRepository,
    },
    {
      provide: MODEL_USAGE_REPOSITORY,
      useClass: ModelUsagePrismaRepository,
    },
  ],
  exports: [GatewayExportService],
})
export class ModelProvidersModule {}
