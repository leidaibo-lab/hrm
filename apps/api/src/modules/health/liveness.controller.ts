import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { toOpenApiSchema } from '../../openapi';
import { Public } from '../../pipeline/guards';

/** 响应 DTO 也是 zod schema：出站 parse 兼做白名单剥离，未登记字段不外泄。 */
const livenessSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

type Liveness = z.infer<typeof livenessSchema>;

/** 存活探针：进程活着即 200，不依赖任何外部资源。 */
@ApiTags('health')
@Controller('healthz')
@Public()
export class HealthLivenessController {
  @Get()
  @ApiOperation({ summary: '存活探针' })
  @ApiOkResponse({ schema: toOpenApiSchema(livenessSchema) })
  getLiveness(): Liveness {
    return livenessSchema.parse({ status: 'ok', uptime: process.uptime() });
  }
}
