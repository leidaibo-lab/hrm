/** agentic 域查询键：整域失效用 all 前缀。 */
export const agenticKeys = {
  all: ['agentic'] as const,
  tickets: (filter: { status?: string; scopeKey?: string; limit?: number }) =>
    [...agenticKeys.all, 'tickets', filter] as const,
  ticket: (id: string) => [...agenticKeys.all, 'ticket', id] as const,
  attentions: () => [...agenticKeys.all, 'attentions'] as const,
};
