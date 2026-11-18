'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdmissionRules,
  useCurrentPolicy,
  usePublishAdmissionRules,
  usePublishPolicy,
} from '../api/policies';
import { useSources } from '../api/sources';

/** 准入表：按当前策略读取。 */
function AdmissionRules({ policyId }: { policyId?: string }) {
  const rules = useAdmissionRules(policyId);
  const publish = usePublishAdmissionRules(policyId);
  const sources = useSources();
  const [sourceId, setSourceId] = useState('');
  const [scopeRow, setScopeRow] = useState('');
  const [cell, setCell] = useState<
    'listed_unaddressed' | 'unlisted_addressed' | 'unlisted_unaddressed'
  >('listed_unaddressed');
  const [allowed, setAllowed] = useState(true);

  if (rules.isPending)
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (rules.isError)
    return (
      <p className="text-sm text-destructive">
        准入表加载失败：{rules.error.message}
      </p>
    );
  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-medium">准入表</h3>
      {rules.data.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          当前策略没有准入规则。
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rules.data.map((rule) => (
            <li key={rule.id}>
              {rule.sourceInstanceId} · {rule.scopeRow} · {rule.cell} ·{' '}
              {rule.allowed ? '允许' : '拒绝'}
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          publish.mutate(
            {
              sourceInstanceId: sourceId.trim(),
              scopeRow: scopeRow.trim(),
              cell,
              allowed,
            },
            {
              onSuccess: () => {
                setSourceId('');
                setScopeRow('');
              },
            },
          );
        }}
      >
        <select
          aria-label="来源实例"
          className="h-9 max-w-[200px] rounded-md border bg-background px-2 text-sm"
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        >
          <option value="">选择来源实例</option>
          {(sources.data ?? []).map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
        <Input
          aria-label="范围行"
          className="max-w-[160px]"
          placeholder="范围行"
          value={scopeRow}
          onChange={(event) => setScopeRow(event.target.value)}
        />
        <select
          aria-label="准入单元格"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={cell}
          onChange={(event) => setCell(event.target.value as typeof cell)}
        >
          <option value="listed_unaddressed">已列·未点名</option>
          <option value="unlisted_addressed">未列·点名</option>
          <option value="unlisted_unaddressed">未列·未点名</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowed}
            onChange={(event) => setAllowed(event.target.checked)}
          />
          允许
        </label>
        <Button
          type="submit"
          disabled={
            publish.isPending ||
            sourceId.trim().length === 0 ||
            scopeRow.trim().length === 0
          }
        >
          添加规则
        </Button>
        {publish.isError && (
          <span className="text-sm text-destructive">
            {publish.error.message}
          </span>
        )}
      </form>
    </div>
  );
}

