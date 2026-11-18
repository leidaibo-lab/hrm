import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma';
import type {
  NavigationNodeRepository,
  NavigationNodeRow,
} from '../domain/navigation-node.repository';

/** NavigationNodeRepository 的 Prisma 实现。 */
@Injectable()
export class NavigationNodePrismaRepository
  implements NavigationNodeRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<NavigationNodeRow[]> {
    return this.prisma.navigationNode.findMany();
  }

  async create(code: string): Promise<void> {
    await this.prisma.navigationNode.create({ data: { code } });
  }

  async activate(code: string): Promise<void> {
    await this.prisma.navigationNode.update({
      where: { code },
      data: { state: 'active' },
    });
  }

  async deprecate(code: string): Promise<void> {
    await this.prisma.navigationNode.update({
      where: { code },
      data: { state: 'deprecated' },
    });
  }

  async upsertOverride(
    code: string,
    patch: {
      title: string | null;
      icon: string | null;
      sort: number | null;
      visible: boolean;
    },
  ): Promise<void> {
    await this.prisma.navigationNode.upsert({
      where: { code },
      create: { code, ...patch },
      update: patch,
    });
  }
}
