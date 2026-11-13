"use client";
import {
	ArrowDownIcon,
	ArrowRightIcon,
	CaretLeftIcon,
	CaretRightIcon,
	ChatCircleDotsIcon,
	MagnifyingGlassIcon,
	SlidersHorizontalIcon,
	TicketIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type Dataset,
	dateTime,
	isActive,
	type Ticket,
	type User,
} from "./domain";
import {
	Choice,
	EmptyState,
	PersonAvatar,
	Priority,
	SlaBadge,
	StatusBadge,
} from "./primitives";

export type Queue = "mine" | "group" | "all" | "closed" | "risk" | "unread";
export function TicketList({
	tickets,
	data,
	user,
	now,
	queue,
	setQueue,
	onOpen,
	isUnread,
}: {
	tickets: Ticket[];
	data: Dataset;
	user: User;
	now: number;
	queue: Queue;
	setQueue: (q: Queue) => void;
	onOpen: (id: string) => void;
	isUnread: (t: Ticket) => boolean;
}) {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const [sort, setSort] = useState("deadline");
	const [page, setPage] = useState(0);
	const [filterOpen, setFilterOpen] = useState(false);
	const client = user.perfil === "cliente";
	const matchQueue = (t: Ticket, q: Queue) =>
		q === "mine"
			? isActive(t) && (client || t.consultor_id === user.id)
			: q === "group"
				? isActive(t) && !t.consultor_id
				: q === "closed"
					? !isActive(t)
					: q === "risk"
						? isActive(t) &&
							Date.parse(t.prazo_em) - now <= 7200000 &&
							(user.perfil !== "consultor" || t.consultor_id === user.id)
						: q === "unread"
							? isUnread(t) &&
								(user.perfil !== "consultor" || t.consultor_id === user.id)
							: isActive(t);
	const tabs: { key: Queue; label: string }[] = client
		? [
				{ key: "mine", label: "Em andamento" },
				{ key: "closed", label: "Concluídos" },
			]
		: [
				{
					key: user.perfil === "gestor" ? "all" : "mine",
					label:
						user.perfil === "gestor" ? "Todos os chamados" : "Meus chamados",
				},
				{ key: "group", label: "Fila do grupo" },
				...(user.perfil !== "gestor"
					? [{ key: "all" as Queue, label: "Todos" }]
					: []),
				{ key: "closed", label: "Concluídos" },
			];
	const query = search.trim().toLocaleLowerCase();
	const filtered = tickets
		.filter(
			(t) =>
				matchQueue(t, queue) &&
				(status === "all" || t.status === status) &&
				(!query ||
					[
						String(t.numero),
						t.titulo,
						t.descricao,
						data.usuarios.find((u) => u.id === t.cliente_id)?.nome || "",
					].some((s) => s.toLocaleLowerCase().includes(query))),
		)
		.sort((a, b) =>
			sort === "recent"
				? b.atualizado_em.localeCompare(a.atualizado_em)
				: a.prazo_em.localeCompare(b.prazo_em),
		);
	const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
	const currentPage = Math.min(page, pageCount - 1);
	const visible = filtered.slice(currentPage * 10, currentPage * 10 + 10);
	return (
		<section className="ticket-list">
			<div className="queue-tabs">
				{tabs.map((tab) => (
					<Button
						key={tab.key}
						variant="ghost"
						className={queue === tab.key ? "queue-tab active" : "queue-tab"}
						onClick={() => {
							setQueue(tab.key);
							setPage(0);
						}}
						aria-pressed={queue === tab.key}
					>
						{tab.label}
						<span>{tickets.filter((t) => matchQueue(t, tab.key)).length}</span>
					</Button>
				))}
				{(queue === "risk" || queue === "unread") && (
					<Button
						className="queue-tab active"
						variant="ghost"
						onClick={() => setQueue("all")}
					>
						{queue === "risk" ? "Prazos em atenção" : "Com novidades"} ×
					</Button>
				)}
			</div>
			<div className="list-toolbar">
				<div className="search-input">
					<MagnifyingGlassIcon size={17} />
					<Input
						aria-label="Buscar chamados"
						placeholder={
							client
								? "Buscar nos seus chamados…"
								: "Buscar por número, assunto ou solicitante…"
						}
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(0);
						}}
					/>
					<kbd>/</kbd>
				</div>
				<div className="list-toolbar-actions">
					<Button
						variant="outline"
						onClick={() => setFilterOpen(!filterOpen)}
						aria-expanded={filterOpen}
					>
						<SlidersHorizontalIcon />
						Filtros{status !== "all" && <span className="filter-dot" />}
					</Button>
					<Choice
						label="Ordenar chamados"
						value={sort}
						onChange={setSort}
						options={[
							{ value: "deadline", label: "Menor prazo primeiro" },
							{ value: "recent", label: "Atualizados recentemente" },
						]}
					/>
				</div>
			</div>
			{filterOpen && (
				<div className="filter-row">
					<span>Status</span>
					<Choice
						label="Filtrar por status"
						value={status}
						onChange={(v) => {
							setStatus(v);
							setPage(0);
						}}
						options={[
							{ value: "all", label: "Todos os status" },
							{ value: "aberto", label: "Recebido" },
							{ value: "em_atendimento", label: "Em atendimento" },
							{
								value: "aguardando_cliente",
								label: client ? "Aguardando você" : "Aguardando cliente",
							},
							{ value: "resolvido", label: "Resolvido" },
							{ value: "fechado", label: "Fechado" },
						]}
					/>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setStatus("all");
							setSearch("");
						}}
					>
						Limpar filtros
					</Button>
				</div>
			)}
			{client ? (
				<div className="client-tickets">
					{visible.map((t) => (
						<button
							type="button"
							className="client-ticket"
							key={t.id}
							onClick={() => onOpen(t.id)}
						>
							<div className="client-ticket-top">
								<span className="mono">#{t.numero}</span>
								<StatusBadge status={t.status} client />
								{isUnread(t) && (
									<span className="unread-label">Nova resposta</span>
								)}
							</div>
							<h2>{t.titulo}</h2>
							<p>
								{t.status === "aguardando_cliente"
									? "A equipe precisa de uma resposta sua para continuar."
									: !isActive(t)
										? "Atendimento concluído. Se o problema voltar, você pode reabrir."
										: t.consultor_id
											? `${data.usuarios.find((u) => u.id === t.consultor_id)?.nome.split(" ")[0]} está cuidando do seu chamado.`
											: "Recebemos seu chamado. A equipe iniciará o atendimento."}
							</p>
							<div className="client-ticket-footer">
								<span>
									<SlaBadge ticket={t} now={now} />
								</span>
								<span>
									Ver atendimento <ArrowRightIcon />
								</span>
							</div>
						</button>
					))}
				</div>
			) : (
				<Table className="tickets-table">
					<TableHeader>
						<TableRow>
							<TableHead className="subject-col">Chamado</TableHead>
							<TableHead>Solicitante</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Prioridade</TableHead>
							<TableHead>
								<span className="inline-label">
									Prazo de resolução <ArrowDownIcon size={12} />
								</span>
							</TableHead>
							<TableHead className="table-arrow">
								<span className="sr-only">Abrir chamado</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{visible.map((t) => {
							const requester = data.usuarios.find(
								(u) => u.id === t.cliente_id,
							);
							return (
								<TableRow
									key={t.id}
									className={isUnread(t) ? "has-unread" : ""}
								>
									<TableCell>
										<div className="ticket-subject">
											<span className="ticket-row-icon">
												<TicketIcon size={18} />
											</span>
											<div>
												<button
													type="button"
													onClick={() => onOpen(t.id)}
													className="ticket-title"
												>
													{t.titulo}
												</button>
												<div className="ticket-subline">
													<span className="mono">#{t.numero}</span>
													<span className="subline-dot">·</span>
													<span>{t.categoria}</span>
													{isUnread(t) && (
														<span className="unread-label">
															<ChatCircleDotsIcon size={12} />
															Nova mensagem
														</span>
													)}
												</div>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="requester">
											<PersonAvatar name={requester?.nome || "Solicitante"} />
											<div>
												<span>{requester?.nome || "Solicitante"}</span>
												<small>{requester?.empresa}</small>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<StatusBadge status={t.status} />
									</TableCell>
									<TableCell>
										<Priority value={t.prioridade} />
									</TableCell>
									<TableCell>
										<div className="deadline-cell">
											<SlaBadge ticket={t} now={now} />
											<small>{dateTime(t.prazo_em, user)}</small>
										</div>
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Abrir chamado ${t.numero}`}
											onClick={() => onOpen(t.id)}
										>
											<CaretRightIcon />
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}
			{filtered.length === 0 && (
				<EmptyState
					title="Nenhum chamado por aqui"
					text={
						query || status !== "all"
							? "Tente outra busca ou remova os filtros."
							: "Os chamados desta fila aparecerão aqui, em tempo real."
					}
				/>
			)}
			<footer className="list-footer">
				<span>
					{filtered.length
						? `${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, filtered.length)} de ${filtered.length} chamados`
						: "0 chamados"}
				</span>
				<div>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Página anterior"
						disabled={currentPage === 0}
						onClick={() => setPage(currentPage - 1)}
					>
						<CaretLeftIcon />
					</Button>
					<span>
						Página {currentPage + 1} de {pageCount}
					</span>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label="Próxima página"
						disabled={currentPage + 1 >= pageCount}
						onClick={() => setPage(currentPage + 1)}
					>
						<CaretRightIcon />
					</Button>
				</div>
			</footer>
		</section>
	);
}
