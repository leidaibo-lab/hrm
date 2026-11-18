// 测试进程独立配置；禁止加载开发者凭据或连接真实外部服务。
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://test:test@127.0.0.1:5432/cip_test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.CREDENTIAL_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.AUTH_ALLOWED_EMAIL_DOMAINS = '';
