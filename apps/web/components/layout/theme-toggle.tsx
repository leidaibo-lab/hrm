'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

/** 亮暗主题切换：首次跟随系统，此后单击在亮/暗间切换。挂载前渲染固定占位，避免 hydration 不一致。 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === 'dark';
  let themeLabel = '切换主题';
  if (mounted) themeLabel = isDark ? '切换为浅色主题' : '切换为深色主题';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={themeLabel}
      className="text-muted-foreground hover:text-foreground"
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark');
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
