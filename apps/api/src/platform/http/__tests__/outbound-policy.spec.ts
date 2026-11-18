import { describe, expect, it, vi } from 'vitest';
import {
  assertOutboundUrl,
  OutboundUrlViolationError,
} from '../outbound-policy';

/** 出站策略（ADR-0038）：协议白名单、内嵌凭据、环回/私网/保留网段、内网主机名后缀与显式豁免。 */
describe('assertOutboundUrl', () => {
  it.each([
    'https://api.openai.com/v1',
    'http://models.dev/api.json',
    'https://api.provider.example:8443/v1/models',
  ])('公网地址放行: %s', (url) => {
    expect(() => assertOutboundUrl(url)).not.toThrow();
  });

  it.each([
    'ftp://models.dev/api.json',
    'file:///etc/passwd',
    'data:text/plain,hello',
  ])('非 http(s) 协议拒绝: %s', (url) => {
    expect(() => assertOutboundUrl(url)).toThrow(OutboundUrlViolationError);
  });

  it('内嵌凭据拒绝', () => {
    expect(() =>
      assertOutboundUrl('https://user:pass@api.example.com'),
    ).toThrow(OutboundUrlViolationError);
  });

  it('无法解析的字符串拒绝', () => {
    expect(() => assertOutboundUrl('not-a-url')).toThrow(
      OutboundUrlViolationError,
    );
  });

  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'https://10.0.0.5/v1',
    'https://172.16.0.9/v1',
    'https://172.31.255.1/v1',
    'https://192.168.1.10/v1',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/v1',
    'https://0.0.0.0/v1',
    'https://[::1]/v1',
    'https://[fd00::1]/v1',
    'https://[fe80::1]/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://box.internal/v1',
    'https://nas.local/v1',
  ])('环回/私网/保留网段与内网后缀拒绝: %s', (url) => {
    expect(() => assertOutboundUrl(url)).toThrow(OutboundUrlViolationError);
  });

  it.each([
    'https://172.32.0.1/v1',
    'https://100.128.0.1/v1',
    'https://metadata.example.com/api',
  ])('边界外地址放行: %s', (url) => {
    expect(() => assertOutboundUrl(url)).not.toThrow();
  });

  it('显式豁免清单内的主机放行（OUTBOUND_ALLOW_PRIVATE_HOSTS）', async () => {
    vi.stubEnv('OUTBOUND_ALLOW_PRIVATE_HOSTS', 'localhost,192.168.1.10');
    vi.resetModules();
    // resetModules 后是新的模块实例：错误类引用取自重导入的模块
    const exempt = await import('../outbound-policy.js');
    expect(() =>
      exempt.assertOutboundUrl('http://localhost:11434/v1'),
    ).not.toThrow();
    expect(() =>
      exempt.assertOutboundUrl('https://192.168.1.10/v1'),
    ).not.toThrow();
    expect(() => exempt.assertOutboundUrl('https://192.168.1.11/v1')).toThrow(
      exempt.OutboundUrlViolationError,
    );
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
