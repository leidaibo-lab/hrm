import { z } from 'zod';

/**
 * 前端环境变量 schema：baseUrl 只配 origin，路径前缀由生成 SDK 携带。
 * NEXT_PUBLIC_ 变量会打进浏览器包体，仅限非敏感配置。
 */
export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url().default('http://localhost:3011'),
});

/** 前端环境变量；缺失或非法时在模块加载处即抛错。 */
export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
