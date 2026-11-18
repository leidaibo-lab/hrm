import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** 全局基础设施模块：业务模块直接注入 PrismaService，无需重复 import。 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
