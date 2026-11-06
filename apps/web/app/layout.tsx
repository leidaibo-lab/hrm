import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.css';

export const metadata: Metadata = {title: 'HRM 开发环境', description: 'HRM 业务应用与环境就绪检查'};

/** 全局中文文档结构，内容由各业务页面负责。 */
export default function RootLayout({children}: {children: ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
