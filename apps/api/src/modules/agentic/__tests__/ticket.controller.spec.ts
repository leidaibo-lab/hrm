import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ArtifactService } from '../application/artifact.service';
import type { GateService } from '../application/gate.service';
import type { ScopeAccessService } from '../application/scope-access.service';
import type { TicketService } from '../application/ticket.service';
import type { TimelineService } from '../application/timeline.service';
import { TicketController } from '../ticket.controller';

class EndedTicketService {
  async detail(): Promise<{ ticket: { isOpen: boolean } }> {
    return { ticket: { isOpen: false } };
  }
}

describe('TicketController.restoreArtifact', () => {
  it('已结束工单返回 409', async () => {
    const controller = new TicketController(
      new EndedTicketService() as unknown as TicketService,
      {} as TimelineService,
      {} as ArtifactService,
      {} as GateService,
      {} as ScopeAccessService,
    );

    await expect(
      controller.restoreArtifact('ticket-1', 'clarify'),
    ).rejects.toThrow(ConflictException);
  });
});

class ThrowingGate {
  constructor(private readonly message: string) {}
  async revokeWriteback(): Promise<never> {
    throw new Error(this.message);
  }
}

function makeController(gate: GateService): TicketController {
  return new TicketController(
    {} as TicketService,
    {} as TimelineService,
    {} as ArtifactService,
    gate,
    {} as ScopeAccessService,
  );
}

describe('TicketController.revokeWriteback', () => {
  it('没有可撤销版本时返回 409', async () => {
    const controller = makeController(
      new ThrowingGate('没有可撤销的回填版本') as unknown as GateService,
    );
    await expect(controller.revokeWriteback('ticket-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('工单不存在时返回 404', async () => {
    const controller = makeController(
      new ThrowingGate('工单不存在：ticket-1') as unknown as GateService,
    );
    await expect(controller.revokeWriteback('ticket-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
