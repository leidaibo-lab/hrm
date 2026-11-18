import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AuthService } from './application/auth.service';
import { SessionService } from './application/session.service';
import { AuthController } from './auth.controller';
import { AUTH_PROVIDER } from './domain/auth-provider.port';
import { SESSION_REPOSITORY } from './domain/session.repository';
import { LocalPasswordProvider } from './infrastructure/local-password.service';
import { RedisSessionRepository } from './infrastructure/session.redis.repository';

/**
 * 认证域：登录、注册、会话、/me 与认证 guard。分层见 ADR-0014：端口在 domain，实现绑在 infrastructure。
 * SessionService 导出供全局 SessionGuard（app.module APP_GUARD 注册）读取会话；
 * 会话键与 payload 解析单源于 RedisSessionRepository（ADR-0016）。
 */
@Module({
  imports: [IamModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    { provide: AUTH_PROVIDER, useClass: LocalPasswordProvider },
    { provide: SESSION_REPOSITORY, useClass: RedisSessionRepository },
  ],
  exports: [SessionService],
})
export class AuthModule {}
