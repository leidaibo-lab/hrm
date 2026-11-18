import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CandidateEntry } from '../domain/candidate.entity';
import { LogicalModelEntity } from '../domain/logical-model.entity';
import {
  MODEL_REPOSITORY,
  type ModelRepository,
} from '../domain/model.repository';
import { ProviderEntity } from '../domain/provider.entity';
import {
  PROVIDER_REPOSITORY,
  type ProviderRepository,
} from '../domain/provider.repository';
import type { RoutingSnapshot, SnapshotPort } from '../domain/runtime.port';

/** 快照有效期：配置写入后由 invalidate 立即失效，最长陈旧 10s。 */
const SNAPSHOT_TTL_MS = 10_000;

/**
 * 路由快照装配：providers + logical models + candidates 一次装入内存。
 * DB 故障时回退上一版并告警；首次加载失败向上抛错。
 */
@Injectable()
export class SnapshotService implements SnapshotPort {
  private readonly logger = new Logger(SnapshotService.name);
  private cache: { value: RoutingSnapshot; expiresAt: number } | null = null;
  private loading: Promise<RoutingSnapshot> | null = null;

  constructor(
    @Inject(PROVIDER_REPOSITORY)
    private readonly providers: ProviderRepository,
    @Inject(MODEL_REPOSITORY)
    private readonly models: ModelRepository,
  ) {}

  async get(): Promise<RoutingSnapshot> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.value;
    }
    if (this.loading) return this.loading;
    const loading = this.load().finally(() => {
      this.loading = null;
    });
    this.loading = loading;
    return loading;
  }

  /** 配置、价格、汇率、同步写入后调用，下一读重新装配。 */
  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<RoutingSnapshot> {
    try {
      const [providerRows, logicalRows, candidateRows] = await Promise.all([
        this.providers.list(),
        this.models.listLogical(),
        this.models.listCandidatesWithProvider(),
      ]);
      const providers = new Map<string, ProviderEntity>();
      for (const row of providerRows) {
        providers.set(
          row.id,
          new ProviderEntity(
            row.id,
            row.slug,
            row.enabled,
            row.health,
            row.openUntil,
            {
              protocol: row.protocol,
              baseUrl: row.baseUrl,
              apiKeyCipher: row.apiKeyCipher,
              catalogProviderId: row.catalogProviderId,
              timeoutMs: row.timeoutMs,
              rateLimitPerMinute: row.rateLimitPerMinute,
              maxConcurrent: row.maxConcurrent,
            },
          ),
        );
      }
      const logicalByKey = new Map<string, LogicalModelEntity>();
      for (const row of logicalRows) {
        logicalByKey.set(
          row.logicalKey,
          new LogicalModelEntity(
            row.id,
            row.logicalKey,
            row.enabled,
            row.maxAttempts,
          ),
        );
      }
      const candidatesByLogical = new Map<string, CandidateEntry[]>();
      for (const row of candidateRows) {
        const entry: CandidateEntry = {
          id: row.id,
          logicalModelId: row.logicalModelId,
          providerId: row.providerId,
          providerSlug: row.providerSlug,
          providerModelId: row.providerModelId,
          priority: row.priority,
          enabled: row.enabled,
          capabilities: row.capabilities,
          providerEnabled: row.providerEnabled,
          providerHealth: row.providerHealth,
          providerOpenUntil: row.providerOpenUntil,
        };
        const list = candidatesByLogical.get(row.logicalModelId) ?? [];
        list.push(entry);
        candidatesByLogical.set(row.logicalModelId, list);
      }
      const snapshot: RoutingSnapshot = {
        providers,
        logicalByKey,
        candidatesByLogical,
      };
      this.cache = {
        value: snapshot,
        expiresAt: Date.now() + SNAPSHOT_TTL_MS,
      };
      return snapshot;
    } catch (cause) {
      if (this.cache) {
        this.logger.warn(
          `快照刷新失败，回退上一版: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
        return this.cache.value;
      }
      throw cause;
    }
  }
}
