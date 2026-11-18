import { client } from '@/lib/api-client/client.gen';
import { env } from '@/lib/env';

// 生成的 client 单例：baseUrl 仅配 origin（SDK 路径已带 /api/v1 前缀）。SSR 与浏览器共用同一份配置。
// credentials 必开：sid 会话 cookie 随跨端口请求携带。
// 产物 lib/api-client 不入 git，先运行 pnpm --filter @cip/web codegen。
client.setConfig({
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
  credentials: 'include',
});

export { client };
