import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  FilterOperator,
  SortDirection,
  type TableQueryRequest,
} from '@cip/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RolePrismaRepository } from '../../../../modules/iam/infrastructure/role.prisma.repository';
import type { PrismaService } from '../../../../platform/prisma';
import { PrismaClient } from '../../../../platform/prisma/generated/client';
import { ModelProviderPrismaRepository } from '../model-provider.prisma.repository';
import { ModelUsagePrismaRepository } from '../model-usage.prisma.repository';

const testUrl = process.env.TEST_DATABASE_URL;
const schema = `test_${randomUUID().replaceAll('-', '')}`;
let db: PrismaClient;
let admin: PrismaClient;
let repository: ModelUsagePrismaRepository;
const query = (
  overrides: Partial<TableQueryRequest> = {},
): TableQueryRequest => ({
  page: 1,
  pageSize: 1,
  q: null,
  scope: null,
  filters: [],
  sort: [{ field: 'cost', direction: SortDirection.Desc }],
  ...overrides,
});

describe.skipIf(!testUrl)('用量表查询：精度、分页汇总与空值', () => {
  beforeAll(async () => {
    const url = new URL(testUrl ?? 'invalid:');
    if (!/(test|_test)$/.test(url.pathname))
      throw new Error('必须使用隔离测试数据库');
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
    repository = new ModelUsagePrismaRepository(db as PrismaService);
    await db.role.createMany({
      data: [
        { code: 'builtin-test', name: '内置', isBuiltin: true },
        { code: 'custom-test', name: '自定义', isBuiltin: false },
      ],
    });
    const provider = await db.modelProvider.create({
      data: {
        slug: 'usage-test',
        name: 'test',
        baseUrl: 'https://example.invalid',
        apiKeyCipher: 'test',
      },
    });
    const model = await db.providerModel.create({
      data: {
        providerId: provider.id,
        modelId: 'test',
        logicalKey: 'usage-test',
        displayName: 'test',
        capabilities: {},
      },
    });
    await db.modelUsage.createMany({
      data: [
        {
          modelId: model.id,
          status: 'success',
          cost: '9999999999.00000001',
          inputTokens: 10,
          caller: 'match',
        },
        {
          modelId: model.id,
          status: 'failed',
          cost: '0.00000002',
          inputTokens: 20,
          caller: 'match',
        },
        {
          modelId: model.id,
          status: 'rate_limited',
          cost: null,
          inputTokens: 30,
          caller: null,
        },
      ],
    });
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
  it('一页一行仍返回完整筛选范围的精确汇总，金额不用浮点累加', async () => {
    const result = await repository.queryTable(query());
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.meta.totalCalls).toBe(3);
    expect(result.meta.totalCost).toBe('9999999999.00000003');
    expect(result.meta.totalInputTokens).toBe(60);
  });
  it('总数与汇总使用相同的条件，负向条件排除 null', async () => {
    const result = await repository.queryTable(
      query({
        filters: [
          {
            kind: 'text',
            field: 'caller',
            operator: FilterOperator.NotEqual,
            value: 'other',
          },
        ],
      }),
    );
    expect(result.total).toBe(2);
    expect(result.meta.totalCalls).toBe(2);
    expect(result.meta.rateLimitedCount).toBe(0);
  });
  it('降序金额也将 null 放在末尾，分页不会因空值挤到第一页', async () => {
    const result = await repository.queryTable(query({ page: 3 }));
    expect(result.items[0]?.cost).toBeNull();
  });
  it('布尔投影使用 BooleanFilter，角色类型和供应商状态都能被真实数据库查询', async () => {
    const roles = new RolePrismaRepository(db as PrismaService);
    const custom = await roles.queryTable(
      query({
        sort: [],
        filters: [
          {
            kind: 'enum',
            field: 'isBuiltin',
            operator: FilterOperator.Equal,
            values: ['custom'],
          },
        ],
      }),
    );
    expect(custom.items.map((role) => role.code)).toEqual(['custom-test']);
    const providers = new ModelProviderPrismaRepository(db as PrismaService);
    const enabled = await providers.queryTable(
      query({
        sort: [],
        filters: [
          {
            kind: 'enum',
            field: 'status',
            operator: FilterOperator.NotEqual,
            values: ['disabled'],
          },
        ],
      }),
    );
    expect(enabled.total).toBe(1);
  });
});
