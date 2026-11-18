import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** 技术能力适配器模块：全局单例，业务模块注入 CryptoService 做字段级加解密（ADR-0015）。 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
