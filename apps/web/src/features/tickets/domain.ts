import { z } from "zod";

export const statuses = [
	"aberto",
	"em_atendimento",
	"aguardando_cliente",
	"resolvido",
	"fechado",
] as const;
export type Status = (typeof statuses)[number];
export type Role = "consultor" | "gestor" | "cliente";
export interface User {
	id: string;
	nome: string;
	perfil: Role;
	grupo_id: string;
	empresa: string;
	fuso: string;
}
export const statusLabels: Record<Status, string> = {
	aberto: "Recebido",
	em_atendimento: "Em atendimento",
	aguardando_cliente: "Aguardando você",
	resolvido: "Resolvido",
	fechado: "Fechado",
};
export const ticketSchema = z.object({
	id: z.string().min(1),
	numero: z.number().int().positive(),
	titulo: z.string().trim().min(3).max(160),
	descricao: z.string().trim().min(10).max(10000),
	cliente_id: z.string(),
	consultor_id: z.string().nullable(),
	grupo_id: z.string(),
	categoria: z.string(),
	prioridade: z.enum(["critica", "alta", "normal", "baixa"]),
	status: z.enum(statuses),
	criado_em: z.iso.datetime(),
	atualizado_em: z.iso.datetime(),
	prazo_em: z.iso.datetime(),
	relacionado_id: z.string().optional(),
});
export type Ticket = z.infer<typeof ticketSchema>;
export const messageSchema = z.object({
	id: z.string(),
	chamado_id: z.string(),
	usuario_id: z.string(),
	conteudo: z.string().trim().min(1).max(10000),
	interna: z.boolean(),
	criado_em: z.iso.datetime(),
});
export type Message = z.infer<typeof messageSchema>;
const envelope = { id: z.uuid(), ocorrido_em: z.iso.datetime() };
export const eventSchema = z.discriminatedUnion("tipo", [
	z.object({
		...envelope,
		tipo: z.literal("chamado.aberto"),
		payload: ticketSchema,
	}),
	z.object({
		...envelope,
		tipo: z.literal("chamado.atribuido"),
		payload: z.object({
			chamado_id: z.string(),
			consultor_id: z.string().nullable(),
		}),
	}),
	z.object({
		...envelope,
		tipo: z.literal("mensagem.adicionada"),
		payload: messageSchema,
	}),
	z.object({
		...envelope,
		tipo: z.literal("status.alterado"),
		payload: z.object({
			chamado_id: z.string(),
			de: z.enum(statuses),
			para: z.enum(statuses),
			motivo: z.string().trim().min(3).max(2000),
			usuario_id: z.string(),
		}),
	}),
]);
export type TicketEvent = z.infer<typeof eventSchema>;
export type EventInput = TicketEvent extends infer E
	? E extends TicketEvent
		? Pick<E, "tipo" | "payload">
		: never
	: never;
export interface StatusChange {
	id: string;
	chamado_id: string;
	de: Status;
	para: Status;
	motivo: string;
	usuario_id: string;
	ocorrido_em: string;
}
export interface Dataset {
	chamados: Ticket[];
	mensagens: Message[];
	historico: StatusChange[];
	usuarios: User[];
	grupos: { id: string; nome: string }[];
	referencia: string;
}
export const isActive = (t: Ticket) =>
	t.status !== "fechado" && t.status !== "resolvido";
