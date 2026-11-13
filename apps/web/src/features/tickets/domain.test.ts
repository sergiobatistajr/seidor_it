import { describe, expect, test } from "bun:test";
import {
	canSee,
	eventSchema,
	publicMessages,
	replay,
	sla,
	type TicketEvent,
	validateCommand,
} from "./domain";
import { createSeed, users } from "./seed";

const now = Date.parse("2026-11-13T12:00:00.000Z");
const seed = createSeed(now);
const marina = users[0];
const manager = users[1];
const helena = users[2];
const ticket = seed.chamados[0];
function statusEvent(
	seconds: number,
	para: "resolvido" | "fechado" | "aberto",
	de: "em_atendimento" | "resolvido" | "fechado" = "em_atendimento",
): TicketEvent {
	return {
		id: crypto.randomUUID(),
		tipo: "status.alterado",
		ocorrido_em: new Date(now + seconds * 1000).toISOString(),
		payload: {
			chamado_id: ticket.id,
			de,
			para,
			motivo: "Alteração solicitada no atendimento.",
			usuario_id: marina.id,
		},
	};
}
describe("event delivery", () => {
	test("duplicate messages and status events are applied once", () => {
		const message: TicketEvent = {
			id: crypto.randomUUID(),
			tipo: "mensagem.adicionada",
			ocorrido_em: new Date(now).toISOString(),
			payload: {
				id: "test-message",
				chamado_id: ticket.id,
				usuario_id: helena.id,
				interna: false,
				conteudo: "O problema continua.",
				criado_em: new Date(now).toISOString(),
			},
		};
		const status = statusEvent(1, "resolvido");
		const result = replay(seed, [message, message, status, status]);
		expect(
			result.mensagens.filter((m) => m.id === "test-message"),
		).toHaveLength(1);
		expect(result.historico.filter((h) => h.id === status.id)).toHaveLength(1);
	});
	test("out-of-order events cannot revert the newest status", () => {
		const resolved = statusEvent(1, "resolvido");
		const closed = statusEvent(2, "fechado", "resolvido");
		const reopened = statusEvent(3, "aberto", "fechado");
		expect(replay(seed, [reopened, resolved, closed]).chamados[0].status).toBe(
			"aberto",
		);
		expect(replay(seed, [resolved, closed, reopened])).toEqual(
			replay(seed, [reopened, resolved, closed]),
		);
		expect(seed.chamados[0].status).toBe("em_atendimento");
	});
	test("opening arriving after its message replays in occurrence order", () => {
		const opened: TicketEvent = {
			id: crypto.randomUUID(),
			tipo: "chamado.aberto",
			ocorrido_em: new Date(now).toISOString(),
			payload: { ...ticket, id: "new-ticket" },
		};
		const message: TicketEvent = {
			id: crypto.randomUUID(),
			tipo: "mensagem.adicionada",
			ocorrido_em: new Date(now + 1000).toISOString(),
			payload: {
				id: "new-message",
				chamado_id: "new-ticket",
				usuario_id: helena.id,
				interna: false,
				conteudo: "Atualização do problema",
				criado_em: new Date(now + 1000).toISOString(),
			},
		};
		expect(
			replay(seed, [message, opened]).mensagens.some(
				(m) => m.id === "new-message",
			),
		).toBe(true);
	});
	test("invalid envelopes and blank reasons are rejected at the boundary", () => {
		const status = statusEvent(1, "resolvido");
		expect(
			eventSchema.safeParse({ ...status, ocorrido_em: "yesterday" }).success,
		).toBe(false);
		expect(
			eventSchema.safeParse({
				...status,
				payload: { ...status.payload, motivo: "  " },
			}).success,
		).toBe(false);
	});
});
describe("profile access and commands", () => {
	test("customer sees only own tickets and public messages", () => {
		expect(canSee(helena, ticket)).toBe(true);
		expect(canSee(helena, seed.chamados[2])).toBe(false);
		expect(publicMessages(seed, ticket, helena).every((m) => !m.interna)).toBe(
			true,
		);
		expect(publicMessages(seed, seed.chamados[2], helena)).toHaveLength(0);
		expect(publicMessages(seed, ticket, marina).some((m) => m.interna)).toBe(
			true,
		);
	});
	test("customer cannot submit an internal message or impersonate a colleague", () => {
		const input = {
			tipo: "mensagem.adicionada" as const,
			payload: {
				id: "test",
				chamado_id: ticket.id,
				usuario_id: helena.id,
				interna: true,
				conteudo: "Nota",
				criado_em: new Date(now).toISOString(),
			},
		};
		expect(() => validateCommand(seed, helena, input)).toThrow();
		expect(() =>
			validateCommand(seed, helena, {
				...input,
				payload: { ...input.payload, interna: false, usuario_id: marina.id },
			}),
		).toThrow();
	});
	test("only one consultant can claim an unassigned ticket", () => {
		const unassigned = seed.chamados.find((t) => !t.consultor_id)!;
		const input = {
			tipo: "chamado.atribuido" as const,
			payload: { chamado_id: unassigned.id, consultor_id: marina.id },
		};
		expect(() => validateCommand(seed, marina, input)).not.toThrow();
		const assigned = replay(seed, [
			{
				...input,
				id: crypto.randomUUID(),
				ocorrido_em: new Date(now + 1).toISOString(),
			},
		]);
		expect(() =>
			validateCommand(assigned, users[3], {
				...input,
				payload: { ...input.payload, consultor_id: users[3].id },
			}),
		).toThrow();
		expect(() =>
			validateCommand(assigned, manager, {
				...input,
				payload: { ...input.payload, consultor_id: users[3].id },
			}),
		).not.toThrow();
	});
	test("status rejects stale expected value", () => {
		const input = statusEvent(1, "resolvido");
		if (input.tipo !== "status.alterado") throw new Error("invalid fixture");
		expect(() =>
			validateCommand(seed, marina, {
				...input,
				payload: { ...input.payload, de: "fechado" },
			}),
		).toThrow("O status mudou");
	});
	test("customer can reopen own closed ticket with reason", () => {
		const closed = replay(seed, [statusEvent(1, "fechado")]);
		const reopen = statusEvent(2, "aberto", "fechado");
		if (reopen.tipo !== "status.alterado") throw new Error("invalid fixture");
		expect(() =>
			validateCommand(closed, helena, {
				...reopen,
				payload: { ...reopen.payload, usuario_id: helena.id },
			}),
		).not.toThrow();
		expect(() =>
			validateCommand(closed, helena, {
				...reopen,
				payload: {
					...reopen.payload,
					usuario_id: helena.id,
					para: "resolvido",
				},
			}),
		).toThrow();
	});
});
describe("SLA", () => {
	test("distinguishes overdue, soon due, normal and completed without pausing for customer", () => {
		expect(
			sla({ ...ticket, prazo_em: new Date(now - 60000).toISOString() }, now)
				.tone,
		).toBe("danger");
		expect(sla(ticket, now).tone).toBe("warning");
		expect(
			sla(
				{ ...ticket, prazo_em: new Date(now + 3 * 3600000).toISOString() },
				now,
			).tone,
		).toBe("neutral");
		expect(sla({ ...ticket, status: "fechado" }, now).tone).toBe("done");
		expect(
			sla(
				{
					...ticket,
					status: "aguardando_cliente",
					prazo_em: new Date(now - 60000).toISOString(),
				},
				now,
			).tone,
		).toBe("danger");
	});
	test("all demonstration fixtures conform to the boundary schema", () => {
		for (const t of seed.chamados)
			expect(
				eventSchema.safeParse({
					id: crypto.randomUUID(),
					tipo: "chamado.aberto",
					ocorrido_em: seed.referencia,
					payload: t,
				}).success,
			).toBe(true);
	});
});
