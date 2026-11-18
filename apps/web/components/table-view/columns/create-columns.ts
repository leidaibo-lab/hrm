import type { ReactNode } from 'react';
import type { ColumnOptionMap, TableViewColumn, Truncate } from '../types';
import {
  type DateFilterDef,
  date,
  id,
  link,
  type NumberFilterDef,
  number,
  primary,
  type TextFilterDef,
  text,
} from './basic';
import {
  type EnumFilterDef,
  multiselect,
  person,
  select,
  status,
  switchColumn,
} from './entity';
import { option } from './option';
import type { CommonOptions } from './shared';

export { option };

/** 枚举/状态列公共入参（第二参数为选项映射）。 */
type EnumCommonOptions<T> = CommonOptions<T> & { filter?: EnumFilterDef };

/**
 * 回调式列工厂集合：绑定行泛型一次，业务只导入本表需要的工厂。
 * filter 声明按工厂类型限制操作符子集与形态，kind 由工厂注入、业务不传。
 */
type RawColumnFactories<T> = {
  text: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & { truncate?: Truncate; filter?: TextFilterDef },
  ) => TableViewColumn<T>;
  primary: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      meta?: (row: T) => string | ReactNode;
      truncate?: Truncate;
      filter?: TextFilterDef;
    },
  ) => TableViewColumn<T>;
  number: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      format?: (value: number) => string;
      precision?: number;
      filter?: NumberFilterDef;
    },
  ) => TableViewColumn<T>;
  date: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      format?: string;
      relative?: boolean;
      filter?: DateFilterDef;
    },
  ) => TableViewColumn<T>;
  id: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      display?: 'middle' | 'head' | 'tail' | 'full';
      copy?: boolean;
    },
  ) => TableViewColumn<T>;
  link: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      external?: boolean;
      label?: (value: string, row: T) => string;
      truncate?: Truncate;
    },
  ) => TableViewColumn<T>;
  status: (
    key: string,
    header: string,
    map: ColumnOptionMap,
    opts?: EnumCommonOptions<T>,
  ) => TableViewColumn<T>;
  select: (
    key: string,
    header: string,
    map: ColumnOptionMap,
    opts?: EnumCommonOptions<T>,
  ) => TableViewColumn<T>;
  multiselect: (
    key: string,
    header: string,
    map: ColumnOptionMap,
    opts?: CommonOptions<T> & { max?: number; filter?: EnumFilterDef },
  ) => TableViewColumn<T>;
  switch: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & { trueLabel?: string; falseLabel?: string },
  ) => TableViewColumn<T>;
  person: (
    key: string,
    header: string,
    opts?: CommonOptions<T> & {
      avatar?: (row: T) => string | undefined;
      filter?: EnumFilterDef & { options: ColumnOptionMap };
      meta?: (row: T) => string;
    },
  ) => TableViewColumn<T>;
};

type DerivedArguments<T, Args extends unknown[]> = Args extends [
  opts?: infer Options,
]
  ? [opts: NonNullable<Options> & { accessor: (row: T) => unknown }]
  : Args extends [map: infer Map, opts?: infer Options]
    ? [map: Map, opts: NonNullable<Options> & { accessor: (row: T) => unknown }]
    : Args;

/** 普通字段必须存在于行类型；自定义字段强制提供 accessor。 */
export type ColumnFactories<T> = {
  [Name in keyof RawColumnFactories<T>]: RawColumnFactories<T>[Name] extends (
    key: string,
    header: string,
    ...args: infer Args
  ) => infer Result
    ? <Key extends string>(
        key: Key,
        header: string,
        ...args: Key extends keyof T ? Args : DerivedArguments<T, Args>
      ) => Result
    : never;
};

const factories = {
  text,
  primary,
  number,
  date,
  id,
  link,
  status,
  select,
  multiselect,
  switch: switchColumn,
  person,
} as const;

/**
 * 泛型绑定回调式工厂：
 * `const userColumns = createColumns<UserRow>(({ primary, text, ... }) => [...])`
 */
export function createColumns<T>(
  factory: (f: ColumnFactories<T>) => TableViewColumn<T>[],
): TableViewColumn<T>[] {
  // 实现对象绑定具体回调签名，与 mapped 泛型 ColumnFactories<T>（Key 协变分发
  // accessor，见 DerivedArguments）在类型层不重合；运行时同一组工厂按泛型上下文分发，
  // 双重断言仅为弥合声明层差异，非掩盖运行时错误。
  return factory(factories as unknown as ColumnFactories<T>);
}
