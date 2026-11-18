import { ERROR_CODE } from '@cip/shared';
import type {
  GatewayLanguageModel,
  MastraModelGateway,
} from '@mastra/core/llm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ModelGatewayPort } from '../../domain/model-gateway.port';
import type {
  ModelView,
  ProviderModelRepository,
} from '../../domain/provider-model.repository';
import { GatewayExportService } from '../gateway-export.service';

const gateway = {} as unknown as MastraModelGateway;
const model = {} as unknown as GatewayLanguageModel;

const view: ModelView = {
  id: 'm1',
  providerId: 'p1',
  providerSlug: 'openai',
  providerName: 'OpenAI',
  providerEnabled: true,
  modelId: 'gpt-4o',
  logicalKey: 'openai/gpt-4o',
  displayName: 'GPT-4o',
  capabilities: {
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    toolCall: true,
    imageInput: true,
    audioInput: false,
    structuredOutput: true,
    reasoning: false,
    embedding: false,
    streaming: true,
  },
  defaultParams: null,
  enabled: true,
  currentPricing: null,
  createdAt: '2026-11-06T00:00:00.000Z',
};

function makeService(
  options: {
    item?: ModelView | null;
    resolved?: GatewayLanguageModel | null;
  } = {},
): GatewayExportService {
  const port: ModelGatewayPort<MastraModelGateway, GatewayLanguageModel> = {
    createGateway: async () => gateway,
    resolveRegisteredModel: async () => options.resolved ?? null,
  };
  const models = {
    findByLogicalKey: async () => options.item ?? null,
  } as unknown as ProviderModelRepository;
  return new GatewayExportService(port, models);
}

describe('GatewayExportService', () => {
  it('createGateway 委托端口构建快照', async () => {
    await expect(makeService().createGateway()).resolves.toBe(gateway);
  });

  it('resolveModel 返回端口解析的模型', async () => {
    await expect(
      makeService({ item: view, resolved: model }).resolveModel(
        view.logicalKey,
      ),
    ).resolves.toBe(model);
  });

  it('模型未注册时 404', async () => {
    const error = await makeService()
      .resolveModel('missing')
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      code: ERROR_CODE.model.modelNotFound,
    });
  });

  it('模型或供应商停用时 409 provider_model_disabled（与未注册的 404 区分）', async () => {
    const error = await makeService({ item: { ...view, enabled: false } })
      .resolveModel(view.logicalKey)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: ERROR_CODE.model.providerModelDisabled,
    });
  });

  it('端口快照未命中时 404', async () => {
    await expect(
      makeService({ item: view }).resolveModel(view.logicalKey),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('能力不支持时 400，支持时通过', async () => {
    await expect(
      makeService({ item: view }).assertCapability(view.logicalKey, 'toolCall'),
    ).resolves.toBeUndefined();
    await expect(
      makeService({ item: view }).assertCapability(
        view.logicalKey,
        'reasoning',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
