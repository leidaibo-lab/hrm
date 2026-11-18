import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/platform/prisma/generated/client';
import 'dotenv/config';

/**
 * 初始数据 seed：内置 super-admin 角色与初始管理员账号（ADR-0009/0010）。
 * 幂等：按 code/username upsert。经 `prisma db seed` 执行（见 prisma.config.ts）。
 * 管理员凭据取环境变量 SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD，缺失时跳过建号。
 */
async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.role.upsert({
      where: { code: 'super-admin' },
      create: {
        code: 'super-admin',
        name: '超级管理员',
        description: '内置角色：全量权限（词义绑定见 ADR-0009）',
        isBuiltin: true,
      },
      update: { isBuiltin: true },
    });

    const username = process.env.SEED_ADMIN_USERNAME;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (username && password) {
      const passwordHash = await hash(password);
      const admin = await prisma.user.upsert({
        where: { username },
        create: { username, name: '平台管理员', passwordHash },
        update: {},
      });
      const superAdmin = await prisma.role.findUniqueOrThrow({
        where: { code: 'super-admin' },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
        create: { userId: admin.id, roleId: superAdmin.id },
        update: {},
      });
      console.log(`初始管理员就绪: ${username}`);
    } else {
      console.log(
        '未配置 SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD，跳过初始管理员',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
