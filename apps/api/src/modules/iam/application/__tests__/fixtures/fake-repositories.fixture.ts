import type { TableQueryRequest } from '@cip/shared';
import type {
  PermissionPointRepository,
  PermissionPointRow,
} from '../../../domain/permission-point.repository';
import { Role } from '../../../domain/role.entity';
import type { RoleRepository, RoleView } from '../../../domain/role.repository';
import { User } from '../../../domain/user.entity';
import type {
  UserCredentialView,
  UserRepository,
  UserRoleBindingRow,
  UserView,
} from '../../../domain/user.repository';

/** 表格查询内存过滤：q 跨列 OR contains、filters AND（轻量语义，完整语义由 DB 行为测试覆盖）。 */
function matchTableRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  query: TableQueryRequest,
  qColumns: readonly (keyof T)[],
): T[] {
  const contains = (value: string, needle: string) =>
    value.toLowerCase().includes(needle.toLowerCase());
  const needle = query.q;
  return rows.filter((row) => {
    if (
      needle &&
      !qColumns.some((column) => contains(String(row[column] ?? ''), needle))
    ) {
      return false;
    }
    for (const filter of query.filters) {
      if (filter.kind === 'text') {
        const cell = String(row[filter.field] ?? '');
        if (filter.operator === 'contains' && !contains(cell, filter.value)) {
          return false;
        }
        if (
          filter.operator === 'not_contains' &&
          contains(cell, filter.value)
        ) {
          return false;
        }
        if (filter.operator === 'eq' && !contains(cell, filter.value))
          return false;
        if (filter.operator === 'neq' && contains(cell, filter.value))
          return false;
      }
      if (filter.kind === 'enum') {
        const cell = String(row[filter.field] ?? '');
        if (filter.operator === 'eq' && !filter.values.includes(cell))
          return false;
        if (filter.operator === 'neq' && filter.values.includes(cell))
          return false;
      }
      if (filter.kind === 'date') {
        const cell = Date.parse(String(row[filter.field]));
        const cutoff = Date.parse(filter.value);
        if (filter.operator === 'before' && !(cell < cutoff)) return false;
        if (filter.operator === 'not_before' && !(cell >= cutoff)) return false;
      }
      if (filter.kind === 'number') {
        const cell = Number(row[filter.field]);
        if (filter.operator === 'eq' && cell !== filter.value) return false;
        if (filter.operator === 'neq' && cell === filter.value) return false;
      }
    }
    return true;
  });
}

