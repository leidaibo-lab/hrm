import { SESSION_COOKIE_NAME } from '@cip/shared';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/403'];

/**
 * 会话乐观检查。
 * 仅判断 sid cookie 存在性，不校验真伪——真正的鉴权在 api guard 与 RSC getSession。
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
