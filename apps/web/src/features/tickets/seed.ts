import type { Dataset, Status, User } from "./domain";

export const users: User[] = [
	{
		id: "marina",
		nome: "Marina Costa",
		perfil: "consultor",
		grupo_id: "suporte",
		empresa: "Equipe de suporte",
		fuso: "America/Sao_Paulo",
	},
	{
		id: "ricardo",
		nome: "Ricardo Almeida",
		perfil: "gestor",
		grupo_id: "suporte",
		empresa: "Equipe de suporte",
		fuso: "America/Sao_Paulo",
	},
	{
		id: "helena",
		nome: "Helena Martins",
		perfil: "cliente",
		grupo_id: "suporte",
		empresa: "Atlântico · Lisboa",
		fuso: "Europe/Lisbon",
	},
	...[
		"Lucas Oliveira",
		"Beatriz Santos",
		"Pedro Lima",
		"Ana Ferreira",
		"Gabriel Souza",
		"Camila Rocha",
		"Rafael Alves",
		"Juliana Dias",
		"Bruno Melo",
		"Carolina Reis",
		"André Nunes",
	].map(
		(nome, i): User => ({
			id: `consultor-${i}`,
			nome,
			perfil: "consultor",
			grupo_id: "suporte",
			empresa: "Equipe de suporte",
			fuso: "America/Sao_Paulo",
		}),
	),
	...["João Pereira", "Sofia Ribeiro", "Miguel Carvalho", "Laura Gomes"].map(
		(nome, i): User => ({
			id: `cliente-${i}`,
			nome,
			perfil: "cliente",
			grupo_id: "suporte",
			empresa: [
				"Norte Logística",
				"Horizonte Saúde",
				"Orbe Tecnologia",
				"Vértice Engenharia",
			][i],
			fuso: "America/Sao_Paulo",
		}),
	),
];
const subjects = [
	[
		"Não consigo acessar o sistema financeiro",
		"Desde esta manhã, o sistema financeiro apresenta a mensagem ‘Não foi possível conectar’. Já reiniciei o computador e tentei em outro navegador, mas o problema continua. Preciso concluir o fechamento do mês. Podem me ajudar?",
		"Acesso e permissões",
	],
	[
		"VPN desconecta durante o trabalho",
		"A conexão VPN cai a cada dez minutos e interrompe o acesso aos documentos da equipe. A internet funciona normalmente nos outros aplicativos.",
		"Conectividade",
	],
	[
		"E-mails não estão sendo recebidos",
		"Os e-mails enviados por clientes não aparecem na caixa de entrada desde ontem. Já conferi a pasta de spam e o espaço disponível.",
		"E-mail e colaboração",
	],
	[
		"Erro ao emitir nota fiscal",
		"Ao finalizar a emissão de uma nota fiscal, aparece um erro de validação. O cadastro foi revisado, mas ainda não conseguimos continuar.",
		"Sistemas de negócio",
	],
	[
		"Impressora do escritório está offline",
		"A impressora aparece offline para toda a equipe. Já verificamos o cabo de rede e reiniciamos o equipamento.",
		"Equipamentos",
	],
	[
		"Permissão para acessar a pasta de projetos",
		"Preciso acessar a pasta compartilhada do novo projeto. O acesso foi aprovado pela minha liderança, mas ainda aparece a mensagem de permissão negada.",
		"Acesso e permissões",
	],
	[
		"Sistema de pedidos muito lento",
		"As consultas de pedidos estão demorando mais de um minuto para carregar. O comportamento começou hoje e afeta diferentes pessoas na equipe.",
		"Sistemas de negócio",
	],
	[
		"Falha na sincronização de arquivos",
		"As alterações nos arquivos compartilhados não aparecem para o restante da equipe. A sincronização fica parada e não exibe mensagem de erro.",
		"E-mail e colaboração",
	],
	[
		"Monitor externo não é reconhecido",
		"O monitor conectado à estação de trabalho não está sendo reconhecido. Já testei o cabo em outro computador e ele funciona normalmente.",
		"Equipamentos",
	],
	[
		"Recuperação de acesso à conta",
		"Troquei de telefone e não consigo usar a autenticação em duas etapas. Preciso recuperar o acesso à conta corporativa.",
		"Acesso e permissões",
	],
];
export function createSeed(now = Date.now()): Dataset {
	const iso = (minutes: number) =>
		new Date(now + minutes * 60000).toISOString();
	const chamados: Dataset["chamados"] = Array.from({ length: 84 }, (_, i) => {
		const subject = subjects[i % subjects.length];
		const status: Status =
			i >= 74
				? "fechado"
				: i % 9 === 6
					? "aguardando_cliente"
					: i % 11 === 8
						? "resolvido"
						: i >= 40 && i < 51
							? "aberto"
							: "em_atendimento";
		return {
			id: `chamado-${i}`,
			numero: 2048 - i,
			titulo: subject[0],
			descricao: subject[1],
			categoria: subject[2],
			cliente_id: [0, 1, 74, 81].includes(i) ? "helena" : `cliente-${i % 4}`,
			consultor_id: i < 40 ? "marina" : i < 51 ? null : `consultor-${i % 9}`,
			grupo_id: "suporte",
			prioridade:
				i === 0 || i === 3
					? "critica"
					: i % 5 === 0
						? "alta"
						: i % 7 === 0
							? "baixa"
							: "normal",
			status,
			criado_em: iso(-120 - i * 95),
			atualizado_em: iso(-8 - i * 13),
			prazo_em: iso(
				i === 3
					? -32
					: i === 0
						? 24
						: i === 1
							? 47
							: i === 2
								? 78
								: i < 7
									? 90 + i * 4
									: 190 + i * 33,
			),
		};
	});
	const mensagens: Dataset["mensagens"] = chamados.flatMap((t, i) => [
		...(t.consultor_id
			? [
					{
						id: `mensagem-${i}-1`,
						chamado_id: t.id,
						usuario_id: t.consultor_id,
						conteudo:
							i === 0
								? "Olá, Helena! Já estou verificando o acesso ao sistema financeiro. Identifiquei uma instabilidade na autenticação e estou trabalhando com a equipe responsável. Aviso por aqui assim que tivermos uma atualização."
								: "Olá! Recebemos sua solicitação e começamos a análise. Vou acompanhar o problema e trazer a próxima atualização por aqui.",
						interna: false,
						criado_em: iso(-70 - i * 95),
					},
				]
			: []),
		...(i < 5
			? [
					{
						id: `mensagem-${i}-2`,
						chamado_id: t.id,
						usuario_id: "consultor-0",
						conteudo:
							"A falha foi reproduzida no ambiente de teste. Verificar o serviço de autenticação antes de solicitar nova tentativa ao cliente.",
						interna: true,
						criado_em: iso(-25 - i * 13),
					},
				]
			: []),
		...(i < 3
			? [
					{
						id: `mensagem-${i}-3`,
						chamado_id: t.id,
						usuario_id: t.cliente_id,
						conteudo:
							i === 0
								? "Obrigada pelo retorno. Acabei de tentar novamente e o erro continua. Há alguma previsão? Temos pagamentos para concluir hoje."
								: "O problema continua acontecendo. Conseguiram identificar o que pode ser?",
						interna: false,
						criado_em: iso(-8 - i * 13),
					},
				]
			: []),
	]);
	return {
		chamados,
		mensagens,
		usuarios: users,
		grupos: [{ id: "suporte", nome: "Suporte e operações" }],
		referencia: iso(0),
		historico: chamados
			.filter((t) => t.status !== "aberto")
			.map((t) => ({
				id: `historico-${t.id}`,
				chamado_id: t.id,
				de: "aberto",
				para: t.status,
				motivo:
					t.status === "fechado"
						? "O acesso foi restabelecido e a solução foi confirmada."
						: t.status === "resolvido"
							? "A correção foi aplicada. Por favor, confirme se está tudo funcionando."
							: t.status === "aguardando_cliente"
								? "Precisamos que você teste novamente e nos informe se o erro continua."
								: "A equipe iniciou a análise da solicitação.",
				usuario_id: t.consultor_id || "marina",
				ocorrido_em: t.atualizado_em,
			})),
	};
}
