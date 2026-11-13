"use client";
import {
	ArrowDownRightIcon,
	ArrowRightIcon,
	ArrowsClockwiseIcon,
	BellIcon,
	CaretDownIcon,
	CaretRightIcon,
	ChartBarIcon,
	ChatCircleDotsIcon,
	CheckCircleIcon,
	ClockIcon,
	HeadsetIcon,
	InfoIcon,
	ListIcon,
	MoonIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	QuestionIcon,
	SquaresFourIcon,
	SunIcon,
	TicketIcon,
	TrayIcon,
	UsersThreeIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	canSee,
	dateTime,
	isActive,
	publicMessages,
	type Ticket,
	type User,
} from "./domain";
import { Choice, EmptyState, PersonAvatar } from "./primitives";
import { users } from "./seed";
import { initialize, simulateEvent, useTickets } from "./store";
import { Team } from "./team";
import { TicketDetail } from "./ticket-detail";
import { NewTicket } from "./ticket-dialogs";
import { type Queue, TicketList } from "./ticket-list";

const profiles = [
	{ value: "marina", label: "Marina · Consultora" },
	{ value: "ricardo", label: "Ricardo · Gestor" },
	{ value: "helena", label: "Helena · Cliente" },
];
const roleLabels = {
	consultor: "Consultora de suporte",
	gestor: "Gestor de suporte",
	cliente: "Portal do cliente",
};
export default function Workspace() {
	const { data, baseline, events, error, persistent } = useTickets();
	const [profile, setProfile] = useState("marina");
	const [selected, setSelected] = useState<string | null>(null);
	const [section, setSection] = useState<"tickets" | "team">("tickets");
	const [queue, setQueue] = useState<Queue>("mine");
	const [newOpen, setNewOpen] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [simulation, setSimulation] = useState(false);
	const [simulating, setSimulating] = useState(false);
	const [now, setNow] = useState(0);
	const [reads, setReads] = useState<Record<string, string>>({});
	const { resolvedTheme, setTheme } = useTheme();
	const user: User = users.find((u) => u.id === profile) || users[0];
	useEffect(() => {
		void initialize();
		setNow(Date.now());
		const readUrl = () => {
			const params = new URLSearchParams(window.location.search);
			const id = params.get("perfil") || "marina";
			if (profiles.some((p) => p.value === id)) {
				setProfile(id);
				setQueue(id === "ricardo" ? "all" : "mine");
				setSection(id === "ricardo" ? "team" : "tickets");
			}
			setSelected(params.get("chamado"));
		};
		readUrl();
		try {
			const stored: unknown = JSON.parse(
				localStorage.getItem("ticket-reads") || "{}",
			);
			if (stored && typeof stored === "object" && !Array.isArray(stored))
				setReads(
					Object.fromEntries(
						Object.entries(stored).filter(([, v]) => typeof v === "string"),
					),
				);
		} catch {
			/* Empty read markers are safe. */
		}
		const clock = window.setInterval(() => setNow(Date.now()), 30000);
		const shortcut = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				!(
					e.target instanceof HTMLElement &&
					(e.target.closest("input,textarea,[contenteditable=true]") ||
						e.target.closest('[role="dialog"]'))
				)
			) {
				e.preventDefault();
				document
					.querySelector<HTMLInputElement>('[aria-label="Buscar chamados"]')
					?.focus();
			}
		};
		window.addEventListener("keydown", shortcut);
		window.addEventListener("popstate", readUrl);
		return () => {
			clearInterval(clock);
			window.removeEventListener("keydown", shortcut);
			window.removeEventListener("popstate", readUrl);
		};
	}, []);
	useEffect(() => {
		if (!simulation) return;
		const timer = window.setInterval(() => {
			void simulateEvent().catch(() =>
				toast.error("Falha ao simular atualização."),
			);
		}, 18000);
		return () => clearInterval(timer);
	}, [simulation]);
	function updateUrl(id: string | null, profileId = profile) {
		const params = new URLSearchParams({ perfil: profileId });
		if (id) params.set("chamado", id);
		window.history.pushState({}, "", `/?${params}`);
	}
	function markRead(id: string) {
		const next = { ...reads, [`${profile}:${id}`]: new Date().toISOString() };
		setReads(next);
		try {
			localStorage.setItem("ticket-reads", JSON.stringify(next));
		} catch {
			/* Nonessential per-viewer convenience. */
		}
	}
	function openTicket(id: string) {
		setSelected(id);
		setSection("tickets");
		setNotificationsOpen(false);
		markRead(id);
		updateUrl(id);
		window.scrollTo({ top: 0 });
	}
	function navigate(target: "tickets" | "team", nextQueue: Queue = "mine") {
		setSelected(null);
		setSection(target);
		setQueue(nextQueue);
		setMobileOpen(false);
		updateUrl(null);
	}
	function changeProfile(id: string) {
		setProfile(id);
		setSelected(null);
		setNewOpen(false);
		setNotificationsOpen(false);
		setSection(id === "ricardo" ? "team" : "tickets");
		setQueue(id === "ricardo" ? "all" : "mine");
		setMobileOpen(false);
		updateUrl(null, id);
	}
	if (!data)
		return (
			<div className="loading-screen">
				<span className="brand-icon">
					<HeadsetIcon size={24} />
				</span>
				<h1>Preparando seu espaço</h1>
				<p>Carregando chamados e atualizações…</p>
				<div className="loading-bar" />
			</div>
		);
	const tickets = data.chamados.filter((t) => canSee(user, t));
	const scope =
		user.perfil === "consultor"
			? tickets.filter((t) => t.consultor_id === user.id)
			: tickets;
	const active = scope.filter(isActive);
	function isUnread(t: Ticket) {
		if (!data) return false;
		const since =
			reads[`${profile}:${t.id}`] ||
			new Date(Date.parse(data.referencia) - 15 * 60000).toISOString();
		return publicMessages(data, t, user).some(
			(m) => m.usuario_id !== user.id && m.criado_em > since,
		);
	}
	const unread = scope.filter(isUnread);
	const risk = active.filter((t) => Date.parse(t.prazo_em) - now <= 7200000);
	const unassigned = tickets.filter((t) => !t.consultor_id && isActive(t));
	const selectedTicket = tickets.find((t) => t.id === selected);
	const client = user.perfil === "cliente";
	const manager = user.perfil === "gestor";
	const stats = client
		? []
		: [
				{
					label: manager ? "Em atendimento" : "Meus chamados ativos",
					value: active.length,
					text: manager ? "na fila da equipe" : "para acompanhar hoje",
					icon: TicketIcon,
					action: () => navigate("tickets", manager ? "all" : "mine"),
					tone: "",
				},
				{
					label: "Prazos em atenção",
					value: risk.length,
					text: `${risk.filter((t) => Date.parse(t.prazo_em) < now).length} em atraso · demais em até 2h`,
					icon: ClockIcon,
					action: () => navigate("tickets", "risk"),
					tone: "attention",
				},
				{
					label: "Aguardando responsável",
					value: unassigned.length,
					text: "na fila do seu grupo",
					icon: TrayIcon,
					action: () => navigate("tickets", "group"),
					tone: "",
				},
				{
					label: manager ? "Consultores disponíveis" : "Com novas mensagens",
					value: manager
						? data.usuarios.filter(
								(u) =>
									u.perfil === "consultor" &&
									u.grupo_id === user.grupo_id &&
									!tickets.some((t) => isActive(t) && t.consultor_id === u.id),
							).length
						: scope.filter(isUnread).length,
					text: manager
						? "sem chamados ativos atribuídos"
						: "novidades nos seus chamados",
					icon: manager ? UsersThreeIcon : ChatCircleDotsIcon,
					action: () => navigate(manager ? "team" : "tickets", "unread"),
					tone: "",
				},
			];
	async function simulate() {
		setSimulating(true);
		try {
			await simulateEvent();
			toast.success("Evento recebido. As filas foram atualizadas.");
		} catch {
			toast.error("Não foi possível simular o evento.");
		} finally {
			setSimulating(false);
		}
	}
	return (
		<div className="workspace">
			<a className="skip-link" href="#main-content">
				Pular para o conteúdo
			</a>
			{mobileOpen && (
				<button
					type="button"
					className="sidebar-backdrop"
					aria-label="Fechar menu"
					onClick={() => setMobileOpen(false)}
				/>
			)}
			<aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
				<a className="brand" href="/" aria-label="Mesa, início">
					<span className="brand-icon">
						<HeadsetIcon weight="bold" size={24} />
					</span>
					<span>
						mesa<span className="brand-period">.</span>
						<small>SERVICE WORKSPACE</small>
					</span>
				</a>
				<div className="workspace-selector">
					<span className="workspace-monogram">SO</span>
					<div>
						<strong>
							{client ? "Atlântico · Lisboa" : "Suporte e operações"}
						</strong>
						<small>
							{client ? "Seu espaço de suporte" : "Seu espaço de trabalho"}
						</small>
					</div>
					<CaretDownIcon size={13} />
				</div>
				<span className="nav-label">ESPAÇO DE TRABALHO</span>
				<nav aria-label="Navegação principal">
					<Button
						variant="ghost"
						className={`nav-item ${section === "tickets" ? "active" : ""}`}
						onClick={() => navigate("tickets", manager ? "all" : "mine")}
					>
						<TicketIcon size={19} />
						{client ? "Meus chamados" : "Chamados"}
						<span className="nav-count">{active.length}</span>
					</Button>
					{manager && (
						<Button
							variant="ghost"
							className={`nav-item ${section === "team" ? "active" : ""}`}
							onClick={() => navigate("team")}
						>
							<ChartBarIcon size={19} />
							Visão da equipe
						</Button>
					)}
					<Button
						variant="ghost"
						className="nav-item"
						onClick={() => setNotificationsOpen(true)}
					>
						<BellIcon size={19} />
						Atualizações
						{unread.length > 0 && (
							<span className="nav-notification">{unread.length}</span>
						)}
					</Button>
				</nav>
				{!client && (
					<>
						<span className="nav-label secondary-label">SUAS FILAS</span>
						<nav aria-label="Filas rápidas">
							<Button
								variant="ghost"
								className="nav-item secondary-nav"
								onClick={() => navigate("tickets", "risk")}
							>
								<span className="queue-dot warning-dot" />
								Prazos em atenção<span className="muted">{risk.length}</span>
							</Button>
							<Button
								variant="ghost"
								className="nav-item secondary-nav"
								onClick={() => navigate("tickets", "group")}
							>
								<span className="queue-dot" />
								Sem responsável
								<span className="muted">{unassigned.length}</span>
							</Button>
							<Button
								variant="ghost"
								className="nav-item secondary-nav"
								onClick={() => navigate("tickets", "closed")}
							>
								<CheckCircleIcon size={15} />
								Concluídos
							</Button>
						</nav>
					</>
				)}
				<div className="sidebar-bottom">
					<div className="demo-control">
						<span className="eyebrow">AMBIENTE DE DEMONSTRAÇÃO</span>
						<p>Experimente outra perspectiva.</p>
						<Choice
							label="Ver como outro perfil"
							value={profile}
							onChange={changeProfile}
							options={profiles}
						/>
						<span className="demo-caption">
							Dados simulados · salvos neste navegador
						</span>
					</div>
					<Button
						className="nav-item"
						variant="ghost"
						onClick={() => setHelpOpen(true)}
					>
						<QuestionIcon size={19} />
						Ajuda e atalhos
						<ArrowRightIcon size={15} />
					</Button>
					<div className="profile-card">
						<PersonAvatar name={user.nome} />
						<div>
							<strong>{user.nome}</strong>
							<small>{roleLabels[user.perfil]}</small>
						</div>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={
								resolvedTheme === "dark"
									? "Usar tema claro"
									: "Usar tema escuro"
							}
							onClick={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
						>
							{resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
						</Button>
					</div>
				</div>
			</aside>
			<div className="workspace-main">
				<header className="topbar">
					<div className="breadcrumb">
						<Button
							variant="ghost"
							size="icon-sm"
							className="mobile-menu"
							aria-label="Abrir menu"
							onClick={() => setMobileOpen(true)}
						>
							<ListIcon />
						</Button>
						<SquaresFourIcon size={17} />
						<span>{client ? "Portal do cliente" : "Workspace"}</span>
						<CaretRightIcon size={12} />
						<strong>{section === "team" ? "Equipe" : "Chamados"}</strong>
						{selectedTicket && (
							<>
								<CaretRightIcon size={12} />
								<span>#{selectedTicket.numero}</span>
							</>
						)}
					</div>
					<div className="topbar-right">
						<span className="live-status">
							<span />
							Sincronização local
						</span>
						<span className="topbar-divider" />
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Atualizações, ${unread.length} chamados com novidades`}
							onClick={() => setNotificationsOpen(true)}
						>
							<BellIcon size={19} />
							{unread.length > 0 && <span className="notification-dot" />}
						</Button>
						<PersonAvatar name={user.nome} />
					</div>
				</header>
				<main id="main-content" className="main-content">
					{error && (
						<div className="storage-warning" role="alert">
							<WarningCircleIcon size={18} />
							{error}
						</div>
					)}
					{selected ? (
						selectedTicket ? (
							<TicketDetail
								key={`${user.id}-${selected}`}
								ticket={selectedTicket}
								data={data}
								user={user}
								now={now}
								onBack={() => navigate("tickets", manager ? "all" : "mine")}
								markRead={markRead}
							/>
						) : (
							<>
								<Button variant="outline" onClick={() => navigate("tickets")}>
									Voltar para chamados
								</Button>
								<EmptyState
									title="Chamado não disponível"
									text="Este chamado não existe ou não está disponível para o perfil selecionado."
								/>
							</>
						)
					) : (
						<>
							<div className="page-heading">
								<div>
									<div className="eyebrow greeting">
										{client
											? "SEU CANAL DIRETO COM A EQUIPE"
											: new Intl.DateTimeFormat("pt-BR", {
													weekday: "long",
													day: "numeric",
													month: "long",
													timeZone: user.fuso,
												})
													.format(now)
													.toLocaleUpperCase()}
									</div>
									<h1>
										{client
											? "Como podemos ajudar, Helena?"
											: section === "team"
												? "Uma equipe, uma visão."
												: "Cada chamado, no seu tempo."}
									</h1>
									<p>
										{client
											? "Abra uma solicitação e acompanhe a solução por aqui."
											: section === "team"
												? "Equilibre os atendimentos e antecipe o que precisa de atenção."
												: "Seu dia começa por aqui. Saiba o que precisa de atenção primeiro."}
									</p>
								</div>
								<Button
									className="new-ticket-button"
									onClick={() => setNewOpen(true)}
								>
									<PlusIcon size={17} />
									Novo chamado
								</Button>
							</div>
							{!client && (
								<div className="stat-grid">
									{stats.map((s) => (
										<button
											type="button"
											key={s.label}
											onClick={s.action}
											className={`stat-card ${s.tone}`}
										>
											<div className="stat-top">
												<span>{s.label}</span>
												<s.icon size={19} />
											</div>
											<strong className="stat-number">
												{s.value.toString().padStart(2, "0")}
											</strong>
											<div className="stat-bottom">
												<span>{s.text}</span>
												<ArrowDownRightIcon size={15} />
											</div>
										</button>
									))}
								</div>
							)}
							{!client && section === "tickets" && risk.length > 0 && (
								<div className="attention-strip">
									<span className="attention-icon">
										<ClockIcon size={18} />
									</span>
									<p>
										<strong>{risk.length} chamados precisam de atenção.</strong>
										<span>
											{" "}
											Priorize os prazos mais próximos para manter tudo no
											caminho.
										</span>
									</p>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setQueue("risk")}
									>
										Ver chamados
										<ArrowRightIcon />
									</Button>
								</div>
							)}
							<div className="content-title">
								<div>
									<h2>
										{section === "team"
											? "Operação em tempo real"
											: client
												? "Seus atendimentos"
												: "Central de chamados"}
									</h2>
									<span>
										{section === "team"
											? "Suporte e operações"
											: client
												? "Horários de Lisboa"
												: "Suporte e operações · Horários de Brasília"}
									</span>
								</div>
								<div className="sync-indicator">
									<span className="live-dot" />
									Atualizado automaticamente
								</div>
							</div>
							{section === "team" && manager ? (
								<Team
									baseline={baseline || data}
									data={data}
									events={events}
									user={user}
									now={now}
									onOpen={openTicket}
								/>
							) : (
								<TicketList
									key={profile}
									tickets={tickets}
									data={data}
									user={user}
									now={now}
									queue={queue}
									setQueue={setQueue}
									onOpen={openTicket}
									isUnread={isUnread}
								/>
							)}
							<div className="workspace-footer">
								<span>
									<LockIcon />
									{persistent
										? "Alterações salvas neste navegador"
										: "Sessão temporária"}
								</span>
								<span>Menos ruído. Mais resolução.</span>
							</div>
						</>
					)}
				</main>
				<div className="simulation-bar">
					<span>
						<InfoIcon size={15} />
						<strong>Demonstração</strong>
						<span className="simulation-description">
							Eventos e dados simulados
						</span>
					</span>
					<div>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSimulation(!simulation)}
							aria-pressed={simulation}
						>
							{simulation ? <PauseIcon /> : <PlayIcon />}
							{simulation ? "Pausar eventos" : "Eventos automáticos"}
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={simulating}
							onClick={() => void simulate()}
						>
							<ArrowsClockwiseIcon />
							{simulating ? "Enviando…" : "Simular evento"}
						</Button>
					</div>
				</div>
			</div>
			<NewTicket
				key={profile}
				open={newOpen}
				onClose={() => setNewOpen(false)}
				data={data}
				user={user}
				onOpen={openTicket}
			/>
			<Dialog open={helpOpen} onOpenChange={setHelpOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Um espaço para resolver</DialogTitle>
						<DialogDescription>
							Explore as três perspectivas no seletor da barra lateral.
						</DialogDescription>
					</DialogHeader>
					<div className="help-content">
						<p>
							<strong>Marina · Consultora</strong>
							<br />
							Priorize por prazo, assuma chamados do grupo e alterne entre
							respostas e notas internas.
						</p>
						<p>
							<strong>Ricardo · Gestor</strong>
							<br />
							Compare a carga da equipe e abra um chamado para redistribuir o
							responsável.
						</p>
						<p>
							<strong>Helena · Cliente</strong>
							<br />
							Acompanhe seus atendimentos, responda e reabra um chamado quando
							precisar.
						</p>
						<p>
							<kbd>/</kbd> Buscar chamados <span className="shortcut-space" />
							<kbd>Ctrl / ⌘ + Enter</kbd> Enviar resposta
						</p>
						<p className="muted">
							Use duas abas com perfis diferentes para testar a sincronização.
							“Simular evento” alterna criação, mensagem, atribuição e status;
							repetições são deduplicadas. Esta demonstração não usa
							autenticação real.
						</p>
					</div>
				</DialogContent>
			</Dialog>
			<Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Novidades nos chamados</DialogTitle>
						<DialogDescription>
							Mensagens recebidas desde sua última leitura.
						</DialogDescription>
					</DialogHeader>
					<div className="notifications-list">
						{unread.length ? (
							unread.map((t) => (
								<button
									type="button"
									key={t.id}
									onClick={() => openTicket(t.id)}
								>
									<ChatCircleDotsIcon size={20} />
									<span>
										<small>#{t.numero}</small>
										<strong>{t.titulo}</strong>
										<small>
											{dateTime(
												publicMessages(data, t, user)
													.filter((m) => m.usuario_id !== user.id)
													.at(-1)?.criado_em || t.atualizado_em,
												user,
											)}
										</small>
									</span>
									<CaretRightIcon size={15} />
								</button>
							))
						) : (
							<EmptyState
								title="Você está em dia"
								text="As novas mensagens aparecerão aqui."
							/>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
function LockIcon() {
	return <CheckCircleIcon size={14} />;
}
