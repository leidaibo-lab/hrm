import { SetMetadata } from '@nestjs/common';

/** 元数据键：跳过认证与授权 guard 的公开端点。 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记公开端点：跳过认证与授权。
 * 仅限 auth 端点与探针。
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
