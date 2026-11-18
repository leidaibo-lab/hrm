import { Inject, Injectable } from '@nestjs/common';
import {
  ACTOR_PERMISSION_PORT,
  type ActorPermissionPort,
} from '../domain/actor-permission.port';
import type {
  ToolAccessInput,
  ToolAccessPort,
} from '../domain/tool-access.port';
import {
  getAgentRole,
  isAgentRoleKey,
  permissionForTool,
} from './runtime/agent-role.helper';

/** 工具级有效权限：角色能力（工具白名单）∩ 触发人权限点。 */
@Injectable()
export class ToolAccessService implements ToolAccessPort {
  constructor(
    @Inject(ACTOR_PERMISSION_PORT)
    private readonly actorPermissions: ActorPermissionPort,
  ) {}

  /** 判定触发人能否让该角色调用工具；权限缺失或未知角色一律拒绝。 */
  async authorize(input: ToolAccessInput): Promise<boolean> {
    if (!input.actorUserId) return false;
    if (!isAgentRoleKey(input.role)) return false;
    const role = getAgentRole(input.role);
    if (!role.tools.includes(input.tool)) return false;
    const required = permissionForTool(input.tool);
    if (!required) return false;
    const permissions = await this.actorPermissions.permissionsOf(
      input.actorUserId,
    );
    if (!permissions) return false;
    return permissions.includes('*') || permissions.includes(required);
  }
}
