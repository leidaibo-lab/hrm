'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '@/lib/browser-storage';

/** 浏览器存储 hook 公共返回形态。 */
export type BrowserStorageHandle<T> = {
  /** 内存中当前生效的值，存储不可用时仍可使用。 */
  value: T;
  /** 是否已完成存储恢复，决定能否执行首次查询。 */
  ready: boolean;
  /** 结构化失败信息；保留机器判断所需字段。 */
  error: Error | null;
  /** 更新内存值并尝试写入浏览器存储。 */
  setValue: (value: T | ((previous: T) => T)) => void;
  /** 移除已存储值并恢复调用方默认值。 */
  reset: () => void;
};

/**
 * 底层实现：SSR 首帧安全，ready 前不写默认值；schema 校验失败视为损坏并清理键。
 * 恢复语义为「每 key 一次」：schema/defaultValue 通过 ref 读取，
 * 不进入 effect 依赖（调用方内联对象字面量不会造成无限恢复）。
 */
export function useBrowserStorage<T>(
  storage: 'local' | 'session',
  config: { key: string; schema: z.ZodType<T>; defaultValue: T },
): BrowserStorageHandle<T> {
  const { key, defaultValue } = config;
  const configRef = useRef(config);
  configRef.current = config;
  const [state, setState] = useState<{
    key: string;
    value: T;
    ready: boolean;
    error: Error | null;
  }>(() => ({ key, value: defaultValue, ready: false, error: null }));
  const valueRef = useRef(defaultValue);

  useEffect(() => {
    const read = safeReadStorage(storage, key, configRef.current.schema);
    valueRef.current = read.data ?? configRef.current.defaultValue;
    if (read.error) {
      safeRemoveStorage(storage, key);
      setState({
        key,
        value: configRef.current.defaultValue,
        ready: true,
        error: read.error,
      });
      return;
    }
    setState({
      key,
      value: read.data === null ? configRef.current.defaultValue : read.data,
      ready: true,
      error: null,
    });
  }, [key, storage]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const value =
        typeof next === 'function'
          ? (next as (previous: T) => T)(valueRef.current)
          : next;
      valueRef.current = value;
      const written = safeWriteStorage(storage, key, value);
      setState((prev) => ({
        key,
        value,
        ready: true,
        error: written ? null : (prev.error ?? new Error('存储写入失败')),
      }));
    },
    [key, storage],
  );

  const reset = useCallback(() => {
    safeRemoveStorage(storage, key);
    valueRef.current = configRef.current.defaultValue;
    setState({
      key,
      value: configRef.current.defaultValue,
      ready: true,
      error: null,
    });
  }, [key, storage]);

  return {
    ...state,
    value: state.key === key ? state.value : defaultValue,
    ready: state.key === key && state.ready,
    setValue,
    reset,
  };
}

/** 泛型 localStorage hook：列偏好等跨会话持久化。 */
export function useLocalStorage<T>(config: {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}): BrowserStorageHandle<T> {
  return useBrowserStorage('local', config);
}
