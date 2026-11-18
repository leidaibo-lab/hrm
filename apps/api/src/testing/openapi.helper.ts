import './__tests__/env.fixture';
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { RequestMethod, type Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { applyProblemDetailsContract } from '../openapi';

function collectControllers(moduleClass: Type, seen = new Set<Type>()): Type[] {
  if (seen.has(moduleClass)) return [];
  seen.add(moduleClass);
  const controllers = (Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    moduleClass,
  ) ?? []) as Type[];
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ??
    []) as Array<Type | { module: Type }>;
  return [
    ...controllers,
    ...imports.flatMap((item) =>
      collectControllers(typeof item === 'function' ? item : item.module, seen),
    ),
  ];
}

/** 仅装载真实 controller 元数据；依赖用替身，不初始化业务模块、存储或监听端口。 */
export async function exportOpenApi(output: string): Promise<void> {
  const module = await Test.createTestingModule({
    controllers: collectControllers(AppModule),
  })
    .useMocker(() => ({}))
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'healthz', method: RequestMethod.GET },
        { path: 'readyz', method: RequestMethod.GET },
      ],
    });
    const document = applyProblemDetailsContract(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('CIP API')
          .setVersion('1')
          .setOpenAPIVersion('3.1.0')
          .build(),
      ),
    );
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
    console.log(`OpenAPI exported without services: ${output}`);
  } finally {
    await app.close();
  }
}

if (process.argv[1]?.endsWith('openapi.helper.ts')) {
  void exportOpenApi(
    resolve(process.env.OPENAPI_OUTPUT ?? 'node_modules/.tmp/openapi.json'),
  );
}
