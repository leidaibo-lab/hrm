import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { exportOpenApi } from '../testing/openapi.helper';

describe('无服务 OpenAPI 导出', () => {
  it('保留真实路由、path 参数和响应合同，不访问网络且移除并发版本字段', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cip-openapi-'));
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('导出禁止网络'));
    try {
      const output = join(dir, 'openapi.json');
      await exportOpenApi(output);
      const document = JSON.parse(readFileSync(output, 'utf8'));
      const detail = document.paths['/api/v1/roles/{id}'].get;
      expect(detail.parameters).toContainEqual(
        expect.objectContaining({
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        }),
      );
      const properties =
        detail.responses['200'].content['application/json'].schema.properties;
      expect(properties).toHaveProperty('permissionCodes');
      expect(properties).not.toHaveProperty('version');
      expect(document.paths).toHaveProperty('/api/v1/ai/providers/{id}/import');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