/** 表格查询内存排序：多列字符串序 + id tie-break。 */
function sortTableRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: TableQueryRequest['sort'],
): T[] {
  return [...rows].sort((a, b) => {
    for (const rule of sort) {
      const compared = String(a[rule.field] ?? '').localeCompare(
        String(b[rule.field] ?? ''),
      );
      if (compared !== 0) {
        return rule.direction === 'asc' ? compared : -compared;
      }
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

/** 行工厂：默认值 + 覆盖，测试用例只声明差异。 */
export function makeRoleRow(
  overrides: Partial<RoleView> & { id: string },
): RoleView {
  return {
    code: `role-${overrides.id}`,
    name: `角色 ${overrides.id}`,
    description: null,
    isBuiltin: false,
    permissionCodes: [],
    createdAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

/** 构造测试用用户读模型；overrides 覆盖默认字段。 */
export function makeUserRow(
  overrides: Partial<UserView> & { id: string },
): UserView {
  return {
    username: `user-${overrides.id}`,
    name: `用户 ${overrides.id}`,
    email: null,
    status: 'active',
    roleIds: [],
    createdAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

/** 内存角色仓储：实现 RoleRepository 全接口，行为断言可直接读 rows。 */
export class FakeRoleRepository implements RoleRepository {
  readonly rows: RoleView[];

  constructor(rows: RoleView[] = []) {
    this.rows = rows;
  }

  /** 表格查询内存实现：isBuiltin 以 builtin/custom 投影参与筛选/排序。 */
  async queryTable(query: TableQueryRequest): Promise<{
    items: RoleView[];
    total: number;
  }> {
    const projected = this.rows.map((row) => ({
      ...row,
      isBuiltin: row.isBuiltin ? 'builtin' : 'custom',
    })) as Array<RoleView & { isBuiltin: string }>;
    const matched = matchTableRows(projected, query, [
      'code',
      'name',
      'description',
    ]);
    const sorted = sortTableRows(matched, query.sort);
    return {
      total: matched.length,
      items: sorted.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ) as unknown as RoleView[],
    };
  }

  async findViewById(id: string): Promise<RoleView | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findById(id: string): Promise<Role | null> {
    const row = this.rows.find((item) => item.id === id);
    return row ? Role.reconstitute(row) : null;
  }

  async findByCode(code: string): Promise<Role | null> {
    const row = this.rows.find((item) => item.code === code);
    return row ? Role.reconstitute(row) : null;
  }

  async findExistingIds(ids: string[]): Promise<string[]> {
    const known = new Set(this.rows.map((row) => row.id));
    return [...new Set(ids)].filter((id) => known.has(id));
  }

  async create(role: Role): Promise<RoleView> {
    const row = makeRoleRow({
      id: `new-${this.rows.length + 1}`,
      code: role.code,
      name: role.name,
      description: role.description,
    });
    this.rows.push(row);
    return row;
  }

  async save(
    role: Role,
    scope: 'basic' | 'permissions' = 'basic',
  ): Promise<void> {
    const row = this.rows.find((item) => item.id === role.id);
    if (!row) throw new Error(`仓储内不存在角色: ${role.id}`);
    if (scope === 'basic') {
      row.name = role.name;
      row.description = role.description;
    } else row.permissionCodes = [...role.permissionCodes];
  }

  async remove(id: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index >= 0) this.rows.splice(index, 1);
  }
}

/** 内存用户仓储。 */
export class FakeUserRepository implements UserRepository {
  readonly rows: UserView[];
  private readonly bindings = new Map<string, UserRoleBindingRow[]>();
  private readonly credentials = new Map<string, string | null>();

  constructor(rows: UserView[] = []) {
    this.rows = rows;
  }

  /** /me 展开用例的绑定数据注入口。 */
  setRoleBindings(userId: string, bindings: UserRoleBindingRow[]): void {
    this.bindings.set(userId, bindings);
  }

  /** 认证支撑用例的凭据注入口（UserView 不含敏感列）。 */
  setCredential(userId: string, passwordHash: string | null): void {
    this.credentials.set(userId, passwordHash);
  }

  async findById(id: string): Promise<User | null> {
    const row = this.rows.find((item) => item.id === id);
    return row ? User.reconstitute(row.id, row.status, row.roleIds) : null;
  }

  /**
   * 表格查询内存实现（轻量语义，完整语义由隔离数据库行为测试覆盖）：
   * q 跨 name/username/email OR contains、filters AND、多排序 + id tie-break、offset 分页。
   */
  async queryTable(query: TableQueryRequest): Promise<{
    items: UserView[];
    total: number;
  }> {
    const matched = matchTableRows(
      this.rows as unknown as Array<Record<string, unknown>>,
      query,
      ['name', 'username', 'email'],
    );
    const sorted = sortTableRows(matched, query.sort);
    return {
      total: matched.length,
      items: sorted.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize,
      ) as unknown as UserView[],
    };
  }

  async findViewById(id: string): Promise<UserView | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async saveStatus(user: User): Promise<void> {
    const row = this.mustFind(user.id);
    row.status = user.status;
  }

  async replaceRoles(user: User): Promise<void> {
    this.mustFind(user.id).roleIds = [...user.roleIds];
  }

  async findRoleBindings(userId: string): Promise<UserRoleBindingRow[]> {
    return this.bindings.get(userId) ?? [];
  }

  async findCredentialByUsername(
    username: string,
  ): Promise<UserCredentialView | null> {
    const row = this.rows.find((item) => item.username === username);
    if (!row) return null;
    return this.toCredential(row);
  }

  async existsByUsername(username: string): Promise<boolean> {
    return this.rows.some((row) => row.username === username);
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.rows.some((row) => row.email === email);
  }

  async create(props: {
    username: string;
    name: string;
    email: string | null;
    passwordHash: string;
  }): Promise<UserCredentialView> {
    const row = makeUserRow({
      id: `new-${this.rows.length + 1}`,
      username: props.username,
      name: props.name,
      email: props.email,
    });
    this.rows.push(row);
    this.credentials.set(row.id, props.passwordHash);
    return this.toCredential(row);
  }

  private toCredential(row: UserView): UserCredentialView {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      status: row.status,
      passwordHash: this.credentials.get(row.id) ?? null,
    };
  }

  private mustFind(id: string): UserView {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error(`仓储内不存在用户: ${id}`);
    return row;
  }
}

/** 内存权限点投影。 */
export class FakePermissionPointRepository
  implements PermissionPointRepository
{
  readonly rows: PermissionPointRow[];

  constructor(rows: PermissionPointRow[] = []) {
    this.rows = rows;
  }

  async findAll(): Promise<PermissionPointRow[]> {
    return this.rows.map((row) => ({ ...row }));
  }

  async findActiveCodes(codes: string[]): Promise<string[]> {
    const active = new Set(
      this.rows.filter((row) => row.state === 'active').map((row) => row.code),
    );
    return [...new Set(codes)].filter((code) => active.has(code));
  }

  async create(entry: {
    code: string;
    resource: string;
    action: string;
  }): Promise<void> {
    this.rows.push({ ...entry, summary: null, state: 'active' });
  }

  async activate(code: string): Promise<void> {
    this.mustFind(code).state = 'active';
  }

  async deprecate(code: string): Promise<void> {
    this.mustFind(code).state = 'deprecated';
  }

  async upsertSummary(
    code: string,
    structure: { resource: string; action: string },
    summary: string | null,
  ): Promise<void> {
    const row = this.rows.find((item) => item.code === code);
    if (row) {
      row.summary = summary;
      return;
    }
    this.rows.push({
      code,
      resource: structure.resource,
      action: structure.action,
      summary,
      state: 'active',
    });
  }

  private mustFind(code: string): PermissionPointRow {
    const row = this.rows.find((item) => item.code === code);
    if (!row) throw new Error(`投影内不存在权限点: ${code}`);
    return row;
  }
}
