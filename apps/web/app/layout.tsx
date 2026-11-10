import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.css';

export const metadata: Metadata = {title: 'PeopleFlow HRM · 招聘协作', description: '公司内部招聘协作工作台'};

/** 全局中文文档结构，内容由各业务页面负责。 */
export default function RootLayout({children}: {children: ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
