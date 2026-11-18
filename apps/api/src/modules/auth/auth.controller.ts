import {
  SESSION_COOKIE_NAME,
  type Session,
  sessionSchema,
  sessionUserSchema,
} from '@cip/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { toOpenApiSchema } from '../../openapi';
import { Audit } from '../../pipeline/audit';
import type { SessionUser } from '../../pipeline/guards';
import { CurrentUser, Public } from '../../pipeline/guards';
import { ZodValidationPipe } from '../../pipeline/pipes';
import { RateLimitService } from '../../pipeline/rate-limit';
import { AuthService } from './application/auth.service';
import { type LoginInput, loginSchema } from './dto/login.dto';
import { type RegisterInput, registerSchema } from './dto/register.dto';

/** 认证端点限流规则：按请求 IP 固定窗口计数。 */
const LOGIN_RULE = { limit: 10, windowSeconds: 60 } as const;
const REGISTER_RULE = { limit: 5, windowSeconds: 60 } as const;

/** 会话 cookie 属性：全端统一；cookie 属传输边界，写入与清除收口在本层（ADR-0016）。 */
function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
    path: '/',
  };
}

/** 认证端点：登录 / 注册 / 登出 / 会话读取。应用层返回 sid，cookie 由本层经 passthrough 响应写入。 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Audit('auth.login')
  @ApiBody({ schema: toOpenApiSchema(loginSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(sessionUserSchema) })
  @ApiOperation({ summary: '用户登录' })
  async login(
    @Req() request: Request,
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    await this.rateLimit.assertWithin(`login:${request.ip}`, LOGIN_RULE);
    const { user, sid } = await this.authService.login(dto);
    response.cookie(SESSION_COOKIE_NAME, sid, buildCookieOptions());
    return sessionUserSchema.parse(user);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Audit('auth.register')
  @ApiBody({ schema: toOpenApiSchema(registerSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(sessionUserSchema) })
  @ApiOperation({ summary: '用户注册' })
  async register(
    @Req() request: Request,
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    await this.rateLimit.assertWithin(`register:${request.ip}`, REGISTER_RULE);
    const { user, sid } = await this.authService.register(dto);
    response.cookie(SESSION_COOKIE_NAME, sid, buildCookieOptions());
    return sessionUserSchema.parse(user);
  }

  /** 登出幂等：无 cookie 也返回 200，同时清理本地会话。 */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Audit('auth.logout')
  @ApiOperation({ summary: '退出登录' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    const sid = request.cookies?.[SESSION_COOKIE_NAME];
    await this.authService.logout(typeof sid === 'string' ? sid : undefined);
    response.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions());
    return { ok: true };
  }

  /** 会话读取：登录用户返回全量会话（用户 + 权限点 + 合并导航树）。 */
  @Get('me')
  @ApiOkResponse({ schema: toOpenApiSchema(sessionSchema) })
  @ApiOperation({ summary: '读取当前会话' })
  async getMe(@CurrentUser() user: SessionUser): Promise<Session> {
    return this.authService.getMe(user);
  }
}
