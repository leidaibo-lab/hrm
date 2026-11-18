import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type {
  PermissionPointRepository,
  PermissionPointRow,
} from '../domain/permission-point.repository';

/** PermissionPointRepository 的 Prisma 实现。 */
@Injectable()
export class PermissionPointPrismaRepository
  implements PermissionPointRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PermissionPointRow[]> {
    return this.prisma.permissionPoint.findMany();
  }

  async findActiveCodes(codes: string[]): Promise<string[]> {
    const rows = await this.prisma.permissionPoint.findMany({
      where: { code: { in: codes }, state: 'active' },
      select: { code: true },
    });
    return rows.map((row) => row.code);
  }

  async create(entry: {
    code: string;
    resource: string;
    action: string;
  }): Promise<void> {
    await this.prisma.permissionPoint.create({ data: entry });
  }

  async activate(code: string): Promise<void> {
    await this.prisma.permissionPoint.update({
      where: { code },
      data: { state: 'active' },
    });
  }

  async deprecate(code: string): Promise<void> {
    await this.prisma.permissionPoint.update({
      where: { code },
      data: { state: 'deprecated' },
    });
  }

  async upsertSummary(
    code: string,
    structure: { resource: string; action: string },
    summary: string | null,
  ): Promise<void> {
    await this.prisma.permissionPoint.upsert({
      where: { code },
      create: {
        code,
        resource: structure.resource,
        action: structure.action,
        summary,
      },
      update: { summary },
    });
  }
}
