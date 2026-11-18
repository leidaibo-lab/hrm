import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envSchema } from '../env';

/** .env.example 必须覆盖 env schema 全部键（超集关系）：schema 加键忘改 example 直接红。 */
describe('env schema 与 .env.example 一致性', () => {
  it('.env.example 覆盖 schema 全部键', () => {
    // api 包为 CJS 编译，import.meta 不可用；vitest 的 cwd 是包根
    const examplePath = join(process.cwd(), '.env.example');
    const exampleKeys = new Set(
      readFileSync(examplePath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .map((line) => line.split('=')[0]),
    );
    const schemaKeys = Object.keys(envSchema.shape);
    const missing = schemaKeys.filter((key) => !exampleKeys.has(key));
    expect(missing).toEqual([]);
  });
});
