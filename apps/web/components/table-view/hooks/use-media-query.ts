'use client';

import { useEffect, useState } from 'react';

/** 媒体查询订阅（SSR 首帧恒 false，挂载后同步真实匹配结果）。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaList = window.matchMedia(query);
    const sync = () => setMatches(mediaList.matches);
    sync();
    mediaList.addEventListener('change', sync);
    return () => mediaList.removeEventListener('change', sync);
  }, [query]);

  return matches;
}
