/** 数据库客户端工厂；调用方拥有连接生命周期，包不创建全局连接。 */
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/client/client.js';

/** 使用显式连接配置创建客户端，连接失败由应用启动或就绪检查处理。 */
export function createDatabase(connectionString: string): PrismaClient {
  return new PrismaClient({adapter: new PrismaPg({connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000})});
}
