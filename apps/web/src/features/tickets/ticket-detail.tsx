"use client";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ChatCircleIcon,
	ClockIcon,
	LockSimpleIcon,
	PaperPlaneTiltIcon,
	UserCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	canEdit,
	type Dataset,
	dateTime,
	isActive,
	publicMessages,
	statusLabels,
	type Ticket,
	type User,
} from "./domain";
import {
	Choice,
	PersonAvatar,
	Priority,
	SlaBadge,
	StatusBadge,
	userName,
} from "./primitives";
import { command } from "./store";
import { ChangeStatus } from "./ticket-dialogs";

function Composer({
	ticket,
	user,
	internal,
}: {
	ticket: Ticket;
	user: User;
	internal: boolean;
}) {
	const key = `draft:${user.id}:${ticket.id}:${internal ? "internal" : "public"}`;
	const [text, setText] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const [loaded, setLoaded] = useState(false);
	useEffect(() => {
		try {
			setText(localStorage.getItem(key) || "");
		} catch {
			/* Draft stays in memory if storage is blocked. */
		}
		setLoaded(true);
	}, [key]);
	function update(value: string) {
		setText(value);
		try {
			localStorage.setItem(key, value);
		} catch {
			/* Keep typing available. */
		}
	}
	async function send() {
		if (!text.trim() || pending) return;
		setPending(true);
		setError("");
		try {
			await command(user, {
				tipo: "mensagem.adicionada",
				payload: {
					id: crypto.randomUUID(),
					chamado_id: ticket.id,
					usuario_id: user.id,
					conteudo: text.trim(),
					interna: internal,
					criado_em: new Date().toISOString(),
				},
			});
			update("");
			toast.success(
				internal ? "Nota interna registrada." : "Resposta enviada.",
			);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "Não foi possível enviar. Seu rascunho foi mantido.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<form
			className={`composer ${internal ? "internal-composer" : ""}`}
			onSubmit={(e) => {
				e.preventDefault();
				void send();
			}}
		>
			<Textarea
				aria-label={internal ? "Escrever nota interna" : "Escrever resposta"}
				placeholder={
					internal
						? "Registre o contexto para a equipe. O cliente não verá esta nota."
						: user.perfil === "cliente"
							? "Escreva sua mensagem para a equipe…"
							: "Escreva uma resposta para o cliente…"
				}
				value={text}
				onChange={(e) => update(e.target.value)}
				disabled={!loaded || pending}
				maxLength={10000}
				rows={4}
				onKeyDown={(e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
						e.preventDefault();
						void send();
					}
				}}
			/>
			{error && (
				<p role="alert" className="form-error">
					{error}
				</p>
			)}
			<div className="composer-bottom">
				<span>
					{internal ? (
						<>
							<LockSimpleIcon />
							Visível apenas para a equipe
						</>
					) : (
						<>
							<ChatCircleIcon />
							{user.perfil === "cliente"
								? "A equipe receberá sua mensagem"
								: "Visível para o cliente"}
						</>
					)}
				</span>
				<Button type="submit" disabled={!loaded || pending || !text.trim()}>
					<PaperPlaneTiltIcon />
					{pending ? "Enviando…" : internal ? "Salvar nota" : "Enviar resposta"}
				</Button>
			</div>
		</form>
	);
}
export function TicketDetail({
	ticket,
	data,
	user,
	now,
	onBack,
	markRead,
}: {
	ticket: Ticket;
	data: Dataset;
	user: User;
	now: number;
	onBack: () => void;
	markRead: (id: string) => void;
}) {
	const [internal, setInternal] = useState(false);
	const [statusOpen, setStatusOpen] = useState(false);
	const [assigning, setAssigning] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const end = useRef<HTMLDivElement>(null);
	const messages = publicMessages(data, ticket, user).sort((a, b) =>
		a.criado_em.localeCompare(b.criado_em),
	);
	const [seenCount, setSeenCount] = useState(messages.length);
	const client = user.perfil === "cliente";
	const history = data.historico
		.filter((h) => h.chamado_id === ticket.id)
		.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));
	const latestPublic = messages
		.filter(
			(m) =>
				!m.interna &&
				data.usuarios.find((u) => u.id === m.usuario_id)?.perfil !== "cliente",
		)
		.at(-1);
	const requester = data.usuarios.find((u) => u.id === ticket.cliente_id);
	const currentHistory = history.at(-1);
	const latestUpdate =
		currentHistory &&
		(!latestPublic || currentHistory.ocorrido_em > latestPublic.criado_em)
			? currentHistory.motivo
			: latestPublic?.conteudo;
	async function assign(id: string) {
		setAssigning(true);
		try {
			await command(user, {
				tipo: "chamado.atribuido",
				payload: {
					chamado_id: ticket.id,
					consultor_id: id === "none" ? null : id,
				},
			});
			toast.success("Responsável atualizado.");
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "Não foi possível atribuir.",
			);
		} finally {
			setAssigning(false);
		}
	}
	const viewNew = () => {
		end.current?.scrollIntoView({ behavior: "smooth", block: "center" });
		setSeenCount(messages.length);
		markRead(ticket.id);
	};
	return (
		<div className="detail-page">
			<Button variant="ghost" onClick={onBack} className="back-button">
				<ArrowLeftIcon />
				Voltar para chamados
			</Button>
			<div className="detail-heading">
				<div>
					<div className="ticket-meta">
						<span className="mono">CHAMADO #{ticket.numero}</span>
						<StatusBadge status={ticket.status} client={client} />
					</div>
					<h1>{ticket.titulo}</h1>
					<p>
						Aberto por{" "}
						{requester?.nome || userName(data.usuarios, ticket.cliente_id)} em{" "}
						{dateTime(ticket.criado_em, user)}
					</p>
				</div>
				{(canEdit(user, ticket) || (client && !isActive(ticket))) && (
					<Button variant="outline" onClick={() => setStatusOpen(true)}>
						{client ? "O problema voltou" : "Alterar status"}
						<ArrowRightIcon />
					</Button>
				)}
			</div>
			<div className="detail-grid">
				<div className="conversation-column">
					{client && (
						<section className="client-summary">
							<span className="eyebrow">ONDE ESTAMOS</span>
							<h2>
								{ticket.status === "aguardando_cliente"
									? "Precisamos de uma resposta sua"
									: ticket.status === "fechado" || ticket.status === "resolvido"
										? "Seu atendimento foi concluído"
										: ticket.consultor_id
											? `${userName(data.usuarios, ticket.consultor_id).split(" ")[0]} está cuidando do seu chamado`
											: "Seu chamado está na fila da equipe"}
							</h2>
							<p>
								{latestUpdate ||
									"Recebemos sua solicitação. Assim que alguém iniciar o atendimento, você verá a atualização aqui."}
							</p>
							<span className="muted small">
								{ticket.status === "aguardando_cliente"
									? "Próximo passo: responda à equipe abaixo."
									: !isActive(ticket)
										? "Se precisar, você pode reabrir este atendimento."
										: "Próximo passo: aguarde uma atualização da equipe."}
							</span>
						</section>
					)}
					<section className="conversation-panel">
						<div className="section-heading">
							<h2>
								Conversa <span className="count">{messages.length + 1}</span>
							</h2>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowHistory(!showHistory)}
							>
								<ClockIcon />
								{showHistory ? "Ocultar histórico" : "Histórico de status"}
							</Button>
						</div>
						<article className="message original-message">
							<PersonAvatar name={requester?.nome || "Solicitante"} />
							<div className="message-body">
								<header>
									<strong>{requester?.nome || "Solicitante"}</strong>
									<span>Solicitante</span>
									<time dateTime={ticket.criado_em}>
										{dateTime(ticket.criado_em, user)}
									</time>
								</header>
								<p>{ticket.descricao}</p>
							</div>
						</article>
						{showHistory && (
							<div className="status-history">
								<h3>Histórico de status</h3>
								{history.length ? (
									history.map((h) => (
										<article key={h.id}>
											<span className="history-dot" />
											<div>
												<strong>
													{statusLabels[h.de]} → {statusLabels[h.para]}
												</strong>
												<p>{h.motivo}</p>
												<small>
													{userName(data.usuarios, h.usuario_id)} ·{" "}
													{dateTime(h.ocorrido_em, user)}
												</small>
											</div>
										</article>
									))
								) : (
									<p>O chamado foi recebido e ainda não mudou de status.</p>
								)}
							</div>
						)}
						{messages.map((m) => (
							<article
								key={m.id}
								className={`message ${m.interna ? "internal-message" : ""}`}
							>
								<PersonAvatar name={userName(data.usuarios, m.usuario_id)} />
								<div className="message-body">
									<header>
										<strong>{userName(data.usuarios, m.usuario_id)}</strong>
										{m.interna ? (
											<span className="internal-label">
												<LockSimpleIcon size={12} />
												Nota interna
											</span>
										) : (
											<span>
												{data.usuarios.find((u) => u.id === m.usuario_id)
													?.perfil === "cliente"
													? "Solicitante"
													: "Equipe de suporte"}
											</span>
										)}
										<time dateTime={m.criado_em}>
											{dateTime(m.criado_em, user)}
										</time>
									</header>
									<p>{m.conteudo}</p>
								</div>
							</article>
						))}
						<div ref={end} />
						{messages.length > seenCount && (
							<Button
								className="new-messages"
								variant="secondary"
								onClick={viewNew}
							>
								<ArrowDownIcon />
								{messages.length - seenCount} nova(s) mensagem(ns) · ir para o
								final
							</Button>
						)}
						{ticket.status !== "fechado" ? (
							<div className="reply-area">
								{!client && (
									<div className="composer-tabs">
										<Button
											variant={!internal ? "secondary" : "ghost"}
											onClick={() => setInternal(false)}
										>
											<ChatCircleIcon />
											Responder ao cliente
										</Button>
										<Button
											variant={internal ? "secondary" : "ghost"}
											onClick={() => setInternal(true)}
										>
											<LockSimpleIcon />
											Nota interna
										</Button>
									</div>
								)}
								<Composer
									key={`${user.id}-${ticket.id}-${internal}`}
									user={user}
									ticket={ticket}
									internal={internal && !client}
								/>
							</div>
						) : (
							<div className="closed-notice">
								<LockSimpleIcon />
								Este chamado está fechado. Reabra para continuar a conversa.
							</div>
						)}
					</section>
				</div>
				<aside className="ticket-context">
					<section>
						<span className="eyebrow">ATENDIMENTO</span>
						<div className="context-item">
							<span>Responsável</span>
							<div className="person-line">
								<PersonAvatar
									name={userName(data.usuarios, ticket.consultor_id)}
								/>
								<strong>{userName(data.usuarios, ticket.consultor_id)}</strong>
							</div>
						</div>
						{!client &&
							!ticket.consultor_id &&
							user.perfil === "consultor" &&
							isActive(ticket) && (
								<Button
									className="full-width"
									disabled={assigning}
									onClick={() => void assign(user.id)}
								>
									<UserCircleIcon />
									{assigning ? "Assumindo…" : "Assumir chamado"}
								</Button>
							)}
						{user.perfil === "gestor" && isActive(ticket) && (
							<Choice
								label="Redistribuir chamado"
								value={ticket.consultor_id || "none"}
								disabled={assigning}
								options={[
									{ value: "none", label: "Sem responsável" },
									...data.usuarios
										.filter(
											(u) =>
												u.perfil === "consultor" &&
												u.grupo_id === ticket.grupo_id,
										)
										.map((u) => ({ value: u.id, label: u.nome })),
								]}
								onChange={(id) => void assign(id)}
							/>
						)}
						<div className="context-item">
							<span>
								{client ? "Prazo de atendimento" : "Prazo de resolução · SLA"}
							</span>
							<SlaBadge ticket={ticket} now={now} />
							<strong>{dateTime(ticket.prazo_em, user)}</strong>
							<small>
								{user.fuso === "Europe/Lisbon"
									? "Horário de Lisboa"
									: "Horário de Brasília"}
							</small>
							{isActive(ticket) && Date.parse(ticket.prazo_em) < now && (
								<p className="small">
									O prazo foi ultrapassado. A equipe precisa atualizar a
									previsão.
								</p>
							)}
						</div>
						{!client && (
							<>
								<div className="context-item">
									<span>Prioridade</span>
									<Priority value={ticket.prioridade} />
								</div>
								<div className="context-item">
									<span>Grupo de atendimento</span>
									<strong>
										{data.grupos.find((g) => g.id === ticket.grupo_id)?.nome}
									</strong>
								</div>
								<div className="context-item">
									<span>Categoria</span>
									<strong>{ticket.categoria}</strong>
								</div>
								<div className="context-item">
									<span>Organização</span>
									<strong>{requester?.empresa || "Equipe de suporte"}</strong>
								</div>
							</>
						)}
					</section>
					<div className="context-note">
						<ClockIcon size={18} />
						<p>
							{client
								? "Você pode voltar a esta página a qualquer momento para acompanhar as novidades."
								: "O prazo segue correndo enquanto aguardamos o cliente. A política desta demonstração usa horas corridas."}
						</p>
					</div>
				</aside>
			</div>
			{statusOpen && (
				<ChangeStatus
					ticket={ticket}
					user={user}
					open={statusOpen}
					onClose={() => setStatusOpen(false)}
				/>
			)}
		</div>
	);
}
