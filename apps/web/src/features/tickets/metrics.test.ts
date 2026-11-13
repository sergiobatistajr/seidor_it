import { expect, test } from "bun:test";
import type { TicketEvent } from "./domain";
import { idleMilliseconds } from "./metrics";
import { createSeed } from "./seed";

const now = Date.parse("2026-11-13T12:00:00.000Z");
const baseline = createSeed(now);
const minute = 60000;
test("idle measurement counts only periods without active assignments", () => {
	const events: TicketEvent[] = [
		{
			id: crypto.randomUUID(),
			ocorrido_em: new Date(now + 30 * minute).toISOString(),
			tipo: "chamado.atribuido",
			payload: { chamado_id: "chamado-0", consultor_id: "consultor-9" },
		},
		{
			id: crypto.randomUUID(),
			ocorrido_em: new Date(now + 60 * minute).toISOString(),
			tipo: "status.alterado",
			payload: {
				chamado_id: "chamado-0",
				de: "em_atendimento",
				para: "resolvido",
				motivo: "Acesso recuperado",
				usuario_id: "consultor-9",
			},
		},
	];
	expect(
		idleMilliseconds("consultor-9", baseline, events, now + 90 * minute),
	).toBe(60 * minute);
	expect(
		idleMilliseconds(
			"consultor-9",
			baseline,
			[...events].reverse(),
			now + 90 * minute,
		),
	).toBe(60 * minute);
	expect(idleMilliseconds("marina", baseline, events, now + 90 * minute)).toBe(
		0,
	);
});
test("idle window excludes unobserved history and is limited to seven days", () => {
	expect(idleMilliseconds("consultor-9", baseline, [], now + minute)).toBe(
		minute,
	);
	expect(
		idleMilliseconds("consultor-9", baseline, [], now + 10 * 86400000),
	).toBe(7 * 86400000);
});
