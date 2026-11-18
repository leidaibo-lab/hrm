import { Role } from '../domain/role.entity';

/** Prisma role 行（含权限点绑定）→ 领域聚合；domain ← 持久化形态的唯一翻译点。 */
export function toRoleDomain(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  permissions: Array<{ permissionCode: string }>;
}): Role {
  return Role.reconstitute({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isBuiltin: row.isBuiltin,
    permissionCodes: row.permissions.map((grant) => grant.permissionCode),
  });
}
