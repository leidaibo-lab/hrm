'use client';

import { useLayoutEffect } from 'react';

/** flow 模式下按最近纵向视区计算表头偏移，横向滚动仍只由数据容器负责。 */
export function useFlowHeader(
  ref: React.RefObject<HTMLDivElement | null>,
  flow: boolean,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !flow) return;
    let viewport = element.parentElement;
    while (
      viewport &&
      !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)
    )
      viewport = viewport.parentElement;
    let frame = 0;
    const update = () => {
      const table = element.querySelector('table');
      if (!table) return;
      const top = viewport?.getBoundingClientRect().top ?? 0;
      const offset = Math.max(
        0,
        Math.min(
          table.getBoundingClientRect().height - 36,
          top - element.getBoundingClientRect().top,
        ),
      );
      element.style.setProperty('--flow-header-offset', `${offset}px`);
      element.parentElement?.style.setProperty(
        '--flow-header-offset',
        `${offset}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      element.style.removeProperty('--flow-header-offset');
      element.parentElement?.style.removeProperty('--flow-header-offset');
    };
  }, [ref, flow]);
}
