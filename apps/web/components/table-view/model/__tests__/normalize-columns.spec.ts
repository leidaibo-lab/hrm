import { describe, expect, it } from 'vitest';
import type { ColumnState, TableViewColumn } from '../../types';
import {
  canFreezeColumn,
  defaultColumnState,
  effectiveColumnOrder,
  mergeColumnState,
} from '../normalize-columns';

interface Row {
  id: string;
  name: string;
  age: number;
  extra: string;
}

const columns: TableViewColumn<Row>[] = [
  { id: 'name', header: '名称', primary: true, cell: () => null },
  { id: 'age', header: '年龄', cell: () => null },
  { id: 'extra', header: '备注', cell: () => null },
];

describe('defaultColumnState', () => {
  it('按列声明顺序、全显示、无冻结', () => {
    expect(defaultColumnState(columns)).toEqual({
      order: ['name', 'age', 'extra'],
      widths: {},
      hidden: [],
      frozen: [],
    });
  });
});

describe('mergeColumnState', () => {
  it('新列追加到末尾、删除列清理、损坏项过滤', () => {
    const saved: Partial<ColumnState> = {
      order: ['age', 'ghost', 'name'],
      widths: { age: 120, ghost: 99, bad: -5 },
      hidden: ['age', 'ghost'],
      frozen: ['name'],
    };
    expect(mergeColumnState(columns, saved)).toEqual({
      order: ['age', 'name', 'extra'],
      widths: { age: 120 },
      hidden: ['age'],
      frozen: ['name'],
    });
  });

  it('主列强制可见（默认不可隐藏）', () => {
    expect(mergeColumnState(columns, { hidden: ['name'] }).hidden).toEqual([]);
  });

  it('显式声明 hideable 的主列可隐藏', () => {
    const columns2: TableViewColumn<Row>[] = [
      {
        id: 'name',
        header: '名称',
        primary: true,
        hideable: true,
        cell: () => null,
      },
      { id: 'age', header: '年龄', cell: () => null },
    ];
    expect(mergeColumnState(columns2, { hidden: ['name'] }).hidden).toEqual([
      'name',
    ]);
  });
});

describe('effectiveColumnOrder', () => {
  it('冻结区（声明顺序）在前，隐藏列剔除', () => {
    expect(
      effectiveColumnOrder({
        order: ['name', 'age', 'extra'],
        widths: {},
        hidden: ['extra'],
        frozen: ['age'],
      }),
    ).toEqual(['age', 'name']);
  });
});

describe('canFreezeColumn', () => {
  it('普通数据区保留不足 240px 时阻止新增冻结', () => {
    const width = () => 400;
    expect(
      canFreezeColumn(
        { order: [], widths: {}, hidden: [], frozen: [] },
        width,
        1000,
        0,
        'a',
      ),
    ).toBe(true);
    expect(
      canFreezeColumn(
        { order: [], widths: {}, hidden: [], frozen: ['a'] },
        width,
        1000,
        120,
        'b',
      ),
    ).toBe(false);
  });
});
