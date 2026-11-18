'use client';

import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type FilterableField, OPERATOR_LABEL } from '../model/filter-fields';
import { datetimeCutoffMs, dayCutoffMs } from '../model/normalize-query';
import type { FilterCondition, FilterOperator } from '../types';

/** 锚定筛选编辑内容：完整条件自动提交，草稿留在编辑器，不需要应用按钮。 */
export function FilterEditor({
  field,
  value,
  onApply,
  onClear,
}: {
  field: FilterableField;
  value?: FilterCondition;
  onApply: (condition: FilterCondition) => void;
  onClear: () => void;
}) {
  const [operator, setOperator] = useState(
    value?.operator ?? field.operators[0],
  );
  const [text, setText] = useState(
    value && 'value' in value && value.kind !== 'date'
      ? String(value.value)
      : '',
  );
  const [values, setValues] = useState(
    value?.kind === 'enum' ? value.values : [],
  );
  const [date, setDate] = useState(() => {
    if (value?.kind !== 'date') return '';
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: field.timeZone ?? 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(field.granularity === 'datetime'
        ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }
        : {}),
    }).format(new Date(value.value));
    return parts.replace(' ', 'T');
  });
  const callbacks = useRef({ onApply, onClear });
  callbacks.current = { onApply, onClear };
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const commit = (
    op: FilterOperator,
    input = text,
    selected = values,
    dateValue = date,
  ) => {
    if (field.kind === 'enum') {
      if (selected.length)
        callbacks.current.onApply({
          kind: 'enum',
          field: field.id,
          operator: op,
          values: selected,
        } as FilterCondition);
      else if (value) callbacks.current.onClear();
    } else if (field.kind === 'date' && dateValue) {
      const instant =
        field.granularity === 'datetime'
          ? datetimeCutoffMs(dateValue, field.timeZone ?? 'Asia/Shanghai')
          : dayCutoffMs(dateValue, field.timeZone ?? 'Asia/Shanghai');
      if (Number.isFinite(instant))
        callbacks.current.onApply({
          kind: 'date',
          field: field.id,
          operator: op,
          value: instant,
        } as FilterCondition);
    } else if (
      field.kind === 'number' &&
      input.trim() &&
      Number.isFinite(Number(input))
    ) {
      callbacks.current.onApply({
        kind: 'number',
        field: field.id,
        operator: op,
        value: Number(input),
      } as FilterCondition);
    } else if (field.kind === 'text' && input.trim()) {
      callbacks.current.onApply({
        kind: 'text',
        field: field.id,
        operator: op,
        value: input,
      } as FilterCondition);
    }
  };
  const schedule = (input: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(operator, input), 300);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        {field.icon && (
          <field.icon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-[length:var(--text-meta)] font-medium">
          {field.header}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`清除 ${field.header} 筛选`}
          onClick={onClear}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <Select
        value={operator}
        onValueChange={(next) => {
          if (timer.current) clearTimeout(timer.current);
          setOperator(next as FilterOperator);
          commit(next as FilterOperator);
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label="筛选条件">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.operators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABEL[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(field.kind === 'text' || field.kind === 'number') && (
        <Input
          autoFocus
          type={field.kind === 'number' ? 'number' : 'text'}
          value={text}
          aria-label={`${field.header}筛选值`}
          placeholder={field.kind === 'number' ? '输入数值…' : '输入文本…'}
          onChange={(event) => {
            setText(event.target.value);
            if (!composing.current) schedule(event.target.value);
          }}
          onCompositionStart={() => {
            composing.current = true;
            if (timer.current) clearTimeout(timer.current);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            schedule(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !composing.current) {
              if (timer.current) clearTimeout(timer.current);
              commit(operator);
            }
          }}
        />
      )}
      {field.kind === 'enum' && (
        <div className="grid max-h-56 gap-0.5 overflow-y-auto">
          {(field.options ?? []).map((option) => (
            <label
              key={option.value}
              htmlFor={`filter-${field.id}-${option.value}`}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
                'text-[length:var(--text-meta)] hover:bg-muted',
              )}
            >
              <Checkbox
                id={`filter-${field.id}-${option.value}`}
                checked={values.includes(option.value)}
                onCheckedChange={(checked) => {
                  let next = values.filter((item) => item !== option.value);
                  if (checked) {
                    next = [option.value];
                    if (field.multiple !== false) {
                      next = [...new Set([...values, option.value])];
                    }
                  }
                  setValues(next);
                  commit(operator, text, next);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
      {field.kind === 'date' && (
        <Input
          autoFocus
          type={field.granularity === 'datetime' ? 'datetime-local' : 'date'}
          value={date}
          aria-label={`${field.header}截止日期`}
          onChange={(event) => {
            setDate(event.target.value);
            commit(operator, text, values, event.target.value);
          }}
        />
      )}
    </div>
  );
}