export function canSee(user: User, ticket: Ticket) {
	return user.perfil === "cliente"
		? ticket.cliente_id === user.id
		: ticket.grupo_id === user.grupo_id;
}
export function publicMessages(data: Dataset, ticket: Ticket, user: User) {
	return canSee(user, ticket)
		? data.mensagens.filter(
				(m) =>
					m.chamado_id === ticket.id &&
					(user.perfil !== "cliente" || !m.interna),
			)
		: [];
}
export function canEdit(user: User, ticket: Ticket) {
	return (
		canSee(user, ticket) &&
		(user.perfil === "gestor" ||
			(user.perfil === "consultor" && ticket.consultor_id === user.id))
	);
}
export function validateCommand(data: Dataset, user: User, input: EventInput) {
	if (input.tipo === "chamado.aberto") {
		if (
			input.payload.cliente_id !== user.id ||
			input.payload.grupo_id !== user.grupo_id
		)
			throw new Error(
				"O chamado deve pertencer ao solicitante e ao seu grupo.",
			);
		return;
	}
	const ticket = data.chamados.find((t) => t.id === input.payload.chamado_id);
	if (!ticket || !canSee(user, ticket))
		throw new Error("Você não tem acesso a este chamado.");
	if (input.tipo === "mensagem.adicionada") {
		if (
			input.payload.usuario_id !== user.id ||
			(user.perfil === "cliente" && input.payload.interna)
		)
			throw new Error("Esta mensagem não é permitida para o seu perfil.");
		if (ticket.status === "fechado")
			throw new Error("Reabra o chamado antes de responder.");
	}
	if (input.tipo === "chamado.atribuido") {
		if (!isActive(ticket))
			throw new Error("Reabra o chamado antes de atribuir.");
		if (
			user.perfil !== "gestor" &&
			!(
				user.perfil === "consultor" &&
				!ticket.consultor_id &&
				input.payload.consultor_id === user.id
			)
		)
			throw new Error(
				"O chamado já foi assumido. Atualize a fila ou fale com a gestão.",
			);
		if (
			input.payload.consultor_id &&
			!data.usuarios.some(
				(u) =>
					u.id === input.payload.consultor_id &&
					u.perfil === "consultor" &&
					u.grupo_id === ticket.grupo_id,
			)
		)
			throw new Error("Escolha um consultor deste grupo.");
	}
	if (input.tipo === "status.alterado") {
		if (
			input.payload.usuario_id !== user.id ||
			input.payload.de !== ticket.status
		)
			throw new Error(
				"O status mudou. Confira a atualização e tente novamente.",
			);
		const reopening =
			user.perfil === "cliente" &&
			["fechado", "resolvido"].includes(ticket.status) &&
			input.payload.para === "aberto";
		if (!canEdit(user, ticket) && !reopening)
			throw new Error("Você não pode alterar este status.");
		if (input.payload.de === input.payload.para)
			throw new Error("Selecione um status diferente.");
	}
}

// Replay gives duplicate delivery and out-of-order arrival the same deterministic result.
// In production, use a server sequence/cursor; timestamps alone cannot establish causality.
export function replay(seed: Dataset, events: TicketEvent[]): Dataset {
	const chamados = new Map(seed.chamados.map((t) => [t.id, { ...t }]));
	const mensagens = new Map(seed.mensagens.map((m) => [m.id, m]));
	const historico = new Map(seed.historico.map((h) => [h.id, h]));
	const unique = new Map(events.map((e) => [e.id, e]));
	for (const event of [...unique.values()].sort(
		(a, b) =>
			a.ocorrido_em.localeCompare(b.ocorrido_em) || a.id.localeCompare(b.id),
	)) {
		if (event.tipo === "chamado.aberto") {
			if (!chamados.has(event.payload.id))
				chamados.set(event.payload.id, { ...event.payload });
			continue;
		}
		const ticket = chamados.get(event.payload.chamado_id);
		if (!ticket) continue;
		ticket.atualizado_em = event.ocorrido_em;
		if (event.tipo === "mensagem.adicionada")
			mensagens.set(event.payload.id, event.payload);
		if (event.tipo === "chamado.atribuido")
			ticket.consultor_id = event.payload.consultor_id;
		if (event.tipo === "status.alterado") {
			ticket.status = event.payload.para;
			historico.set(event.id, {
				id: event.id,
				...event.payload,
				ocorrido_em: event.ocorrido_em,
			});
		}
	}
	return {
		...seed,
		chamados: [...chamados.values()],
		mensagens: [...mensagens.values()],
		historico: [...historico.values()],
	};
}
export function sla(ticket: Ticket, now: number) {
	const minutes = Math.ceil((Date.parse(ticket.prazo_em) - now) / 60000);
	if (!isActive(ticket)) return { tone: "done", label: "Concluído", minutes };
	const duration = (m: number) =>
		m < 60
			? `${m} min`
			: `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
	if (minutes <= 0)
		return {
			tone: "danger",
			label: `${duration(Math.abs(minutes))} em atraso`,
			minutes,
		};
	return {
		tone: minutes <= 120 ? "warning" : "neutral",
		label: `${duration(minutes)} restantes`,
		minutes,
	};
}
export function dateTime(value: string, user: User) {
	return new Intl.DateTimeFormat(
		user.perfil === "cliente" ? "pt-PT" : "pt-BR",
		{
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
			timeZone: user.fuso,
		},
	).format(new Date(value));
}
export function initials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((n) => n[0])
		.join("");
}
