import { defineConfig } from '@hey-api/openapi-ts';

// 契约管线：input 指向 NestJS Swagger 的 OpenAPI JSON。
// 产物 lib/api-client 不入 git，构建/开发前生成。
// 0.99 起 fetch client 内置于 openapi-ts，以 plugin 名启用（独立包已弃用）。
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? 'http://localhost:3011/api/v1/docs-json',
  output: {
    path: 'lib/api-client',
    module: { extension: null },
  },
  plugins: ['@hey-api/client-fetch'],
});
