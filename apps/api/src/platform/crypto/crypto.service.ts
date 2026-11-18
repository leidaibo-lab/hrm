import {
  type CipherGCMTypes,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../../config/env';

const ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * 公共加解密适配器（ADR-0015）：AES-256-GCM 认证加密，逐值随机 IV。
 * 主密钥来自 env（CREDENTIAL_MASTER_KEY，32 字节 base64），仅供部署注入。
 * 密文格式：base64(iv ‖ authTag ‖ ciphertext)，内部约定，永不进入日志。
 */
@Injectable()
export class CryptoService {
  /**
   * 加密明文为密文。
   * @param plaintext - UTF-8 明文。
   * @returns base64(iv ‖ authTag ‖ ciphertext)。
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64',
    );
  }

  /**
   * 解密 {@link encrypt} 产出的密文；认证失败抛出，不返回明文。
   * @param payload - base64(iv ‖ authTag ‖ ciphertext)。
   */
  decrypt(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    if (raw.length <= IV_BYTES + AUTH_TAG_BYTES) {
      throw new Error('密文长度不合法');
    }
    const iv = raw.subarray(0, IV_BYTES);
    const authTag = raw.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.key(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const key = Buffer.from(env.CREDENTIAL_MASTER_KEY, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(
        'CREDENTIAL_MASTER_KEY 必须是 32 字节（256 位）密钥的 base64 编码',
      );
    }
    return key;
  }
}
