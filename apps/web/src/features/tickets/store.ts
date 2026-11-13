"use client";

import { useSyncExternalStore } from "react";
import {
	type Dataset,
	type EventInput,
	eventSchema,
	isActive,
	replay,
	type TicketEvent,
	type User,
	validateCommand,
} from "./domain";
import { createSeed } from "./seed";

type Snapshot = {
	data: Dataset | null;
	baseline: Dataset | null;
	events: TicketEvent[];
	error: string | null;
	persistent: boolean;
};
const initial: Snapshot = {
	data: null,
	baseline: null,
	events: [],
	error: null,
	persistent: true,
};
let snapshot = initial;
let seed: Dataset;
let db: IDBDatabase | null = null;
let channel: BroadcastChannel | null = null;
let started: Promise<void> | null = null;
const listeners = new Set<() => void>();
const eventMap = new Map<string, TicketEvent>();
function publish() {
	snapshot = {
		...snapshot,
		data: replay(seed, [...eventMap.values()]),
		baseline: seed,
		events: [...eventMap.values()],
	};
	for (const fn of listeners) fn();
}
function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function completed(tx: IDBTransaction) {
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}
async function ingest(input: unknown, broadcast = false) {
	const event = eventSchema.parse(input);
	if (eventMap.has(event.id)) return;
	if (db) {
		try {
			const tx = db.transaction("events", "readwrite");
			const done = completed(tx);
			tx.objectStore("events").put(event);
			await done;
		} catch {
			snapshot = {
				...snapshot,
				persistent: false,
				error:
					"Armazenamento indisponível. As próximas alterações ficam apenas nesta sessão.",
			};
		}
	}
	eventMap.set(event.id, event);
	publish();
	if (broadcast) channel?.postMessage(event);
}
async function sync() {
	if (!db) return;
	try {
		const events = await request<TicketEvent[]>(
			db.transaction("events").objectStore("events").getAll(),
		);
		for (const raw of events) {
			const result = eventSchema.safeParse(raw);
			if (result.success) eventMap.set(result.data.id, result.data);
		}
		publish();
	} catch {
		snapshot = {
			...snapshot,
			error: "Não foi possível sincronizar o armazenamento local.",
		};
		publish();
	}
}
export function initialize() {
	if (started) return started;
	started = (async () => {
		try {
			const open = indexedDB.open("chamados-demo-v1", 1);
			open.onupgradeneeded = () => {
				open.result.createObjectStore("meta");
				open.result.createObjectStore("events", { keyPath: "id" });
			};
			db = await request(open);
			// One read/write transaction serializes initial seed creation across tabs.
			const tx = db.transaction("meta", "readwrite");
			const done = completed(tx);
			const get = tx.objectStore("meta").get("seed");
			seed = await new Promise<Dataset>((resolve, reject) => {
				get.onsuccess = () => {
					const value = get.result || createSeed();
					if (!get.result) tx.objectStore("meta").put(value, "seed");
					resolve(value);
				};
				get.onerror = () => reject(get.error);
			});
			await done;
			await sync();
		} catch {
			seed = createSeed();
			snapshot = {
				...snapshot,
				persistent: false,
				error:
					"O navegador bloqueou o armazenamento. Você pode explorar, mas as alterações não serão salvas ao recarregar.",
			};
		}
		if (typeof BroadcastChannel !== "undefined") {
			channel = new BroadcastChannel("chamados-events-v1");
			channel.onmessage = (e) => {
				void ingest(e.data).catch(() => {
					/* Ignore invalid transport envelopes. */
				});
			};
		}
		window.addEventListener("focus", () => void sync());
		// Reconcile missed events even when BroadcastChannel is unavailable.
		window.setInterval(() => void sync(), 5000);
		publish();
	})();
	return started;
}
export function useTickets() {
	return useSyncExternalStore(
		(fn) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		() => snapshot,
		() => initial,
	);
}
export async function command(user: User, input: EventInput) {
	const execute = async () => {
		await sync();
		if (!snapshot.data) throw new Error("Aguarde o carregamento dos chamados.");
		const lastTime = Math.max(
			0,
			...[...eventMap.values()].map((e) => Date.parse(e.ocorrido_em)),
		);
		const event = eventSchema.parse({
			...input,
			...(input.tipo === "chamado.aberto"
				? {
						payload: {
							...input.payload,
							numero:
								Math.max(...snapshot.data.chamados.map((t) => t.numero)) + 1,
						},
					}
				: {}),
			id: crypto.randomUUID(),
			ocorrido_em: new Date(Math.max(Date.now(), lastTime + 1)).toISOString(),
		});
		validateCommand(snapshot.data, user, event);
		await ingest(event, true);
		return event;
	};
	// Mimics compare-and-set for competing assignments in tabs of the same origin.
	return navigator.locks
		? navigator.locks.request("chamados-command", execute)
		: execute();
}
let simulationStep = 0;
async function runSimulation() {
	await sync();
	if (!snapshot.data) return;
	const lastTime = Math.max(
		0,
		...[...eventMap.values()].map((e) => Date.parse(e.ocorrido_em)),
	);
	const now = new Date(Math.max(Date.now(), lastTime + 1)).toISOString();
	const available = snapshot.data.chamados.filter((t) => isActive(t));
	const ticket =
		available.find((t) => t.cliente_id === "helena") || available[0];
	if (!ticket) return;
	const step = simulationStep++ % 4;
	let input: EventInput;
	if (step === 0)
		input = {
			tipo: "mensagem.adicionada",
			payload: {
				id: crypto.randomUUID(),
				chamado_id: ticket.id,
				usuario_id: ticket.cliente_id,
				interna: false,
				criado_em: now,
				conteudo:
					"Acabei de fazer uma nova tentativa e o problema continua. Conseguem me atualizar sobre o atendimento?",
			},
		};
	else if (step === 1)
		input = {
			tipo: "chamado.aberto",
			payload: {
				...ticket,
				id: crypto.randomUUID(),
				numero: Math.max(...snapshot.data.chamados.map((t) => t.numero)) + 1,
				titulo: "Acesso à rede indisponível na recepção",
				descricao:
					"A equipe da recepção está sem acesso à rede desde esta manhã. Outros setores continuam conectados normalmente.",
				consultor_id: null,
				cliente_id: "cliente-1",
				status: "aberto",
				criado_em: now,
				atualizado_em: now,
				prazo_em: new Date(Date.now() + 7200000).toISOString(),
			},
		};
	else if (step === 2) {
		const unassigned = available.find((t) => !t.consultor_id);
		if (!unassigned) return;
		input = {
			tipo: "chamado.atribuido",
			payload: { chamado_id: unassigned.id, consultor_id: "consultor-0" },
		};
	} else {
		const other = available.find(
			(t) =>
				t.consultor_id === "consultor-0" && t.status !== "aguardando_cliente",
		);
		if (!other) return;
		input = {
			tipo: "status.alterado",
			payload: {
				chamado_id: other.id,
				de: other.status,
				para: "aguardando_cliente",
				usuario_id: "consultor-0",
				motivo:
					"Aplicamos um ajuste. Por favor, tente acessar novamente e nos conte se funcionou.",
			},
		};
	}
	const event = eventSchema.parse({
		...input,
		id: crypto.randomUUID(),
		ocorrido_em: now,
	});
	await ingest(event, true);
	await ingest(event, true); // Deliberate duplicate delivery exercises idempotency.
}

export async function simulateEvent() {
	return navigator.locks
		? navigator.locks.request("chamados-command", runSimulation)
		: runSimulation();
}
