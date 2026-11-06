import {Controller, Get, Inject, ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database.service.js';

/** 运维探针只返回固定状态，不披露数据库连接、异常或业务数据。 */
@Controller('health')
export class HealthController {
  /** 注入由应用模块管理的数据库服务。 */
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 存活检查独立于数据库，供进程诊断使用。 */
  @Get('live')
  live(): {status: 'ok'} { return {status: 'ok'}; }

  /** 就绪检查依赖真实数据库；失败返回固定503，允许外部重试。 */
  @Get('ready')
  async ready(): Promise<{status: 'ok'; database: 'ok'}> {
    try {
      await this.database.probe();
      return {status: 'ok', database: 'ok'};
    } catch {
      throw new ServiceUnavailableException('数据库尚未就绪');
    }
  }
}
