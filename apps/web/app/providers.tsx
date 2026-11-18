'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';
import '@/lib/api-client.setup';
import { useSessionLifecycle } from '@/features/auth';

/**
 * 注入全局 Provider 树：主题、React Query 客户端与 toast 容器。
 * @returns 包裹 children 的客户端 Provider 树。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  useSessionLifecycle(queryClient);

  return (
    /* 已知开发期误报：React 19 对组件树内注入的内联 <script>（next-themes 防主题闪烁脚本）
       发 Console Error 警告；该脚本在 SSR HTML 解析期已执行，主题功能正常，生产构建无此警告。 */
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
