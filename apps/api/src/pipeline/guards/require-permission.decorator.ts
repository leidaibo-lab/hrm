import type { PermissionCode } from '@cip/shared';
import { SetMetadata } from '@nestjs/common';

/** 元数据键：端点所需的权限点集合（全部满足）。 */
export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * 声明端点所需权限点；权限点必须引用 shared 目录常量，禁止字面量。
 * @param codes - 所需权限点，全部满足才放行。
 * @example @RequirePermission(PERMISSION.user.manage.code)
 */
export const RequirePermission = (
  ...codes: PermissionCode[]
): MethodDecorator => SetMetadata(REQUIRE_PERMISSION_KEY, codes);
