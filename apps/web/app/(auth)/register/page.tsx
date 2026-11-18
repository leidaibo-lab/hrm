import { SESSION_COOKIE_NAME } from '@cip/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/features/auth';

/**
 * 注册页；api 侧 AUTH_REGISTRATION_ENABLED 关闭时提交将返回 auth.register_disabled。
 * 整页依赖会话存在性，阻塞渲染（cacheComponents）。
 */
export const instant = false;

export default async function RegisterPage() {
  const cookieStore = await cookies();
  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect('/');
  }
  return <RegisterForm />;
}
