import { Injectable } from '@nestjs/common';
import { UserService } from '../../iam/application/user.service';
import type { ActorPermissionPort } from '../domain/actor-permission.port';

/** 触发人权限解析：复用 IAM 会话用户读模型（权限点实时展开）。 */
@Injectable()
export class IamActorPermissionService implements ActorPermissionPort {
  constructor(private readonly users: UserService) {}

  /** 返回用户实时权限点；不存在/非 active 返回 null。 */
  async permissionsOf(userId: string): Promise<string[] | null> {
    const user = await this.users.findSessionUser(userId);
    return user?.permissions ?? null;
  }
}
