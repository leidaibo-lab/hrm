'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCatalog, useCatalogDetail } from '../../api/catalog';
import { useCreateImport } from '../../api/imports';

/** 从 models.dev 目录导入：基线预填；已存在的模型跳过不覆盖（upsert 语义）。 */
export function ImportModelDialog({
  open,
  providerId,
  onClose,
}: {
  open: boolean;
  providerId: string;
  onClose: () => void;
}) {
  const catalog = useCatalog();
  const [providerId_, setProviderId_] = useState<string | null>(null);
  const detail = useCatalogDetail(providerId_ ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const createImport = useCreateImport(providerId);
  const [importing, setImporting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>从目录导入</DialogTitle>
          <DialogDescription>
            models.dev 基线预填；已存在的模型跳过不覆盖
          </DialogDescription>
        </DialogHeader>
        {catalog.isError && (
          <Alert variant="destructive">
            <AlertDescription>{catalog.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Select
            value={providerId_ ?? ''}
            onValueChange={(value) => {
              setProviderId_(value || null);
              setSelected([]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择目录服务商…" />
            </SelectTrigger>
            <SelectContent>
              {(catalog.data ?? []).map((provider) => (
                <SelectItem
                  key={provider.providerId}
                  value={provider.providerId}
                >
                  {provider.name}（{provider.models.length} 个模型）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {detail.data !== undefined && (
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-2">
              {detail.data.models.map((model) => (
                <div
                  key={model.modelId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`catalog-${model.modelId}`}
                    checked={selected.includes(model.modelId)}
                    onCheckedChange={(checked) =>
                      setSelected((ids) =>
                        checked
                          ? [...ids, model.modelId]
                          : ids.filter((id) => id !== model.modelId),
                      )
                    }
                  />
                  <Label
                    htmlFor={`catalog-${model.modelId}`}
                    className="grid font-normal leading-tight"
                  >
                    <span>{model.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.modelId}
                      {model.input !== null && model.output !== null
                        ? ` · $${model.input}/$${model.output} per M`
                        : ' · 无价格基线'}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={selected.length === 0 || importing}
            onClick={async () => {
              if (detail.data === undefined) return;
              setImporting(true);
              try {
                const result = await createImport.mutateAsync({
                  catalogProviderId: providerId_ ?? '',
                  modelIds: selected,
                });
                const message = `导入完成：新增 ${result.created}，跳过 ${result.skipped}，失败 ${result.failed}`;
                if (result.failed > 0) {
                  toast.error(
                    `${message}：${result.items
                      .filter((item) => item.status === 'failed')
                      .map((item) => `${item.modelId} ${item.error}`)
                      .join('；')}`,
                  );
                  setSelected(
                    result.items
                      .filter((item) => item.status === 'failed')
                      .map((item) => item.modelId),
                  );
                  return;
                }
                toast.success(message);
                onClose();
              } catch (cause) {
                toast.error(
                  cause instanceof Error ? cause.message : '导入失败',
                );
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? '导入中…' : `导入选中 ${selected.length} 个`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
