import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** 单字段校验错误：path 为点分字段路径。 */
export type FieldError = {
  /** 路径。 */ path: string;
  /** 校验错误信息。 */
  message: string;
};

/** 携带 zod 字段级错误的 400 异常；由全局 ProblemDetails 过滤器转为 errors[]。 */
export class ZodValidationException extends BadRequestException {
  constructor(public readonly fieldErrors: FieldError[]) {
    super({
      code: 'request.invalid',
      message: '请求参数无效',
      errors: fieldErrors,
    });
  }
}

/**
 * zod 校验管道：校验失败抛 ZodValidationException，经全局过滤器转为 errors[]。
 * @example @Body(new ZodValidationPipe(createProjectSchema))
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  /**
   * @param _metadata - Nest 管道元数据，本管道不使用。
   * @returns 经 schema 解析后的数据，未登记字段已被剥离。
   * @throws 负载不符合 schema 时抛 {@link ZodValidationException}。
   */
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors: FieldError[] = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      throw new ZodValidationException(fieldErrors);
    }
    return result.data;
  }
}
