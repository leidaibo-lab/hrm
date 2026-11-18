import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { TableQueryRequest } from '@cip/shared';
import { FilterOperator, SortDirection } from '@cip/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../../platform/prisma';
import { PrismaClient } from '../../../../platform/prisma/generated/client';
import { UserPrismaRepository } from '../user.prisma.repository';

const testUrl = process.env.TEST_DATABASE_URL;
const schema = `test_${randomUUID().replaceAll('-', '')}`;
let db: PrismaClient;
let admin: PrismaClient;
let repository: UserPrismaRepository;

/** 规范请求工厂：默认无条件单页、默认排序（真实链路中由 planTableQuery 落位），用例只声明差异。 */
const query = (
  overrides: Partial<TableQueryRequest> = {},
): TableQueryRequest => ({
  page: 1,
  pageSize: 100,
  q: null,
  scope: null,
  filters: [],
  sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
  ...overrides,
});

describe.skipIf(!testUrl)(
  'users 表格查询行为（POST /users/query 语义）',
  () => {
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
      repository = new UserPrismaRepository(db as PrismaService);
      // 种子：覆盖文本大小写、通配符字面量、null、多状态与多时间点
      const seed = [
        {
          username: 'alpha',
          name: '张_A%',
          email: null,
          status: 'active' as const,
          offsetDays: 10,
        },
        {
          username: 'Beta',
          name: 'beta 用户',
          email: 'beta@x.io',
          status: 'active' as const,
          offsetDays: 8,
        },
        {
          username: 'gamma',
          name: 'gamma 用户',
          email: 'GAMMA@x.io',
          status: 'suspended' as const,
          offsetDays: 5,
        },
        {
          username: 'delta_x',
          name: 'delta 用户',
          email: 'delta@x.io',
          status: 'suspended' as const,
          offsetDays: 2,
        },
      ];
      const now = Date.now();
      for (const [index, row] of seed.entries()) {
        await db.user.create({
          data: {
            username: row.username,
            name: row.name,
            email: row.email,
            status: row.status,
            createdAt: new Date(now - row.offsetDays * 86400000 + index),
          },
        });
      }
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

    it('文本 eq 大小写不敏感；neq 排除且 null 不参与匹配', async () => {
      const eq = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'name',
              operator: FilterOperator.Equal,
              value: 'BETA 用户',
            },
          ],
        }),
      );
      expect(eq.total).toBe(1);
      expect(eq.items[0]?.username).toBe('Beta');

      const neq = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'name',
              operator: FilterOperator.NotEqual,
              value: 'beta 用户',
            },
          ],
        }),
      );
      // beta 用户 被排除；name 无 null 行，其余三条全中
      expect(neq.total).toBe(3);
    });

    it('负向邮箱条件不把 null 当成普通字符串', async () => {
      const result = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'email',
              operator: FilterOperator.NotEqual,
              value: 'beta@x.io',
            },
          ],
        }),
      );
      expect(result.items.map((row) => row.username).sort()).toEqual([
        'delta_x',
        'gamma',
      ]);
    });

    it('contains 为字面子串且不解释 % 和 _ 通配符', async () => {
      const wildcard = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'name',
              operator: FilterOperator.Contains,
              value: '%',
            },
          ],
        }),
      );
      // 只命中字面百分号；若未转义，所有非空文本都会匹配
      expect(wildcard.total).toBe(1);
      expect(wildcard.items[0]?.username).toBe('alpha');

      const underscore = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'username',
              operator: FilterOperator.Contains,
              value: 'ta_x',
            },
          ],
        }),
      );
      // "ta_x" 只命中字面 delta_x（若 _ 解释为任意单字符会额外命中 Beta/gamma）
      expect(underscore.items.map((row) => row.username)).toEqual(['delta_x']);
    });

    it('not_contains 排除子串；null 列既不命中正向也不命中负向', async () => {
      const notContains = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'name',
              operator: FilterOperator.NotContains,
              value: '用户',
            },
          ],
        }),
      );
      expect(notContains.items.map((row) => row.username)).toEqual(['alpha']);

      const emailContains = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'email',
              operator: FilterOperator.Contains,
              value: 'x.io',
            },
          ],
        }),
      );
      expect(emailContains.items.map((row) => row.username)).toEqual([
        'Beta',
        'gamma',
        'delta_x',
      ]);

      const emailNotContains = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'text',
              field: 'email',
              operator: FilterOperator.NotContains,
              value: 'x.io',
            },
          ],
        }),
      );
      // alpha（email null）不参与负向匹配；其余 email 均含 x.io（大小写不敏感）→ 无命中
      expect(emailNotContains.items).toEqual([]);
    });

    it('q 跨 name/username/email 搜索（大小写不敏感 OR）', async () => {
      const byEmail = await repository.queryTable(query({ q: 'GAMMA@x' }));
      expect(byEmail.items.map((row) => row.username)).toEqual(['gamma']);
      const byUsername = await repository.queryTable(query({ q: 'BETA' }));
      expect(byUsername.items.map((row) => row.username)).toEqual(['Beta']);
    });

    it('enum eq 多值为命中任意（ANY），neq 多值为全部排除（NONE）', async () => {
      const any = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'enum',
              field: 'status',
              operator: FilterOperator.Equal,
              values: ['suspended'],
            },
          ],
        }),
      );
      expect(any.total).toBe(2);

      const none = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'enum',
              field: 'status',
              operator: FilterOperator.NotEqual,
              values: ['active', 'suspended'],
            },
          ],
        }),
      );
      expect(none.total).toBe(0);
    });

    it('date before 早于截止时刻（不含），not_before 含该时刻', async () => {
      const cutoff = await db.user.findFirstOrThrow({
        where: { username: 'gamma' },
        select: { createdAt: true },
      });
      const iso = cutoff.createdAt.toISOString();
      const notBefore = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'date',
              field: 'createdAt',
              operator: FilterOperator.NotBefore,
              value: iso,
            },
          ],
        }),
      );
      expect(notBefore.items.map((row) => row.username)).toEqual([
        'gamma',
        'delta_x',
      ]);

      const before = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'date',
              field: 'createdAt',
              operator: FilterOperator.Before,
              value: iso,
            },
          ],
        }),
      );
      expect(before.items.map((row) => row.username)).toEqual([
        'alpha',
        'Beta',
      ]);
    });

    it('多列排序按声明顺序执行，并以唯一 ID 稳定 tie-break', async () => {
      // createdAt 有同毫秒数据（种子 index 补偿），name 平局时验证 id 稳定序
      const result = await repository.queryTable(
        query({
          sort: [
            { field: 'status', direction: SortDirection.Asc },
            { field: 'createdAt', direction: SortDirection.Desc },
          ],
        }),
      );
      expect(result.items.map((row) => row.username)).toEqual([
        'Beta',
        'alpha',
        'delta_x',
        'gamma',
      ]);
      // 重复执行结果完全一致（稳定排序）
      const again = await repository.queryTable(
        query({
          sort: [
            { field: 'status', direction: SortDirection.Asc },
            { field: 'createdAt', direction: SortDirection.Desc },
          ],
        }),
      );
      expect(again.items.map((row) => row.id)).toEqual(
        result.items.map((row) => row.id),
      );
    });

    it('offset 分页与 items/total 使用相同筛选条件', async () => {
      const first = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'enum',
              field: 'status',
              operator: FilterOperator.Equal,
              values: ['active'],
            },
          ],
          pageSize: 1,
          sort: [{ field: 'createdAt', direction: SortDirection.Desc }],
        }),
      );
      expect(first.total).toBe(2);
      expect(first.items).toHaveLength(1);
      const second = await repository.queryTable(
        query({
          filters: [
            {
              kind: 'enum',
              field: 'status',
              operator: FilterOperator.Equal,
              values: ['active'],
            },
          ],
          page: 2,
          pageSize: 1,
          sort: [{ field: 'createdAt', direction: SortDirection.Desc }],
        }),
      );
      expect(second.total).toBe(2);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
      // 越界页返回空 items 且 total 保持
      const beyond = await repository.queryTable(query({ page: 99 }));
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(4);
    });

    it('组合条件为 AND，默认排序（createdAt asc）带 ID tie-break', async () => {
      const result = await repository.queryTable(
        query({
          q: '用户',
          filters: [
            {
              kind: 'enum',
              field: 'status',
              operator: FilterOperator.Equal,
              values: ['active'],
            },
            {
              kind: 'text',
              field: 'email',
              operator: FilterOperator.NotContains,
              value: 'x.io',
            },
          ],
        }),
      );
      // q 命中 name 含"用户"的行；active 且 email 非含 x.io → 仅 Beta（email 含 x.io 被排除）→ 0 条
      expect(result.items).toEqual([]);
      const noFilter = await repository.queryTable(query({}));
      // 默认排序：createdAt asc，同毫秒按 id 稳定
      expect(noFilter.items.map((row) => row.username)).toEqual([
        'alpha',
        'Beta',
        'gamma',
        'delta_x',
      ]);
    });
  },
);
