import type { ReactNode } from 'react';

import { AuthAside } from '@/features/auth';

/** 认证域布局：左栏暖纸 + 静态信号场（lg 起两栏 55/45），右栏表单区；移动端保留品牌行与标题。 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[11fr_9fr]">
      <AuthAside />
      <main className="flex items-center justify-center px-6 py-10 lg:px-10 lg:py-12">
        {children}
      </main>
    </div>
  );
}