/** 策略配置：准入强度、名单、模型与写回字段。 */
export function PoliciesPanel() {
  const policy = useCurrentPolicy();
  const publish = usePublishPolicy();
  const [acceptMode, setAcceptMode] = useState<'explicit' | 'inferred'>(
    'explicit',
  );
  const [actors, setActors] = useState('');
  const [users, setUsers] = useState('');
  const [assessmentModel, setAssessmentModel] = useState('');
  const [clarificationModel, setClarificationModel] = useState('');
  const [writebackFields, setWritebackFields] = useState('');
  const [auditRedactFields, setAuditRedactFields] = useState('');
  const [escalationOwner, setEscalationOwner] = useState('');

  useEffect(() => {
    const rules = policy.data?.rules ?? {};
    setAcceptMode(
      policy.data?.acceptMode === 'inferred' ? 'inferred' : 'explicit',
    );
    setActors(listOf(rules.allowedActors).join(','));
    setUsers(listOf(rules.allowedUsers).join(','));
    setAssessmentModel(
      typeof rules.assessmentModel === 'string' ? rules.assessmentModel : '',
    );
    setClarificationModel(
      typeof rules.clarificationModel === 'string'
        ? rules.clarificationModel
        : '',
    );
    setWritebackFields(listOf(rules.writebackFields).join(','));
    setAuditRedactFields(listOf(rules.auditRedactFields).join(','));
    setEscalationOwner(
      typeof rules.escalationOwner === 'string' ? rules.escalationOwner : '',
    );
  }, [policy.data]);

  if (policy.isPending) return <Skeleton className="h-40 w-full" />;
  if (policy.isError)
    return (
      <p className="text-sm text-destructive">
        策略加载失败：{policy.error.message}
      </p>
    );

  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        publish.mutate({
          acceptMode,
          rules: {
            ...(actors.trim() ? { allowedActors: split(actors) } : {}),
            ...(users.trim() ? { allowedUsers: split(users) } : {}),
            ...(assessmentModel.trim()
              ? { assessmentModel: assessmentModel.trim() }
              : {}),
            ...(clarificationModel.trim()
              ? { clarificationModel: clarificationModel.trim() }
              : {}),
            ...(writebackFields.trim()
              ? { writebackFields: split(writebackFields) }
              : {}),
            ...(auditRedactFields.trim()
              ? { auditRedactFields: split(auditRedactFields) }
              : {}),
            ...(escalationOwner.trim()
              ? { escalationOwner: escalationOwner.trim() }
              : {}),
          },
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        当前版本 v{policy.data?.version ?? 0}；发布后生成新版本，旧版本保留。
      </p>
      <div className="text-sm">
        <span>受理强度</span>
        <select
          aria-label="受理强度"
          className="mt-1 block h-9 w-full rounded-md border bg-background px-2"
          value={acceptMode}
          onChange={(event) =>
            setAcceptMode(
              event.target.value === 'inferred' ? 'inferred' : 'explicit',
            )
          }
        >
          <option value="explicit">explicit（必须明确受理）</option>
          <option value="inferred">inferred（可推断受理）</option>
        </select>
      </div>
      <div className="text-sm">
        <span>允许的发起人（逗号分隔）</span>
        <Input
          aria-label="允许的发起人"
          className="mt-1"
          value={actors}
          onChange={(event) => setActors(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>允许的用户（逗号分隔）</span>
        <Input
          aria-label="允许的用户"
          className="mt-1"
          value={users}
          onChange={(event) => setUsers(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>研判模型路由</span>
        <Input
          aria-label="研判模型路由"
          className="mt-1"
          placeholder="cip/<slug>/<model>"
          value={assessmentModel}
          onChange={(event) => setAssessmentModel(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>澄清模型路由（可空，复用研判）</span>
        <Input
          aria-label="澄清模型路由"
          className="mt-1"
          value={clarificationModel}
          onChange={(event) => setClarificationModel(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>允许写回的字段（逗号分隔）</span>
        <Input
          aria-label="允许写回的字段"
          className="mt-1"
          value={writebackFields}
          onChange={(event) => setWritebackFields(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>停滞升级负责人</span>
        <Input
          aria-label="停滞升级负责人"
          className="mt-1"
          placeholder="飞书 open_id"
          value={escalationOwner}
          onChange={(event) => setEscalationOwner(event.target.value)}
        />
      </div>
      <div className="text-sm">
        <span>回放脱敏字段（逗号分隔）</span>
        <Input
          aria-label="回放脱敏字段"
          className="mt-1"
          value={auditRedactFields}
          onChange={(event) => setAuditRedactFields(event.target.value)}
        />
      </div>
      {publish.isError && (
        <p className="text-sm text-destructive">{publish.error.message}</p>
      )}
      {publish.isSuccess && (
        <p className="text-sm text-muted-foreground">
          已发布 v{publish.data.version}
        </p>
      )}
      <Button type="submit" disabled={publish.isPending}>
        发布新版本
      </Button>

      <AdmissionRules policyId={policy.data?.id} />
    </form>
  );
}

function split(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
