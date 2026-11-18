import { cn } from 'cn';
import type * as React from 'react';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-[38px] w-full min-w-0 rounded-[9px] border border-input bg-card px-3 py-1 text-[length:var(--text-body)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[length:var(--text-aux)] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
