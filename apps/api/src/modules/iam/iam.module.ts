import { Module } from '@nestjs/common';
import { NavigationService } from './application/navigation.service';
import { PermissionService } from './application/permission.service';
import { RoleService } from './application/role.service';
import { SyncService } from './application/sync.service';
import { UserService } from './application/user.service';
import { NAVIGATION_NODE_REPOSITORY } from './domain/navigation-node.repository';
import { PERMISSION_POINT_REPOSITORY } from './domain/permission-point.repository';
import { ROLE_REPOSITORY } from './domain/role.repository';
import { USER_REPOSITORY } from './domain/user.repository';
import { NavigationNodePrismaRepository } from './infrastructure/navigation-node.prisma.repository';
import { PermissionPointPrismaRepository } from './infrastructure/permission-point.prisma.repository';
import { RolePrismaRepository } from './infrastructure/role.prisma.repository';
import { UserPrismaRepository } from './infrastructure/user.prisma.repository';
import { NavigationController } from './navigation.controller';
import { PermissionPointController } from './permission-point.controller';
import { RoleController } from './role.controller';
import { UserController } from './user.controller';

/**
 * iam 域（身份与访问管理配置面）：用户 / 角色 / 权限点 / 导航覆盖。
 * 分层见 ADR-0014：application 经 domain 端口令牌绑定 infrastructure 实现。
 * 权限展开与导航树经 exports 供 auth 模块（/me）消费；模块间只经导出 Service。
 */
@Module({
  controllers: [
    UserController,
    RoleController,
    PermissionPointController,
    NavigationController,
  ],
  providers: [
    UserService,
    RoleService,
    PermissionService,
    NavigationService,
    SyncService,
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
    { provide: ROLE_REPOSITORY, useClass: RolePrismaRepository },
    {
      provide: PERMISSION_POINT_REPOSITORY,
      useClass: PermissionPointPrismaRepository,
    },
    {
      provide: NAVIGATION_NODE_REPOSITORY,
      useClass: NavigationNodePrismaRepository,
    },
  ],
  exports: [PermissionService, NavigationService, UserService],
})
export class IamModule {}
