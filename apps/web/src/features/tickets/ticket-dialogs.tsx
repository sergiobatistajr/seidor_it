"use client";
import { ArrowUpRightIcon, PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	canSee,
	type Dataset,
	type Status,
	statuses,
	statusLabels,
	type Ticket,
	type User,
} from "./domain";
import { Choice, Field } from "./primitives";
import { command } from "./store";

export function NewTicket({
	open,
	onClose,
	data,
	user,
	onOpen,
}: {
	open: boolean;
	onClose: () => void;
	data: Dataset;
	user: User;
	onOpen: (id: string) => void;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const words = title
		.toLocaleLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 3);
	const related =
		title.length > 5
			? data.chamados
					.filter(
						(t) =>
							canSee(user, t) &&
							t.status === "fechado" &&
							words.some((w) => t.titulo.toLocaleLowerCase().includes(w)),
					)
					.slice(0, 2)
			: [];
	async function submit() {
		setPending(true);
		setError("");
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		try {
			await command(user, {
				tipo: "chamado.aberto",
				payload: {
					id,
					numero: Math.max(...data.chamados.map((t) => t.numero)) + 1,
					titulo: title.trim(),
					descricao: description.trim(),
					cliente_id: user.id,
					consultor_id: null,
					grupo_id: user.grupo_id,
					categoria: "A classificar",
					prioridade: "normal",
					status: "aberto",
					criado_em: now,
					atualizado_em: now,
					prazo_em: new Date(Date.now() + 8 * 3600000).toISOString(),
				},
			});
			setTitle("");
			setDescription("");
			onClose();
			onOpen(id);
			toast.success("Chamado aberto. A equipe foi avisada.");
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Não foi possível abrir o chamado.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v && !pending) onClose();
			}}
		>
			<DialogContent className="ticket-modal">
				<DialogHeader>
					<span className="eyebrow">ESTAMOS AQUI PARA AJUDAR</span>
					<DialogTitle>Novo chamado</DialogTitle>
					<DialogDescription>
						Conte o que aconteceu. A equipe cuida do encaminhamento.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
					className="form-stack"
				>
					<Field label="O que você precisa resolver?" htmlFor="new-title">
						<Input
							id="new-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Ex.: não consigo acessar meu e-mail"
							minLength={3}
							maxLength={160}
							required
						/>
					</Field>
					{related.length > 0 && (
						<div className="related-suggestions">
							<strong>Isso já aconteceu antes?</strong>
							<p>
								Você pode continuar um atendimento anterior e reabrir o chamado.
							</p>
							{related.map((t) => (
								<Button
									key={t.id}
									variant="ghost"
									type="button"
									onClick={() => {
										onClose();
										onOpen(t.id);
									}}
								>
									#{t.numero} · {t.titulo}
									<ArrowUpRightIcon />
								</Button>
							))}
						</div>
					)}
					<Field label="Descreva o problema" htmlFor="new-description">
						<Textarea
							id="new-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="O que você estava fazendo? Apareceu alguma mensagem de erro?"
							minLength={10}
							maxLength={10000}
							rows={5}
							required
						/>
					</Field>
					<p className="form-hint">
						Não inclua senhas ou códigos de acesso. Você receberá atualizações
						neste chamado.
					</p>
					{error && (
						<p className="form-error" role="alert">
							{error}
						</p>
					)}
					<div className="form-actions">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={pending}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={pending}>
							<PlusIcon />
							{pending ? "Abrindo…" : "Abrir chamado"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
export function ChangeStatus({
	ticket,
	user,
	open,
	onClose,
}: {
	ticket: Ticket;
	user: User;
	open: boolean;
	onClose: () => void;
}) {
	const [status, setStatus] = useState<Status>(
		ticket.status === "fechado" || ticket.status === "resolvido"
			? "aberto"
			: "resolvido",
	);
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const options = (
		user.perfil === "cliente"
			? ["aberto" as Status]
			: statuses.filter((s) => s !== ticket.status)
	).map((s) => ({
		value: s,
		label:
			s === "aberto"
				? "Reabrir / recebido"
				: s === "aguardando_cliente"
					? "Aguardando cliente"
					: statusLabels[s],
	}));
	async function submit() {
		setPending(true);
		setError("");
		try {
			await command(user, {
				tipo: "status.alterado",
				payload: {
					chamado_id: ticket.id,
					de: ticket.status,
					para: status,
					motivo: reason.trim(),
					usuario_id: user.id,
				},
			});
			onClose();
			toast.success("Status atualizado e motivo registrado.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
		} finally {
			setPending(false);
		}
	}
	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v && !pending) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{user.perfil === "cliente"
							? "O problema voltou?"
							: "Atualizar status"}
					</DialogTitle>
					<DialogDescription>
						O motivo fica no histórico e será visível para o cliente.
					</DialogDescription>
				</DialogHeader>
				<form
					className="form-stack"
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
				>
					<div className="form-field">
						<span>Novo status</span>
						<Choice
							label="Novo status"
							value={status}
							options={options}
							onChange={(v) => setStatus(v as Status)}
						/>
					</div>
					<Field label="O que aconteceu?" htmlFor="status-reason">
						<Textarea
							id="status-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							minLength={3}
							maxLength={2000}
							required
							rows={4}
							placeholder="Explique a mudança e o próximo passo…"
						/>
					</Field>
					{error && (
						<p role="alert" className="form-error">
							{error}
						</p>
					)}
					<div className="form-actions">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={pending}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={pending || status === ticket.status}
						>
							{pending
								? "Salvando…"
								: user.perfil === "cliente"
									? "Reabrir chamado"
									: "Salvar alteração"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
