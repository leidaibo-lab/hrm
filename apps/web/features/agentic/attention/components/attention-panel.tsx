'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnswerAttention, useAttentionList } from '../api/attention';

/** 截止时间是否已过；无截止时间视为未逾期。 */
function isOverdue(deadline: string | null): boolean {
  return deadline !== null && new Date(deadline).getTime() < Date.now();
}

/** 待办关注：逐条回答，回答后从列表消失。 */
export function AttentionPanel() {
  const [kind, setKind] = useState<string | undefined>();
  const attentions = useAttentionList(kind);
  const answer = useAnswerAttention();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (attentions.isPending)
    return (
      <div className="space-y-3 px-7">
        {['s1', 's2', 's3'].map((key) => (
          <Skeleton key={key} className="h-28 w-full" />
        ))}
      </div>
    );

  if (attentions.isError)
    return (
      <p className="px-7 text-sm text-destructive">
        待办关注加载失败：{attentions.error.message}
      </p>
    );

  return (
    <div className="space-y-3 px-7">
      <div className="flex gap-2">
        {[
          { key: undefined, label: '全部' },
          { key: 'clarify', label: '澄清' },
          { key: 'confirm', label: '确认' },
          { key: 'review', label: '评审' },
          { key: 'approval', label: '审批' },
        ].map((item) => (
          <Button
            key={item.label}
            size="sm"
            variant={kind === item.key ? 'default' : 'outline'}
            onClick={() => setKind(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {attentions.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          当前筛选下没有待办关注。需要人确认时，agentic 会在这里提出问题。
        </p>
      )}
      {attentions.data.map((attention) => (
        <Card
          key={attention.id}
          className={isOverdue(attention.deadline) ? 'border-destructive' : ''}
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{attention.question}</CardTitle>
              <div className="flex items-center gap-2">
                {isOverdue(attention.deadline) && (
                  <Badge variant="destructive">已逾期</Badge>
                )}
                <Badge variant="outline">{attention.kind}</Badge>
              </div>
            </div>
            <CardDescription>
              工单{' '}
              <Link
                className="underline underline-offset-4"
                href={`/tickets/${attention.ticketId}`}
              >
                {attention.ticketId}
              </Link>
              {' · 负责人 '}
              {attention.assignee}
              {` · 截止 ${new Date(attention.deadline).toLocaleString('zh-CN')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="输入回答，或填写驳回原因"
              value={drafts[attention.id] ?? ''}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [attention.id]: event.target.value,
                }))
              }
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={
                  answer.isPending ||
                  (drafts[attention.id] ?? '').trim().length === 0
                }
                onClick={() =>
                  answer.mutate({
                    id: attention.id,
                    answer: (drafts[attention.id] ?? '').trim(),
                    decision: 'confirm',
                  })
                }
              >
                确认
              </Button>
              <Button
                variant="outline"
                disabled={
                  answer.isPending ||
                  (drafts[attention.id] ?? '').trim().length === 0
                }
                onClick={() =>
                  answer.mutate({
                    id: attention.id,
                    answer: (drafts[attention.id] ?? '').trim(),
                    decision: 'modify',
                  })
                }
              >
                修改
              </Button>
              <Button
                variant="destructive"
                disabled={
                  answer.isPending ||
                  (drafts[attention.id] ?? '').trim().length === 0
                }
                onClick={() =>
                  answer.mutate({
                    id: attention.id,
                    answer: (drafts[attention.id] ?? '').trim(),
                    decision: 'reject',
                    reason: (drafts[attention.id] ?? '').trim(),
                  })
                }
              >
                驳回
              </Button>
            </div>
            {answer.isError && (
              <p className="text-sm text-destructive">{answer.error.message}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
