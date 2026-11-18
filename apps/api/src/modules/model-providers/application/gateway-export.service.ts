import { ERROR_CODE } from '@cip/shared';
import type {
  GatewayLanguageModel,
  MastraModelGateway,
} from '@mastra/core/llm';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MODEL_GATEWAY_PORT,
  type ModelGatewayPort,
} from '../domain/model-gateway.port';
import {
  PROVIDER_MODEL_REPOSITORY,
  type ProviderModelRepository,
} from '../domain/provider-model.repository';
import type { CapabilityFilterKey } from './provider-model.service';

/**
 * 跨域唯一模型接入面（ADR-0015）：
 * - createGateway：agents 域注册到自己的 Mastra 实例，走 `cip/<slug>/<modelId>` 字符串路由；
 * - resolveModel / assertCapability：辅助直调路径（连通性测试、脚本）。
 * 除本服务外，任何模块不得触达 mastra 与网关内部；网关实例经 domain 端口取得。
 */
@Injectable()
export class GatewayExportService {
  constructor(
    @Inject(MODEL_GATEWAY_PORT)
    private readonly gateway: ModelGatewayPort<
      MastraModelGateway,
      GatewayLanguageModel
    >,
    @Inject(PROVIDER_MODEL_REPOSITORY)
    private readonly models: ProviderModelRepository,
  ) {}

  /** 按当前配置构建 mastra 网关快照，供 agents 域注册。 */
  async createGateway(): Promise<MastraModelGateway> {
    return this.gateway.createGateway();
  }

  /**
   * 辅助路径：按逻辑调用名解析可直接调用的模型实例（计量/限流内建）。
   * @throws 模型不存在 404；模型或供应商停用 409。
   */
  async resolveModel(logicalKey: string): Promise<GatewayLanguageModel> {
    const item = await this.mustFindById(logicalKey);
    this.ensureUsable(item);
    const model = await this.gateway.resolveRegisteredModel(
      item.providerSlug,
      item.modelId,
    );
    if (!model) {
      throw new NotFoundException({
        code: ERROR_CODE.model.modelNotFound,
        message: '模型在网关快照中不存在',
      });
    }
    return model;
  }

  /** 能力前置校验：调用方构造请求前断言模型支持所需能力。 */
  async assertCapability(
    logicalKey: string,
    capability: CapabilityFilterKey,
  ): Promise<void> {
    const item = await this.mustFindById(logicalKey);
    this.ensureUsable(item);
    if (item.capabilities[capability] !== true) {
      throw new BadRequestException({
        code: ERROR_CODE.model.capabilityUnsupported,
        message: `模型 ${item.displayName} 不支持能力 ${capability}`,
      });
    }
  }

  private async mustFindById(logicalKey: string) {
    const item = await this.models.findByLogicalKey(logicalKey);
    if (!item) {
      throw new NotFoundException({
        code: ERROR_CODE.model.modelNotFound,
        message: `逻辑调用名 ${logicalKey} 未注册`,
      });
    }
    return item;
  }

  private ensureUsable(item: {
    enabled: boolean;
    providerEnabled: boolean;
    displayName: string;
  }): void {
    if (!item.enabled || !item.providerEnabled) {
      // 停用与未注册分离为两个 code：机器判断只依赖 code（CON-4.3），前端可区分停用原因
      throw new ConflictException({
        code: ERROR_CODE.model.providerModelDisabled,
        message: `模型 ${item.displayName} 或其供应商已停用`,
      });
    }
  }
}
