'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * 密码输入业务封装：明/密文切换（aria-pressed 标注状态）。
 * ref 经 props 透传给 react-hook-form 的 register（React 19 ref-as-prop）。
 */
export function PasswordField({
  className,
  ...props
}: ComponentProps<'input'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('pr-9', className)}
      />
      <button
        type="button"
        aria-label={show ? '隐藏密码' : '显示密码'}
        aria-pressed={show}
        onClick={() => setShow((value) => !value)}
        className={cn(
          'absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md',
          'text-muted-foreground transition-control hover:text-foreground active:scale-90',
        )}
      >
        {show ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
