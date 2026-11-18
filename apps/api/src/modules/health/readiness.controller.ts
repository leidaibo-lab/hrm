import { ERROR_CODE } from '@cip/shared';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { Public } from '../../pipeline/guards';
import { PrismaService } from '../../platform/prisma';
import { RedisService } from '../../platform/redis';

const readinessSchema = z.object({
  status: z.literal('ready'),
  checks: z.object({ db: z.literal('up'), redis: z.literal('up') }),
});

type Readiness = z.infer<typeof readinessSchema>;

/** 就绪探针：依赖可用才 200；数据库或 Redis 缺席返回 503 problem+json。 */
@ApiTags('health')
@Controller('readyz')
@Public()
export class HealthReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOkResponse({ schema: toOpenApiSchema(readinessSchema) })
  @ApiOperation({ summary: '就绪探针' })
  async getReadiness(): Promise<Readiness> {
    const [dbUp, redisUp] = await Promise.all([
      this.prisma.probeDb(),
      this.redis.probeRedis(),
    ]);
    if (!dbUp) {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.health.dbUnavailable,
        message: '数据库不可用',
      });
    }
    if (!redisUp) {
      throw new ServiceUnavailableException({
        code: ERROR_CODE.health.redisUnavailable,
        message: 'Redis 不可用',
      });
    }
    return { status: 'ready', checks: { db: 'up', redis: 'up' } };
  }
}
