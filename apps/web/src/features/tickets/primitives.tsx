"use client";
import {
	CheckCircleIcon,
	CircleIcon,
	ClockIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import type { ComponentProps } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	initials,
	type Status,
	sla,
	statusLabels,
	type Ticket,
	type User,
} from "./domain";

export function PersonAvatar({
	name,
	large = false,
}: {
	name: string;
	large?: boolean;
}) {
	return (
		<span
			className={`person-avatar ${large ? "large" : ""}`}
			aria-hidden="true"
		>
			{initials(name)}
		</span>
	);
}
export function StatusBadge({
	status,
	client = false,
}: {
	status: Status;
	client?: boolean;
}) {
	return (
		<span className={`status-badge status-${status}`}>
			<span className="status-dot" />
			{status === "aguardando_cliente" && !client
				? "Aguardando cliente"
				: statusLabels[status]}
		</span>
	);
}
export function SlaBadge({ ticket, now }: { ticket: Ticket; now: number }) {
	const s = sla(ticket, now);
	const Icon =
		s.tone === "danger"
			? WarningCircleIcon
			: s.tone === "done"
				? CheckCircleIcon
				: ClockIcon;
	return (
		<span className={`sla-badge ${s.tone}`}>
			<Icon size={14} />
			{s.label}
		</span>
	);
}
export const priorityLabels = {
	critica: "Crítica",
	alta: "Alta",
	normal: "Normal",
	baixa: "Baixa",
};
export function Priority({ value }: { value: Ticket["prioridade"] }) {
	return (
		<span className={`priority priority-${value}`}>
			<span className="priority-bars" aria-hidden="true">
				<i />
				<i />
				<i />
			</span>
			{priorityLabels[value]}
		</span>
	);
}
export function Choice({
	label,
	value,
	onChange,
	options,
	className = "",
	disabled = false,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
	className?: string;
	disabled?: boolean;
}) {
	return (
		<Select
			value={value}
			onValueChange={(v) => {
				if (v !== null) onChange(v);
			}}
			disabled={disabled}
			items={options}
		>
			<SelectTrigger aria-label={label} className={className}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((o) => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
export function EmptyState({ title, text }: { title: string; text: string }) {
	return (
		<div className="empty-state">
			<CircleIcon size={32} weight="thin" />
			<h3>{title}</h3>
			<p>{text}</p>
		</div>
	);
}
export function Field({
	label,
	children,
	htmlFor,
	...props
}: ComponentProps<"label"> & { label: string; htmlFor: string }) {
	return (
		<label className="form-field" htmlFor={htmlFor} {...props}>
			<span>{label}</span>
			{children}
		</label>
	);
}
export function userName(users: User[], id: string | null) {
	return users.find((u) => u.id === id)?.nome || "Sem responsável";
}
