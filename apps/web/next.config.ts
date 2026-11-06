import type {NextConfig} from 'next';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
const config: NextConfig = {
  experimental: {cpus: 1},
  /** 浏览器使用同源API；上游只从受信任的服务端部署配置读取。 */
  async rewrites() {
    return [{source: '/api/:path*', destination: `${apiOrigin}/api/:path*`}];
  },
};
export default config;
