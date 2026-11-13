"use client";
import { ArrowRightIcon, InfoIcon } from "@phosphor-icons/react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type Dataset,
	dateTime,
	isActive,
	type TicketEvent,
	type User,
} from "./domain";
import { idleMilliseconds } from "./metrics";
import { EmptyState, PersonAvatar, SlaBadge } from "./primitives";
export function Team({
	data,
	baseline,
	user,
	now,
	events,
	onOpen,
}: {
	data: Dataset;
	baseline: Dataset;
	user: User;
	now: number;
	events: TicketEvent[];
	onOpen: (id: string) => void;
}) {
	const active = data.chamados.filter(
		(t) => t.grupo_id === user.grupo_id && isActive(t),
	);
	const consultants = data.usuarios
		.filter((u) => u.perfil === "consultor" && u.grupo_id === user.grupo_id)
		.map((u) => ({
			...u,
			count: active.filter((t) => t.consultor_id === u.id).length,
			risk: active.filter(
				(t) =>
					t.consultor_id === u.id && Date.parse(t.prazo_em) - now <= 7200000,
			).length,
		}))
		.sort((a, b) => b.count - a.count);
	const max = Math.max(...consultants.map((u) => u.count), 1);
	const risk = active
		.filter((t) => Date.parse(t.prazo_em) - now <= 7200000)
		.sort((a, b) => a.prazo_em.localeCompare(b.prazo_em));
	return (
		<div className="team-grid">
			<section className="team-panel">
				<div className="section-heading">
					<div>
						<h2>Distribuição da equipe</h2>
						<p>{consultants.length} consultores · chamados ativos atribuídos</p>
					</div>
					<span className="neutral-tag">Carga atual</span>
				</div>
				<Table className="team-table">
					<TableHeader>
						<TableRow>
							<TableHead>Consultor</TableHead>
							<TableHead>Chamados ativos</TableHead>
							<TableHead>Prazo ≤ 2h</TableHead>
							<TableHead>Sem chamados¹</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{consultants.map((u) => {
							const idle = Math.floor(
								idleMilliseconds(u.id, baseline, events, now) / 60000,
							);
							return (
								<TableRow key={u.id}>
									<TableCell>
										<div className="requester">
											<PersonAvatar name={u.nome} />
											<div>
												<strong>{u.nome}</strong>
												<small>
													{u.count === 0
														? "Sem chamados atribuídos"
														: `${u.count} em andamento`}
												</small>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Tooltip>
											<TooltipTrigger
												className="workload"
												aria-label={`${u.nome}: ${u.count} chamados ativos`}
											>
												<span className="workload-track">
													<span
														style={{ width: `${(u.count / max) * 100}%` }}
													/>
												</span>
												<strong>{u.count}</strong>
											</TooltipTrigger>
											<TooltipContent>
												{u.nome}: {u.count} chamados ativos. Escala de 0 a {max}
												.
											</TooltipContent>
										</Tooltip>
									</TableCell>
									<TableCell>
										{u.risk ? (
											<span className="risk-count">{u.risk} em atenção</span>
										) : (
											<span className="muted">—</span>
										)}
									</TableCell>
									<TableCell className="mono">
										{idle < 60
											? `${idle} min`
											: `${Math.floor(idle / 60)}h ${idle % 60}m`}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
				<div className="coverage-note">
					<InfoIcon size={18} />
					<p>
						<strong>¹ Período observado, últimos 7 dias.</strong> Contagem de
						horas corridas sem nenhum chamado ativo atribuído, a partir de{" "}
						{dateTime(data.referencia, user)}. Não há histórico anterior na
						demonstração; este valor não representa uma semana completa nem mede
						produtividade.
					</p>
				</div>
			</section>
			<aside className="team-risk">
				<div className="section-heading">
					<div>
						<span className="eyebrow">PRÓXIMAS 2 HORAS</span>
						<h2>Precisam de atenção</h2>
					</div>
				</div>
				{risk.length ? (
					risk.slice(0, 8).map((t) => (
						<button
							type="button"
							className="risk-ticket"
							key={t.id}
							onClick={() => onOpen(t.id)}
						>
							<span className="mono">#{t.numero}</span>
							<strong>{t.titulo}</strong>
							<div>
								<SlaBadge ticket={t} now={now} />
								<ArrowRightIcon />
							</div>
							<small>
								{data.usuarios.find((u) => u.id === t.consultor_id)?.nome ||
									"Sem responsável"}
							</small>
						</button>
					))
				) : (
					<EmptyState
						title="Prazos sob controle"
						text="Nenhum chamado vence nas próximas duas horas."
					/>
				)}
				<div className="team-tip">
					<InfoIcon size={18} />
					<p>
						Abra um chamado para redistribuir o atendimento. O novo responsável
						verá a mudança na fila imediatamente.
					</p>
				</div>
			</aside>
		</div>
	);
}
