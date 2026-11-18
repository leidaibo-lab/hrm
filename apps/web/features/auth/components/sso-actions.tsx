'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const HINT = '飞书登录暂未开放，开放后将在此支持飞书账号直接登录';

/**
 * 第三方登录占位（仅 UI，不接后端）：飞书为首个目标渠道，按钮呈禁用观感，
 * 点击给出「暂未开放」提示；正式开放时替换官方品牌资源并接 OAuth 回调。
 */
export function SsoActions() {
  const [hint, setHint] = useState('');
  const timerRef = useRef<number | null>(null);

  const showHint = () => {
    setHint(HINT);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHint(''), 2600);
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2.5 text-[length:var(--text-meta)] text-faint">
        <span className="h-px flex-1 bg-border" />
        或
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        aria-disabled
        onClick={showHint}
        className={cn(
          'mt-3.5 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card',
          'text-[length:var(--text-body)] text-muted-foreground transition-control hover:border-input hover:text-foreground',
        )}
      >
        <Send className="size-4" aria-hidden />
        飞书登录
        <span className="ml-auto rounded-sm border border-border px-2 py-0.5 text-[length:var(--text-meta)] text-faint">
          即将开放
        </span>
      </button>
      <p
        aria-live="polite"
        className="mt-2 min-h-5 text-center text-[length:var(--text-meta)] text-muted-foreground"
      >
        {hint}
      </p>
    </div>
  );
}
