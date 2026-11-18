import { describe, expect, it } from 'vitest';
import { CryptoService } from '../crypto.service';

/** CREDENTIAL_MASTER_KEY 由测试环境 .env 注入（32 字节 base64）。 */
describe('CryptoService', () => {
  const service = new CryptoService();

  it('加密后可解密还原', () => {
    const plaintext = 'sk-1234567890abcdef-中文密钥';
    expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
  });

  it('逐值随机 IV：同一明文两次密文不同，且均可解密', () => {
    const plaintext = 'same-input';
    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);
    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe(plaintext);
    expect(service.decrypt(second)).toBe(plaintext);
  });

  it('密文被篡改时解密抛出（GCM 认证失败）', () => {
    const payload = Buffer.from(service.encrypt('tamper-target'), 'base64');
    payload[payload.length - 1] ^= 0xff;
    expect(() => service.decrypt(payload.toString('base64'))).toThrow();
  });

  it('非法格式密文抛出而非返回内容', () => {
    expect(() => service.decrypt('short')).toThrow();
    expect(() => service.decrypt('!!!not-base64!!!')).toThrow();
  });
});
