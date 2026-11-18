import { ERROR_CODE, type Session, sessionSchema } from '@cip/shared';
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from '../../../config/env';
import { NavigationService } from '../../iam/application/navigation.service';
import type {
  AuthenticatedUser,
  AuthProvider,
  LoginInput,
  RegisterInput,
} from '../domain/auth-provider.port';
import { AUTH_PROVIDER } from '../domain/auth-provider.port';
import { SessionService } from './session.service';

/** 会话用户上下文：共享契约的用户字段 + 展开后的权限点，避免应用层依赖请求管线类型。 */
type SessionUserContext = Session['user'] & { permissions: string[] };

/**
 * 认证应用服务：编排 provider 认证、会话建立与 /me 组装。
 * provider 经端口注入（可插拔）；导航树由 iam 域导出服务提供。
 * 会话 cookie 属传输边界：写入与清除由 controller 负责，本层只产出/撤销 sid（ADR-0016）。
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly sessionService: SessionService,
    private readonly navigationService: NavigationService,
  ) {}

  /** 凭据错误统一为 401，不区分"用户不存在/密码错误"（防账号枚举）。 */
  async login(
    dto: LoginInput,
  ): Promise<{ user: AuthenticatedUser; sid: string }> {
    const user = await this.provider.authenticate(dto);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODE.auth.invalidCredentials,
        message: '用户名或密码错误',
      });
    }
    const sid = await this.sessionService.create(user.id);
    return { user, sid };
  }

  /** 注册开关（AUTH_REGISTRATION_ENABLED）与 provider 能力双重校验。 */
  async register(
    dto: RegisterInput,
  ): Promise<{ user: AuthenticatedUser; sid: string }> {
    if (!env.AUTH_REGISTRATION_ENABLED || !this.provider.register) {
      throw new ForbiddenException({
        code: ERROR_CODE.auth.registerDisabled,
        message: '注册未开放',
      });
    }
    const user = await this.provider.register(dto);
    const sid = await this.sessionService.create(user.id);
    return { user, sid };
  }

  /** 撤销会话；cookie 清除由 controller 负责（传输边界，ADR-0016）。 */
  async logout(sid: string | undefined): Promise<void> {
    if (sid) await this.sessionService.revoke(sid);
  }

  /**
   * /me 组装：会话用户 + 实时权限点 + 合并导航树；出站 sessionSchema.parse 白名单。
   * @param user - SessionGuard 挂载的请求上下文用户。
   */
  async getMe(user: SessionUserContext): Promise<Session> {
    const navigation = await this.navigationService.getTree(user.permissions);
    return sessionSchema.parse({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
      permissions: user.permissions,
      navigation,
    });
  }
}
