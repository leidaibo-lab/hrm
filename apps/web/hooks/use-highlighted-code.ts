import * as React from 'react';

import { loadHighlighter } from '@/lib/highlighter';

/**
 * 流式代码高亮：已完成行走缓存，末行随流式写入逐渲染重算。
 * @param value - 完整代码文本，流式场景下持续增长。
 * @returns 各行高亮节点；语言未加载完成前退化为纯文本行。
 */
export function useHighlightedCode(value: string, language: string) {
  // 结尾换行会多渲染一个空行，先剥掉。
  const code = value.endsWith('\n') ? value.slice(0, -1) : value;
  const [loaded, setLoaded] = React.useState<{
    language: string;
    highlighter: Awaited<ReturnType<typeof loadHighlighter>>;
  } | null>(null);
  const highlighter = loaded?.language === language ? loaded.highlighter : null;

  React.useEffect(() => {
    let cancelled = false;

    loadHighlighter(language)
      .then((next) => {
        if (!cancelled) {
          setLoaded({ language, highlighter: next });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language]);

  // 已完成行的高亮缓存：流式写入时只分词新行，承接上一轮的语法状态。
  const [done, setDone] = React.useState<{
    highlighter: typeof highlighter;
    text: string;
    lines: React.ReactNode[];
    state?: Parameters<NonNullable<typeof highlighter>['highlight']>[1];
  }>({ highlighter: null, text: '', lines: [] });

  let next = done;

  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, text: '', lines: [] };
  }

  const end = code.lastIndexOf('\n') + 1;

  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(
      code.slice(next.text.length, end - 1),
      next.state,
    );

    next = {
      highlighter,
      text: code.slice(0, end),
      lines: [...next.lines, ...result.lines],
      state: result.state,
    };
  }

  if (next !== done) {
    setDone(next);
  }

  // 末行仍在写入，每次渲染都重新分词。
  const tail = code.slice(end);

  return React.useMemo(() => {
    if (!highlighter) {
      return code.split('\n');
    }

    return [...next.lines, highlighter.highlight(tail, next.state).lines[0]];
  }, [code, highlighter, next, tail]);
}
