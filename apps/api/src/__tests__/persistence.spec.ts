import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RolePrismaRepository } from '../modules/iam/infrastructure/role.prisma.repository';
import { ProviderModel } from '../modules/model-providers/domain/provider-model.entity';
import { ModelProviderPrismaRepository } from '../modules/model-providers/infrastructure/model-provider.prisma.repository';
import { ModelRegistrationPrismaService } from '../modules/model-providers/infrastructure/model-registration.prisma.service';
import { ProviderModelPrismaRepository } from '../modules/model-providers/infrastructure/provider-model.prisma.repository';
import type { PrismaService } from '../platform/prisma';
import { PrismaClient } from '../platform/prisma/generated/client';

const testUrl = process.env.TEST_DATABASE_URL;
const schema = `test_${randomUUID().replaceAll('-', '')}`;
let db: PrismaClient;
let admin: PrismaClient;
let registration: ModelRegistrationPrismaService;
let providerId: string;
const entry = {
  modelId: 'test-model',
  displayName: '模型',
  reasoning: false,
  toolCall: true,
  structuredOutput: true,
  imageInput: false,
  contextWindow: 8192,
  maxOutputTokens: 4096,
  input: 1,
  output: 2,
  cacheRead: null,
  cacheWrite: null,
};
const model = (id: string, logicalKey = id) =>
  ProviderModel.register({
    providerId,
    modelId: id,
    logicalKey,
    displayName: id,
    capabilities: {
      contextWindow: 8192,
      maxOutputTokens: 4096,
      toolCall: true,
      imageInput: false,
      audioInput: false,
      structuredOutput: true,
      reasoning: false,
      embedding: false,
      streaming: true,
    },
    defaultParams: null,
  });

