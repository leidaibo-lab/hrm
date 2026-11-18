import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { envSchema } from '../env';

/** .env.example 必须覆盖 env schema 全部键（超集关系）：schema 加键忘改 example 直接红。 */
describe('env schema 与 .env.example 一致性', () => {
  it('.env.example 覆盖 schema 全部键', () => {
    const examplePath = fileURLToPath(
      new URL('../../.env.example', import.meta.url),
    );
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
