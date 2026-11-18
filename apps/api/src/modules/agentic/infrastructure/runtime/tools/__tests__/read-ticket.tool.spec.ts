import { describe, expect, it } from 'vitest';
import { Artifact } from '../../../../domain/artifact.entity';
import type { ArtifactRepository } from '../../../../domain/artifact.repository';
import { Ticket } from '../../../../domain/ticket.entity';
import type { TicketRepository } from '../../../../domain/ticket.repository';
import { createReadTicketTool } from '../read-ticket.tool';

const AT = new Date('2026-11-16T00:00:00.000Z');

class FakeTicketRepository implements TicketRepository {
  constructor(private readonly ticket: Ticket | null) {}
  async findById(): Promise<Ticket | null> {
    return this.ticket;
  }
  async findByMandateId(): Promise<Ticket | null> {
    return null;
  }
  async list(): Promise<Ticket[]> {
    return [];
  }
  async listByThread(): Promise<Ticket[]> {
    return [];
  }
  async save(): Promise<void> {}
}

class FakeArtifactRepository implements ArtifactRepository {
  constructor(private readonly artifacts: Artifact[]) {}
  async findById(): Promise<Artifact | null> {
    return null;
  }
  async listByTicket(): Promise<Artifact[]> {
    return this.artifacts;
  }
  async findLatest(): Promise<Artifact | null> {
    return null;
  }
  async save(): Promise<void> {}
}

function ticket(): Ticket {
  return Ticket.open({
    id: 'ticket-1',
    mandateId: 'mandate-1',
    threadId: 'thread-1',
    kind: 'requirement',
    scopeKey: 'project-a',
    now: AT,
  });
}

async function run(
  tool: ReturnType<typeof createReadTicketTool>,
  input: { ticketId: string },
): Promise<unknown> {
  return tool.execute?.(input, undefined as never);
}

describe('read-ticket tool', () => {
  it('返回工单状态与最新产物摘要', async () => {
    const artifact = Artifact.create({
      id: 'artifact-1',
      ticketId: 'ticket-1',
      kind: 'clarify',
      version: 1,
      payload: { summary: '澄清摘要' },
      now: AT,
    });
    const tool = createReadTicketTool({
      tickets: new FakeTicketRepository(ticket()),
      artifacts: new FakeArtifactRepository([artifact]),
    });

    const result = await run(tool, { ticketId: 'ticket-1' });

    expect(result).toMatchObject({
      found: true,
      status: 'open',
      kind: 'requirement',
      scopeKey: 'project-a',
      latestArtifact: {
        kind: 'clarify',
        version: 1,
        summary: '澄清摘要',
      },
    });
  });

  it('工单不存在时返回 found=false', async () => {
    const tool = createReadTicketTool({
      tickets: new FakeTicketRepository(null),
      artifacts: new FakeArtifactRepository([]),
    });

    await expect(run(tool, { ticketId: 'missing' })).resolves.toMatchObject({
      found: false,
      status: null,
      latestArtifact: null,
    });
  });
});

describe('read-ticket tool 权限范围', () => {
  it('跨 scope 工单一律不可见', async () => {
    const tool = createReadTicketTool({
      tickets: new FakeTicketRepository(ticket()),
      artifacts: new FakeArtifactRepository([]),
      scopeKey: 'project-b',
    });

    await expect(run(tool, { ticketId: 'ticket-1' })).resolves.toMatchObject({
      found: false,
    });
  });
});
