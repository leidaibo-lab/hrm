/** API problem 详情，保留机器错误码和追踪信息。 */
export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly traceId?: string;
  readonly errors?: unknown[];

  constructor(
    problem: {
      detail?: string;
      code?: string;
      status?: number;
      traceId?: string;
      errors?: unknown[];
    },
    fallback: string,
  ) {
    super(problem.detail ?? fallback);
    this.name = 'ApiError';
    this.code = problem.code;
    this.status = problem.status;
    this.traceId = problem.traceId;
    this.errors = problem.errors;
  }
}
