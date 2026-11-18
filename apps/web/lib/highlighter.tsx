import type * as React from 'react';
import {
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
} from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

// 语言按需登记，每种语言在首次使用时才加载。
const languages = {
  bash: () => import('shiki/langs/shellscript.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
};

const aliases: Record<string, keyof typeof languages> = {
  js: 'javascript',
  md: 'markdown',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
};

let highlighter: Promise<HighlighterCore> | undefined;

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });

  return highlighter;
}

function getLanguage(language: string) {
  const name = language.toLowerCase();

  if (name === 'ansi') {
    return name;
  }

  if (name in languages) {
    return name as keyof typeof languages;
  }

  return aliases[name] ?? null;
}

/**
 * 加载指定语言并返回其 highlighter，未登记的语言返回 null。
 * @param language - 语言名或别名（如 "ts"、"shellscript"）。
 */
export async function loadHighlighter(language: string) {
  const lang = getLanguage(language);

  if (!lang) {
    return null;
  }

  const shiki = await getHighlighter();

  if (lang !== 'ansi' && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(languages[lang]);
  }

  return {
    // 每行返回一个 React 节点，并附带末行语法状态；把状态传回即可续写高亮。
    highlight(code: string, state?: GrammarState) {
      const tokenize = (text: string) =>
        shiki.codeToTokens(text, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
          grammarState: state,
        }).tokens;

      // ANSI 无语法状态：逐行独立分词，整块到达与流式到达颜色一致。
      const tokens =
        lang === 'ansi'
          ? code.split('\n').flatMap((line) => tokenize(line))
          : tokenize(code);

      return {
        lines: tokens.map((line) =>
          line.map((token, index) => (
            <span
              /* biome-ignore lint/suspicious/noArrayIndexKey: shiki token 为位置列表，无稳定标识 */
              key={index}
              style={token.htmlStyle as React.CSSProperties}
              className="text-(--shiki-light) dark:text-(--shiki-dark)"
            >
              {token.content}
            </span>
          )),
        ),
        state: shiki.getLastGrammarState(tokens),
      };
    },
  };
}

/**
 * 一次性高亮完整代码，按行返回 React 节点；未登记的语言返回 null。
 */
export async function highlightCode(code: string, language: string) {
  const highlighter = await loadHighlighter(language);

  return highlighter ? highlighter.highlight(code).lines : null;
}
