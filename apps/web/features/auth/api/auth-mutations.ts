'use client';

import type { LoginInput, RegisterInput } from '@cip/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  authControllerLogin,
  authControllerLogout,
  authControllerRegister,
} from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { clearSessionCache } from '@/lib/query-client';

/** 登录 mutation；失败抛出携带 problem+json detail 的 Error。 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { error } = await authControllerLogin({ body: input });
      if (error) throw new ApiError(error, '登录失败');
      await clearSessionCache(queryClient);
    },
  });
}

/** 注册 mutation：成功即登录（api 侧直接建立会话）。 */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { error } = await authControllerRegister({ body: input });
      if (error) throw new ApiError(error, '注册失败');
      await clearSessionCache(queryClient);
    },
  });
}

/** 登出 mutation：清理会话后回登录页。 */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const { error } = await authControllerLogout();
      if (error) throw new ApiError(error, '退出失败');
    },
    onSuccess: async () => {
      await clearSessionCache(queryClient);
      router.replace('/login');
      router.refresh();
    },
  });
}
