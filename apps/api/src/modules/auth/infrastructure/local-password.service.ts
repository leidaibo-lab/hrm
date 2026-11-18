import { ERROR_CODE } from '@cip/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { env } from '../../../config/env';
import { UserService } from '../../iam/application/user.service';
import type {
  AuthenticatedUser,
  AuthProvider,
  LoginInput,
  RegisterInput,
} from '../domain/auth-provider.port';

export const AUTH_PROVIDER_LOCAL = 'local';

/**
 * 本地账密认证 provider：argon2id 哈希与校验。
 * 身份存取经 iam 导出的 UserService（ADR-0016：认证域不直查他域聚合存储）。
 * 凭据错误返回 null（不区分"用户不存在/密码错误"，避免账号枚举）。
 */
@Injectable()
export class LocalPasswordProvider implements AuthProvider {
  readonly kind = AUTH_PROVIDER_LOCAL;

  constructor(private readonly users: UserService) {}

  async authenticate(input: LoginInput): Promise<AuthenticatedUser | null> {
    const user = await this.users.findAuthByUsername(input.username);
    if (!user?.passwordHash || user.status !== 'active') return null;
    const valid = await verify(user.passwordHash, input.password).catch(
      () => false,
    );
    if (!valid) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
    };
  }

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    // 邮箱域白名单：非空配置时仅允许列表内域注册（内部平台防滥注册的第一道闸）
    if (env.AUTH_ALLOWED_EMAIL_DOMAINS.length > 0) {
      const domain = input.email.split('@')[1]?.toLowerCase() ?? '';
      if (!env.AUTH_ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        throw new BadRequestException({
          code: ERROR_CODE.request.invalid,
          message: '该邮箱域不被允许注册',
        });
      }
    }
    if (await this.users.existsByUsername(input.username)) {
      throw new ConflictException({
        code: ERROR_CODE.user.usernameTaken,
        message: '用户名已被占用',
      });
    }
    if (input.email && (await this.users.existsByEmail(input.email))) {
      throw new ConflictException({
        code: ERROR_CODE.user.usernameTaken,
        message: '邮箱已被占用',
      });
    }
    const passwordHash = await hash(input.password);
    const user = await this.users.create({
      username: input.username,
      name: input.name,
      email: input.email,
      passwordHash,
    });
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
    };
  }
}
