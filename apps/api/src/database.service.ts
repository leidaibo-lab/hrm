import {Injectable, type OnModuleDestroy} from '@nestjs/common';
import {createDatabase} from '@hrm/database';

/** Nest拥有Prisma生命周期，配置在服务端解析，不向浏览器返回连接信息。 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: ReturnType<typeof createDatabase>;

  /** 数据库连接串必须由本地环境或Compose显式注入。 */
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('缺少DATABASE_URL');
    this.client = createDatabase(connectionString);
  }

  /** 使用固定只读查询确认真实数据库可达，不创建业务数据。 */
  async probe(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  /** 应用关闭时释放Prisma客户端及底层连接池。 */
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
