import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './config/env';
import { applyProblemDetailsContract } from './openapi';
import { ProblemDetailsExceptionFilter } from './pipeline/filters';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    credentials: true,
    origin: env.AUTH_ALLOWED_ORIGINS,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new ProblemDetailsExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('CIP API')
    .setVersion('1')
    .setOpenAPIVersion('3.1.0')
    .build();
  const document = applyProblemDetailsContract(
    SwaggerModule.createDocument(app, config),
  );
  // Swagger 端点仅非生产注册（contracts.md 契约管线 5）；生产契约 diff 走离线导出 export:openapi
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  await app.listen(env.PORT);
}

void bootstrap();
