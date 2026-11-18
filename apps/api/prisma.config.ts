import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7：连接串与迁移路径统一在 config 管理（schema 不再承载 url）。
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // seed 经 tsx 运行：api 产物为 CJS，node 原生 strip-types 以 ESM 解析会因无扩展名路径失败
    seed: 'pnpm exec tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
