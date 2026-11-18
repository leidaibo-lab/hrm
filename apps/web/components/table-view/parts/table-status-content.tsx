import type { TableViewStatus } from '../model/render-state';
import { EmptyState, ErrorState, SkeletonRows } from './empty-state';

/** 按互斥状态显示加载、错误或空态，已有数据状态不附加内容。 */
export function TableStatusContent({ status }: { status: TableViewStatus }) {
  if (status.kind === 'ready') return null;
  if (status.kind === 'pending') return <SkeletonRows />;
  if (status.kind === 'error') {
    return <ErrorState message={status.message} onRetry={status.onRetry} />;
  }
  return status.content ?? <EmptyState />;
}
