import type { UserStatus } from '../domain/user.entity';
import { User } from '../domain/user.entity';

/** Prisma user 行（含角色绑定）→ 领域聚合；domain ← 持久化形态的唯一翻译点。 */
export function toUserDomain(row: {
  id: string;
  status: UserStatus;
  roles: Array<{ roleId: string }>;
}): User {
  return User.reconstitute(
    row.id,
    row.status,
    row.roles.map((binding) => binding.roleId),
  );
}
