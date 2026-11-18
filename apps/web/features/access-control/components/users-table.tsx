'use client';

import { MailIcon, ShieldCheckIcon, UsersRoundIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  type BulkAction,
  createColumns,
  createTableQuery,
  FilterOperator,
  option,
  type RowAction,
  SortDirection,
  TableView,
} from '@/components/table-view';
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
import { useRolesList } from '../api/roles';
import type { UserRow } from '../api/users';
import { queryUsers, useSetUserRoles, useSetUserStatus } from '../api/users';

const STATUS_OPTIONS = {
  active: option.success('启用'),
  suspended: option.neutral('停用'),
};

/** 列工厂：字段能力与筛选操作符按类型限制，kind 由工厂注入。 */
const userColumns = createColumns<UserRow>(
  ({ primary, text, status, number }) => [
    primary('name', '成员', {
      icon: UsersRoundIcon,
      meta: (user) => user.username,
      width: 220,
      minWidth: 160,
      sortable: true,
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
    text('email', '邮箱', {
      icon: MailIcon,
      sortable: true,
      filter: {
        operators: [
          FilterOperator.Equal,
          FilterOperator.NotEqual,
          FilterOperator.Contains,
          FilterOperator.NotContains,
        ],
      },
    }),
    status('status', '状态', STATUS_OPTIONS, {
      width: 110,
      resizable: false,
      filter: {
        operators: [FilterOperator.Equal, FilterOperator.NotEqual],
        multiple: true,
      },
    }),
    number('roleCount', '角色数', {
      icon: ShieldCheckIcon,
      accessor: (user) => user.roleIds.length,
      width: 96,
      resizable: false,
    }),
  ],
);

/** 用户账号表格：搜索/筛选/排序/分页/选择，行内启停与角色分配即时提交。 */
export function UsersTable({ identityKey }: { identityKey: string }) {
  const roles = useRolesList({ enabled: true });
  const setStatus = useSetUserStatus();
  const setRoles = useSetUserRoles();
  const [assigning, setAssigning] = useState<UserRow | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const toggleStatus = useCallback(
    async (user: UserRow): Promise<undefined> => {
      const next = user.status === 'active' ? 'suspended' : 'active';
      await setStatus.mutateAsync(
        { id: user.id, status: next },
        { onError: (cause) => toast.error(cause.message) },
      );
      return undefined;
    },
    [setStatus],
  );

  async function submitAssign(): Promise<void> {
    if (!assigning) return;
    try {
      await setRoles.mutateAsync({
        id: assigning.id,
        roleIds: selectedRoleIds,
      });
      setAssigning(null);
      toast.success('角色已更新，用户下次刷新生效');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '角色分配失败');
    }
  }

  const rowActions: RowAction<UserRow>[] = [
    {
      label: '分配角色',
      onRun: (user) => {
        setAssigning(user);
        setSelectedRoleIds(user.roleIds);
      },
    },
    {
      label: '停用',
      danger: true,
      confirm: {
        title: '停用该账号？',
        description: '停用后该用户将无法登录，已登录会话立即失效。',
        confirmLabel: '停用',
      },
      when: (user) => user.status === 'active',
      onRun: (user) => toggleStatus(user),
    },
    {
      label: '启用',
      when: (user) => user.status !== 'active',
      onRun: (user) => toggleStatus(user),
    },
  ];

  const bulkActions: BulkAction<UserRow>[] = [
    {
      label: '批量停用',
      danger: true,
      confirm: {
        title: '批量停用选中账号？',
        description: '停用后这些用户将无法登录。',
        confirmLabel: '批量停用',
      },
      onRun: async (rows) => {
        const targets = rows.filter((row) => row.status === 'active');
        const succeededIds: string[] = [];
        const failed: Array<{ id: string; error: { message: string } }> = [];
        for (const row of targets) {
          try {
            await setStatus.mutateAsync({ id: row.id, status: 'suspended' });
            succeededIds.push(row.id);
          } catch (cause) {
            failed.push({
              id: row.id,
              error: {
                message:
                  cause instanceof Error ? cause.message : '批量停用失败',
              },
            });
          }
        }
        if (succeededIds.length > 0) {
          toast.success(`已停用 ${succeededIds.length} 个账号`);
        }
        return { succeededIds, failed };
      },
    },
  ];

  return (
    <>
      <TableView
        id="iam-users"
        identityKey={identityKey}
        query={createTableQuery({ request: queryUsers })}
        columns={userColumns}
        rowKey={(user) => user.id}
        title="全部成员"
        toolbar={{
          searchable: { placeholder: '搜索姓名/账号/邮箱…', debounceMs: 300 },
          filterable: true,
          sortable: { maxRules: 3 },
          columnSettings: true,
        }}
        actions={rowActions}
        selection={{ enabled: true, actions: bulkActions }}
        defaultQuery={{
          pageSize: 20,
          sort: [{ field: 'createdAt', direction: SortDirection.Asc }],
        }}
        empty={{
          icon: UsersRoundIcon,
          title: '还没有成员',
          description: '账号经注册或管理员创建后在此统一管理启停与角色绑定。',
        }}
      />

      <Dialog
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配角色</DialogTitle>
            <DialogDescription>全量替换该用户的角色绑定</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {roles.data?.map((role) => (
              <div key={role.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selectedRoleIds.includes(role.id)}
                  onCheckedChange={(checked) =>
                    setSelectedRoleIds((ids) =>
                      checked
                        ? [...ids, role.id]
                        : ids.filter((id) => id !== role.id),
                    )
                  }
                />
                <Label htmlFor={`role-${role.id}`} className="font-normal">
                  {role.name}
                  <span className="text-muted-foreground">（{role.code}）</span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void submitAssign()}
              disabled={setRoles.isPending}
            >
              {setRoles.isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