describe.skipIf(!testUrl)('隔离数据库：注册原子性、并发与动态价格', () => {
  beforeAll(async () => {
    const url = new URL(testUrl ?? 'invalid:');
    if (!/(test|_test)$/.test(url.pathname))
      throw new Error('TEST_DATABASE_URL 必须指向专用测试数据库');
    url.searchParams.set('schema', schema);
    admin = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testUrl }),
    });
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
    });
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testUrl }, { schema }),
    });
    registration = new ModelRegistrationPrismaService(db as PrismaService);
    providerId = (
      await db.modelProvider.create({
        data: {
          slug: 'test-provider',
          name: '测试',
          baseUrl: 'https://example.invalid',
          apiKeyCipher: 'test-only',
        },
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
      await admin.$disconnect();
    }
  });
  it('初始价格失败时模型回滚，重试完整写入', async () => {
    await expect(
      registration.create(
        model('rollback'),
        { ...entry, input: 1e30 },
        new Date(),
      ),
    ).rejects.toBeDefined();
    expect(
      await db.providerModel.count({ where: { modelId: 'rollback' } }),
    ).toBe(0);
    expect(
      await registration.create(model('rollback'), entry, new Date()),
    ).toBe('created');
    const saved = await db.providerModel.findUniqueOrThrow({
      where: { logicalKey: 'rollback' },
      include: { pricings: true },
    });
    expect(saved.pricings).toHaveLength(1);
  });
  it('并发重复只创建一份模型和价格，其他调用跳过', async () => {
    const results = await Promise.all([
      registration.create(model('concurrent'), entry, new Date()),
      registration.create(model('concurrent'), entry, new Date()),
    ]);
    expect(results.sort()).toEqual(['created', 'skipped']);
    expect(
      await db.modelPricing.count({
        where: { model: { logicalKey: 'concurrent' } },
      }),
    ).toBe(1);
  });
  it('其他模型占用调用名时不能假装重复跳过', async () => {
    await expect(
      registration.create(
        model('other-model', 'concurrent'),
        entry,
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'model.logical_key_conflict' });
  });
  it('详情价格按查询时点更新，不固定在模块加载时刻', async () => {
    const row = await db.providerModel.findUniqueOrThrow({
      where: { logicalKey: 'rollback' },
    });
    const repository = new ProviderModelPrismaRepository(db as PrismaService);
    const future = new Date(Date.now() + 100);
    await db.modelPricing.create({
      data: {
        modelId: row.id,
        input: 3,
        output: 4,
        currency: 'USD',
        effectiveFrom: future,
      },
    });
    expect((await repository.findViewById(row.id))?.currentPricing?.input).toBe(
      '1',
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await repository.findViewById(row.id))?.currentPricing?.input).toBe(
      '3',
    );
  });
  it('修改基本信息不会将旧快照中的权限写回', async () => {
    const row = await db.role.create({
      data: { code: 'test-role', name: '原始' },
    });
    const point = await db.permissionPoint.create({
      data: {
        code: 'test:read',
        resource: 'test',
        action: 'read',
        summary: '读取',
      },
    });
    const roles = new RolePrismaRepository(db as PrismaService);
    const basic = await roles.findById(row.id);
    const permissions = await roles.findById(row.id);
    if (!basic || !permissions) throw new Error('测试角色未创建');
    permissions.grantPermissions([point.code]);
    await roles.save(permissions, 'permissions');
    basic.rename('新名称', null);
    await roles.save(basic, 'basic');
    expect(await roles.findViewById(row.id)).toMatchObject({
      name: '新名称',
      permissionCodes: [point.code],
    });
  });
  it('完整迁移链应用后，三个聚合不再包含 version 列', async () => {
    const rows = await db.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name IN ('roles', 'model_providers', 'provider_models') AND column_name = 'version'`;
    expect(rows).toEqual([]);
  });

  it('供应商配置、凭据和启停互不覆盖，旧快照不能恢复其他字段', async () => {
    const repository = new ModelProviderPrismaRepository(db as PrismaService);
    const staleConfig = await repository.findById(providerId);
    const staleEnabled = await repository.findById(providerId);
    const rotate = await repository.findById(providerId);
    if (!staleConfig || !staleEnabled || !rotate)
      throw new Error('测试供应商未创建');
    rotate.rotateApiKey('new-cipher');
    await repository.saveConfiguration(rotate, ['apiKeyCipher']);
    staleEnabled.disable();
    await repository.saveEnabled(staleEnabled);
    staleConfig.reconfigure({
      name: '新名称',
      baseUrl: 'https://new.example.invalid',
      timeoutMs: 1234,
      rateLimitPerMinute: 2,
      maxConcurrent: 3,
    });
    await repository.saveConfiguration(staleConfig, [
      'name',
      'baseUrl',
      'timeoutMs',
      'rateLimitPerMinute',
      'maxConcurrent',
    ]);
    expect(
      await db.modelProvider.findUnique({ where: { id: providerId } }),
    ).toMatchObject({
      name: '新名称',
      enabled: false,
      apiKeyCipher: 'new-cipher',
      timeoutMs: 1234,
    });
    staleEnabled.enable();
    await repository.saveEnabled(staleEnabled);
    expect(
      await db.modelProvider.findUnique({ where: { id: providerId } }),
    ).toMatchObject({
      name: '新名称',
      enabled: true,
      apiKeyCipher: 'new-cipher',
      timeoutMs: 1234,
    });
  });

  it('模型的局部配置与启停独立写入，null 清除与未传字段有不同语义', async () => {
    const repository = new ProviderModelPrismaRepository(db as PrismaService);
    const row = await db.providerModel.findUniqueOrThrow({
      where: { logicalKey: 'rollback' },
    });
    const name = await repository.findById(row.id);
    const caps = await repository.findById(row.id);
    const enabled = await repository.findById(row.id);
    if (!name || !caps || !enabled) throw new Error('测试模型未创建');
    const nextCaps = { ...caps.capabilities, contextWindow: 16384 };
    caps.reconfigure({
      displayName: caps.displayName,
      capabilities: nextCaps,
      defaultParams: { temperature: 0.7 },
    });
    await repository.saveConfiguration(caps, ['capabilities', 'defaultParams']);
    enabled.disable();
    await repository.saveEnabled(enabled);
    name.reconfigure({
      displayName: '模型新名称',
      capabilities: name.capabilities,
      defaultParams: name.defaultParams,
    });
    await repository.saveConfiguration(name, ['displayName']);
    expect(await repository.findViewById(row.id)).toMatchObject({
      displayName: '模型新名称',
      enabled: false,
      capabilities: { contextWindow: 16384 },
      defaultParams: { temperature: 0.7 },
    });
    enabled.enable();
    await repository.saveEnabled(enabled);
    expect(await repository.findViewById(row.id)).toMatchObject({
      displayName: '模型新名称',
      enabled: true,
      capabilities: { contextWindow: 16384 },
      defaultParams: { temperature: 0.7 },
    });
    caps.reconfigure({
      displayName: caps.displayName,
      capabilities: caps.capabilities,
      defaultParams: null,
    });
    await repository.saveConfiguration(caps, ['defaultParams']);
    expect((await repository.findViewById(row.id))?.defaultParams).toBeNull();
  });
});
