import { type Dataset, isActive, replay, type TicketEvent } from "./domain";

/** Integrates intervals with no active assignments over the observed part of seven days.
 * Calendar time is deliberate: working hours/holidays require an explicit tenant policy.
 */
export function idleMilliseconds(
	userId: string,
	baseline: Dataset,
	events: TicketEvent[],
	now: number,
) {
	const start = Math.max(Date.parse(baseline.referencia), now - 7 * 86400000);
	const sorted = [...new Map(events.map((e) => [e.id, e])).values()].sort(
		(a, b) =>
			a.ocorrido_em.localeCompare(b.ocorrido_em) || a.id.localeCompare(b.id),
	);
	let previous = start;
	let idle = 0;
	let processed = sorted.filter((e) => Date.parse(e.ocorrido_em) <= start);
	let state = replay(baseline, processed);
	for (const event of sorted.filter(
		(e) =>
			Date.parse(e.ocorrido_em) > start && Date.parse(e.ocorrido_em) <= now,
	)) {
		const time = Date.parse(event.ocorrido_em);
		if (!state.chamados.some((t) => t.consultor_id === userId && isActive(t)))
			idle += time - previous;
		previous = time;
		processed = [...processed, event];
		state = replay(baseline, processed);
	}
	if (!state.chamados.some((t) => t.consultor_id === userId && isActive(t)))
		idle += now - previous;
	return Math.max(0, idle);
}
