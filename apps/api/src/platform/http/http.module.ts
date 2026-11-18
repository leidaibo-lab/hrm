import { Global, Module } from '@nestjs/common';
import { HttpService } from './http.service';

/** 技术能力适配器模块：全局单例，业务模块注入 HttpService 访问外部 HTTP 资源（ADR-0015）。 */
@Global()
@Module({
  providers: [HttpService],
  exports: [HttpService],
})
export class HttpModule {}
