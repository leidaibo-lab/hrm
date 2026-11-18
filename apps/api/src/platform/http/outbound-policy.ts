import { env } from '../../config/env';

/** 出站地址违反策略：协议、内嵌凭据或目标主机落在白名单外。 */
export class OutboundUrlViolationError extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`出站地址违反策略（${reason}）: ${url}`);
    this.name = 'OutboundUrlViolationError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

/** 保留主机名后缀：解析到私网/内网命名空间，一律视为内网目标。 */
const BLOCKED_HOSTNAME_SUFFIXES = [
  '.internal',
  '.local',
  '.lan',
  '.home.arpa',
  '.corp',
];

/**
 * 出站地址策略（ADR-0038）：供应商 baseUrl 等管理员可配置的出站目标不能只做 URL 格式校验。
 * 策略：协议仅 http/https、拒绝内嵌凭据、阻断环回/私网/链路本地等保留网段与内网主机名后缀；
 * `OUTBOUND_ALLOW_PRIVATE_HOSTS` 为显式豁免清单（本地供应商联调），默认空 = 全部阻断。
 * 残余风险（DNS 重绑定 TOCTOU、上游重定向）由 ADR-0038 登记并按缓解次序跟进。
 */
export function assertOutboundUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new OutboundUrlViolationError(rawUrl, 'URL 无法解析');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new OutboundUrlViolationError(
      rawUrl,
      `协议 ${parsed.protocol} 不在白名单`,
    );
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new OutboundUrlViolationError(rawUrl, '不允许内嵌凭据');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const reason = blockedHostReason(host);
  if (reason) {
    throw new OutboundUrlViolationError(rawUrl, reason);
  }
}

/** 主机被阻断的原因；null = 允许出站。 */
function blockedHostReason(host: string): string | null {
  if (env.OUTBOUND_ALLOW_PRIVATE_HOSTS.includes(host)) return null;
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return '环回主机';
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return '内网主机名后缀';
  }
  const ipv4 = parseIpv4(host);
  if (ipv4) return privateIpv4Reason(ipv4);
  if (host.includes(':')) return privateIpv6Reason(host);
  return null;
}

/** 严格 IPv4 字面量解析：四段十进制、每段 0-255；非字面量返回 null。 */
function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets as [number, number, number, number];
}

/** IPv4 保留网段：未指定、私网、CGNAT、环回、链路本地（含云元数据 169.254.169.254）。 */
function privateIpv4Reason(
  ip: [number, number, number, number],
): string | null {
  const [a, b] = ip;
  if (a === 0) return '未指定网段';
  if (a === 10) return '私网网段';
  if (a === 100 && b >= 64 && b <= 127) return 'CGNAT 网段';
  if (a === 127) return '环回网段';
  if (a === 169 && b === 254) return '链路本地网段';
  if (a === 172 && b >= 16 && b <= 31) return '私网网段';
  if (a === 192 && b === 168) return '私网网段';
  return null;
}

/** IPv6 展开后的固定 8 组十六段。 */
type Ipv6Groups = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** IPv6 展开为 8 组十六段：支持 `::` 缩写；URL 解析已把字面量规范化为十六进制形态（如 ::ffff:7f00:1）。 */
function expandIpv6(host: string): Ipv6Groups | null {
  const halves = host.split('::');
  if (halves.length > 2) return null;
  const parseGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups = part.split(':').map((group) => {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      return parseInt(group, 16);
    });
    return groups.includes(null) ? null : (groups as number[]);
  };
  const head = parseGroups(halves[0] ?? '');
  const tail = halves.length === 2 ? parseGroups(halves[1] ?? '') : [];
  if (!head || !tail) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const groups = [...head, ...Array<number>(fill).fill(0), ...tail];
  return [
    groups[0] ?? 0,
    groups[1] ?? 0,
    groups[2] ?? 0,
    groups[3] ?? 0,
    groups[4] ?? 0,
    groups[5] ?? 0,
    groups[6] ?? 0,
    groups[7] ?? 0,
  ];
}

/** IPv6 保留网段：环回（::1）、未指定（::）、唯一本地（fc00::/7）、链路本地（fe80::/10）、v4 映射（::ffff:0:0/96）。 */
function privateIpv6Reason(host: string): string | null {
  const groups = expandIpv6(host);
  if (!groups) return null;
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff
  ) {
    const v4: [number, number, number, number] = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ];
    return privateIpv4Reason(v4) ?? null;
  }
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) {
    return '环回地址';
  }
  if (groups.every((group) => group === 0)) return '未指定地址';
  const first = groups[0];
  if (first >= 0xfc00 && first <= 0xfdff) return '唯一本地网段';
  if (first >= 0xfe80 && first <= 0xfebf) return '链路本地网段';
  return null;
}
