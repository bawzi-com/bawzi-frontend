'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  BookOpen,
  Rocket,
  Radar,
  BrainCircuit,
  BellRing,
  FileText,
  UsersRound,
  Shield,
  CreditCard,
  Lock,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Lightbulb,
  Menu,
  X,
  ExternalLink,
  Building2,
  Bell,
  Settings,
  BarChart2,
} from 'lucide-react';

// ─── Tipagem ──────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  articles: Article[];
}

interface Article {
  id: string;
  title: string;
}

// ─── Estrutura de navegação ───────────────────────────────────────────────────
const NAV: Section[] = [
  {
    id: 'inicio',
    label: 'Início rápido',
    icon: Rocket,
    articles: [
      { id: 'o-que-e-bawzi', title: 'O que é a Bawzi?' },
      { id: 'criar-conta', title: 'Criar conta' },
      { id: 'primeiros-passos', title: 'Primeiros passos' },
    ],
  },
  {
    id: 'busca',
    label: 'Busca de Editais',
    icon: Search,
    articles: [
      { id: 'busca-pncp', title: 'Busca no PNCP' },
      { id: 'filtros', title: 'Filtros e refinamento' },
      { id: 'salvar-edital', title: 'Salvar e acompanhar editais' },
    ],
  },
  {
    id: 'analise',
    label: 'Análise com IA',
    icon: BrainCircuit,
    articles: [
      { id: 'score-go-nogo', title: 'Score GO / NO-GO' },
      { id: 'relatorio-ia', title: 'Relatório de análise' },
      { id: 'match-cnae', title: 'Match CNAE' },
    ],
  },
  {
    id: 'radar',
    label: 'Radar de Alertas',
    icon: Radar,
    articles: [
      { id: 'configurar-radar', title: 'Configurar palavras-chave' },
      { id: 'alertas-email', title: 'Alertas por e-mail' },
      { id: 'push-notifications', title: 'Notificações push' },
    ],
  },
  {
    id: 'contratos',
    label: 'Contratos',
    icon: FileText,
    articles: [
      { id: 'monitorar-contratos', title: 'Monitorar contratos' },
      { id: 'alertas-vencimento', title: 'Alertas de vencimento' },
    ],
  },
  {
    id: 'concorrentes',
    label: 'Concorrentes',
    icon: BarChart2,
    articles: [
      { id: 'monitorar-concorrentes', title: 'Monitorar concorrentes' },
      { id: 'historico-lances', title: 'Histórico de lances' },
    ],
  },
  {
    id: 'equipe',
    label: 'Gestão de Equipe',
    icon: UsersRound,
    articles: [
      { id: 'workspace', title: 'Workspace' },
      { id: 'convidar-membros', title: 'Convidar membros' },
      { id: 'funcoes', title: 'Funções e permissões' },
      { id: 'empresas-monitoradas', title: 'Empresas monitoradas' },
      { id: 'downgrade-empresas', title: 'Reduzir plano (empresas)' },
    ],
  },
  {
    id: 'conta',
    label: 'Conta & Segurança',
    icon: Shield,
    articles: [
      { id: 'perfil', title: 'Editar perfil' },
      { id: '2fa', title: 'Autenticação em dois fatores' },
      { id: 'sessao', title: 'Sessão e dispositivos' },
    ],
  },
  {
    id: 'planos',
    label: 'Planos & Assinatura',
    icon: CreditCard,
    articles: [
      { id: 'comparar-planos', title: 'Comparar planos' },
      { id: 'upgrade', title: 'Fazer upgrade' },
      { id: 'cancelamento', title: 'Cancelamento' },
    ],
  },
  {
    id: 'privacidade',
    label: 'Privacidade & LGPD',
    icon: Lock,
    articles: [
      { id: 'lgpd-consentimento', title: 'Consentimento LGPD' },
      { id: 'seus-dados', title: 'Seus dados na Bawzi' },
      { id: 'revogar', title: 'Revogar consentimento' },
    ],
  },
];

// ─── Helpers de conteúdo ──────────────────────────────────────────────────────
function Callout({ type, children }: { type: 'tip' | 'info' | 'warning'; children: React.ReactNode }) {
  const styles = {
    tip:     { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-800', Icon: Lightbulb,    iconColor: 'text-emerald-600' },
    info:    { bg: 'bg-sky-50',      border: 'border-sky-200',     text: 'text-sky-800',     Icon: Info,         iconColor: 'text-sky-600'     },
    warning: { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-800',   Icon: AlertCircle,  iconColor: 'text-amber-600'   },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-3 rounded-xl border p-4 my-4 ${s.bg} ${s.border}`}>
      <s.Icon size={18} className={`mt-0.5 shrink-0 ${s.iconColor}`} />
      <p className={`text-sm leading-relaxed ${s.text}`}>{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 my-5">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
          {n}
        </div>
        <div className="w-px flex-1 bg-emerald-100 min-h-[8px]" />
      </div>
      <div className="pb-4">
        <p className="font-semibold text-slate-800 mb-1">{title}</p>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      {children}
    </span>
  );
}

function PlanBadge({ plan }: { plan: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite' }) {
  const colors: Record<string, string> = {
    Gratuito:  'bg-slate-100 text-slate-600 border-slate-200',
    Essencial: 'bg-sky-50 text-sky-700 border-sky-200',
    Pro:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    Elite:     'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[plan]}`}>
      {plan}
    </span>
  );
}

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-xl font-bold text-slate-900 mt-10 mb-4 scroll-mt-24">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5 my-3 pl-1">{children}</ul>;
}
function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
      <span>{children}</span>
    </li>
  );
}

// ─── Conteúdo das seções ──────────────────────────────────────────────────────
function SectionInicio() {
  return (
    <>
      <H2 id="o-que-e-bawzi">O que é a Bawzi?</H2>
      <P>
        A Bawzi é uma plataforma de inteligência artificial especializada em licitações públicas brasileiras.
        Ela conecta empresas às oportunidades do <strong>Portal Nacional de Contratações Públicas (PNCP)</strong> e
        aplica IA para transformar editais complexos em decisões claras: vale ou não vale participar?
      </P>
      <P>Com a Bawzi você:</P>
      <UL>
        <LI>Monitora novos editais 24h por dia com alertas automáticos</LI>
        <LI>Recebe um score GO / NO-GO com base no perfil da sua empresa</LI>
        <LI>Acompanha contratos vigentes e recebe aviso antes do vencimento</LI>
        <LI>Monitora concorrentes e histórico de lances em pregões</LI>
        <LI>Gerencia a equipe comercial num único workspace</LI>
      </UL>
      <Callout type="tip">
        A Bawzi consome dados diretamente do PNCP — a fonte oficial do Governo Federal — garantindo que
        as informações sejam sempre atualizadas e confiáveis.
      </Callout>

      <H2 id="criar-conta">Criar conta</H2>
      <Step n={1} title="Acesse bawzi.com e clique em 'Criar conta grátis'">
        Você pode criar uma conta com e-mail e senha ou se autenticar com o Google em um clique.
      </Step>
      <Step n={2} title="Preencha seus dados e o CNPJ da empresa">
        O CNPJ é usado para identificar o perfil da empresa no banco de dados oficial e alimentar o Match CNAE
        na análise de editais. Você pode informar o CNPJ durante o cadastro ou depois no perfil.
      </Step>
      <Step n={3} title="Confirme o e-mail (se aplicável)">
        Ao criar conta com e-mail e senha, você receberá um link de confirmação. Verifique a caixa de spam
        se não encontrar na caixa de entrada.
      </Step>
      <Step n={4} title="Explore o painel">
        Após o login, você cai direto no painel principal com acesso à busca, radar e análises.
      </Step>
      <Callout type="info">
        O plano gratuito dá acesso à busca básica e a uma análise de edital por mês. Para uso intensivo,
        veja os planos pagos em <strong>Perfil → Assinatura</strong>.
      </Callout>

      <H2 id="primeiros-passos">Primeiros passos</H2>
      <P>Recomendamos seguir esta sequência para extrair o máximo da plataforma desde o primeiro dia:</P>
      <Step n={1} title="Configure o perfil da empresa">
        Em <strong>Perfil → Minha empresa</strong>, informe o CNPJ, ramo de atuação e UF. Esses dados
        melhoram a precisão do Match CNAE e dos alertas do Radar.
      </Step>
      <Step n={2} title="Configure o Radar com palavras-chave">
        Em <strong>Radar</strong>, adicione os termos que descrevem seus produtos ou serviços (ex.: "consultoria TI",
        "material de limpeza", "engenharia civil"). O Radar monitorará o PNCP e enviará alertas quando
        um edital contendo esses termos for publicado.
      </Step>
      <Step n={3} title="Analise o primeiro edital">
        Na busca, encontre um edital relevante e clique em <strong>Analisar com IA</strong>. Em segundos você
        recebe o score GO/NO-GO e o relatório completo.
      </Step>
      <Step n={4} title="Ative as notificações push">
        Em <strong>Perfil → Privacidade & Notificações</strong>, clique em <strong>Ativar notificações</strong>
        para receber alertas do Radar direto no navegador, mesmo com a aba fechada.
      </Step>
    </>
  );
}

function SectionBusca() {
  return (
    <>
      <H2 id="busca-pncp">Busca no PNCP</H2>
      <P>
        A busca da Bawzi consulta o PNCP em tempo real. Você pode pesquisar por palavra-chave no objeto
        do edital, número do processo ou CNPJ do órgão contratante.
      </P>
      <H3>Como pesquisar</H3>
      <Step n={1} title="Acesse a barra de busca no topo da plataforma">
        Digite o termo desejado — objeto, número do edital ou nome do órgão — e pressione Enter.
      </Step>
      <Step n={2} title="Aguarde os resultados">
        Os resultados chegam diretamente do PNCP e são ordenados por data de publicação (mais recente primeiro).
      </Step>
      <Step n={3} title="Abra o edital de interesse">
        Clique no título do edital para ver o resumo, documentos, prazos e o botão de análise IA.
      </Step>
      <Callout type="tip">
        Use aspas para buscar uma frase exata: <strong>"serviços de limpeza predial"</strong> traz apenas
        editais com esse trecho, eliminando resultados genéricos.
      </Callout>

      <H2 id="filtros">Filtros e refinamento</H2>
      <P>Os filtros disponíveis na busca são:</P>
      <UL>
        <LI><strong>UF / Município</strong> — limite os resultados a uma região específica</LI>
        <LI><strong>Modalidade</strong> — Pregão Eletrônico, Concorrência, Dispensa, Credenciamento etc.</LI>
        <LI><strong>Período</strong> — data de publicação ou data de abertura das propostas</LI>
        <LI><strong>Valor estimado</strong> — faixa de valor global do edital</LI>
        <LI><strong>Órgão</strong> — filtre por esfera (Federal, Estadual, Municipal) ou CNPJ do órgão</LI>
      </UL>
      <Callout type="info">
        Filtros combinados reduzem drasticamente o ruído. Para serviços locais, sempre filtre por UF para
        evitar editais de outros estados.
      </Callout>

      <H2 id="salvar-edital">Salvar e acompanhar editais</H2>
      <P>
        Clique no ícone de <strong>bookmark</strong> para salvar um edital na sua lista de acompanhamento.
        Editais salvos ficam em <strong>Gestão → Meus editais</strong> e você recebe alertas caso o status
        mude (adiamento, cancelamento, retificação).
      </P>
      <Callout type="warning">
        Editais cancelados ainda aparecem na lista com o status atualizado. Não os exclua — eles servem
        de referência histórica para negociações futuras.
      </Callout>
    </>
  );
}

function SectionAnalise() {
  return (
    <>
      <H2 id="score-go-nogo">Score GO / NO-GO</H2>
      <P>
        O score GO/NO-GO é o coração da Bawzi. Ele analisa o edital completo e retorna uma recomendação
        objetiva: <Tag>GO ✅</Tag> (vale participar) ou <Tag>NO-GO ❌</Tag> (não vale), acompanhada da
        pontuação de 0 a 100 e dos principais fatores que influenciaram a decisão.
      </P>
      <H3>O que a IA avalia</H3>
      <UL>
        <LI><strong>Match CNAE</strong> — o objeto do edital corresponde à atividade econômica da sua empresa?</LI>
        <LI><strong>Habilitação jurídica e fiscal</strong> — quais certidões e documentos são exigidos?</LI>
        <LI><strong>Capacidade técnica</strong> — há exigências de atestados, equipe mínima ou certificações?</LI>
        <LI><strong>Risco jurídico</strong> — penalidades, cláusulas leoninas, prazo de execução agressivo</LI>
        <LI><strong>Pressão de preço</strong> — valor estimado vs. histórico de deságio nessa categoria</LI>
        <LI><strong>Localização</strong> — distância do órgão contratante vs. logística da sua empresa</LI>
      </UL>
      <Callout type="tip">
        Um score abaixo de 50 não significa que você não pode ganhar — significa que o edital apresenta
        mais riscos do que o padrão. Use o relatório para decidir se vale o investimento de tempo.
      </Callout>

      <H2 id="relatorio-ia">Relatório de análise</H2>
      <P>
        Além do score, a Bawzi gera um relatório estruturado com:
      </P>
      <UL>
        <LI><strong>Resumo executivo</strong> — objeto, valor, prazo, modalidade e órgão em linguagem simples</LI>
        <LI><strong>Pontos de atenção</strong> — cláusulas que merecem revisão antes de licitar</LI>
        <LI><strong>Documentos exigidos</strong> — lista de habilitação extraída automaticamente do edital</LI>
        <LI><strong>Estimativa de preço</strong> — baseada no histórico de contratos similares no PNCP</LI>
        <LI><strong>Recomendação final</strong> — GO, NO-GO ou ATENÇÃO (quando o resultado depende de dados que a empresa precisa confirmar)</LI>
      </UL>
      <Callout type="info">
        Os relatórios ficam salvos no histórico por 90 dias no plano Starter e por tempo ilimitado no Pro e Enterprise.
      </Callout>

      <H2 id="match-cnae">Match CNAE</H2>
      <P>
        O Match CNAE compara os CNAEs principais e secundários da sua empresa (via Receita Federal)
        com o objeto do edital. O resultado é expresso em porcentagem de compatibilidade.
      </P>
      <P>
        Para configurar ou atualizar os CNAEs reconhecidos, acesse <strong>Perfil → Minha empresa</strong> e
        informe o CNPJ. A Bawzi consulta a Receita automaticamente.
      </P>
      <Callout type="warning">
        Se o CNPJ estiver desatualizado na Receita Federal, o Match CNAE pode ficar impreciso. Verifique
        seus CNAEs no site da Receita antes de confiar 100% neste indicador.
      </Callout>
    </>
  );
}

function SectionRadar() {
  return (
    <>
      <H2 id="configurar-radar">Configurar palavras-chave</H2>
      <P>
        O Radar monitora novos editais publicados no PNCP 24h por dia e dispara alertas toda vez que um
        edital contém uma das suas palavras-chave. Pense nele como um assistente de prospecção que nunca dorme.
      </P>
      <Step n={1} title="Acesse Radar no menu lateral">
        Você verá a lista de palavras-chave já cadastradas e os últimos alertas disparados.
      </Step>
      <Step n={2} title="Clique em 'Adicionar palavra-chave'">
        Digite o termo e selecione a UF (opcional). Você pode cadastrar termos compostos como
        "engenharia elétrica" ou termos simples como "limpeza".
      </Step>
      <Step n={3} title="Defina o filtro de UF (opcional)">
        Se sua empresa atende apenas determinados estados, filtre por UF para reduzir o ruído.
      </Step>
      <Step n={4} title="Salve e aguarde">
        O Radar começa a monitorar imediatamente. Na próxima execução (verificação a cada 2 horas),
        os novos editais encontrados dispararão alertas.
      </Step>
      <Callout type="tip">
        Combine termos específicos do seu nicho com termos mais amplos. Ex.: para uma empresa de TI,
        cadastre "desenvolvimento de software", "sistema de informação" e "infraestrutura de TI".
      </Callout>

      <H2 id="alertas-email">Alertas por e-mail</H2>
      <P>
        Cada vez que o Radar encontra um edital com uma das suas palavras-chave, um e-mail é enviado
        automaticamente com o título, órgão, UF, valor estimado e link direto para análise.
      </P>
      <P>Os e-mails de alerta são enviados para o endereço cadastrado na conta. Para alterar, acesse
        <strong> Perfil → Dados pessoais</strong>.
      </P>
      <Callout type="info">
        Se você receber muitos alertas irrelevantes, refine os termos do Radar adicionando palavras
        mais específicas ou combinando com o filtro de UF.
      </Callout>

      <H2 id="push-notifications">Notificações push</H2>
      <P>
        As notificações push aparecem no seu sistema operacional (Windows, macOS, Android, iOS) mesmo
        com o navegador em segundo plano. São ideais para alertas urgentes de editais com prazo curto.
      </P>
      <Step n={1} title="Acesse Perfil → Privacidade & Notificações">
        Clique no botão <strong>Ativar notificações</strong>.
      </Step>
      <Step n={2} title="Permita no navegador">
        Uma janela do navegador pedirá permissão. Clique em <strong>Permitir</strong>.
      </Step>
      <Step n={3} title="Pronto">
        A partir de agora, novos editais do Radar e alertas de contrato vencendo chegarão como notificações
        do sistema, com link direto para a plataforma.
      </Step>
      <Callout type="warning">
        As notificações push dependem do navegador e do sistema operacional. No iOS, é necessário
        adicionar a Bawzi à tela inicial (PWA) para que as notificações funcionem.
      </Callout>
    </>
  );
}

function SectionContratos() {
  return (
    <>
      <H2 id="monitorar-contratos">Monitorar contratos</H2>
      <P>
        A Bawzi monitora os contratos publicados no PNCP vinculados ao CNPJ da sua empresa (como
        contratada) e aos órgãos que você escolher acompanhar.
      </P>
      <P>
        Na seção <strong>Gestão → Contratos</strong> você encontra todos os contratos ativos, com
        data de início, data de término, valor e situação atual.
      </P>
      <H3>Informações disponíveis por contrato</H3>
      <UL>
        <LI>Número do contrato e número do processo</LI>
        <LI>Órgão contratante e objeto resumido</LI>
        <LI>Valor inicial e aditivos (quando publicados)</LI>
        <LI>Prazo de vigência e dias restantes</LI>
        <LI>Status: <Tag>Ativo</Tag>, <Tag>A vencer</Tag>, <Tag>Encerrado</Tag></LI>
      </UL>

      <H2 id="alertas-vencimento">Alertas de vencimento</H2>
      <P>
        O sistema envia alertas automáticos quando um contrato monitorado está prestes a vencer.
        Os alertas são disparados em três momentos:
      </P>
      <UL>
        <LI><strong>90 dias antes</strong> — aviso antecipado para iniciar negociação de renovação</LI>
        <LI><strong>30 dias antes</strong> — alerta de atenção com lembrete de ação</LI>
        <LI><strong>7 dias antes</strong> — alerta urgente, com notificação push e e-mail</LI>
      </UL>
      <Callout type="tip">
        Use os alertas de 90 dias para preparar a proposta de renovação com antecedência e evitar
        a correria de última hora.
      </Callout>
    </>
  );
}

function SectionConcorrentes() {
  return (
    <>
      <H2 id="monitorar-concorrentes">Monitorar concorrentes</H2>
      <P>
        Com o monitoramento de concorrentes, você acompanha as participações de empresas concorrentes
        em licitações públicas — lances, habilitações, vitórias e padrões de preço.
      </P>
      <Step n={1} title="Acesse Gestão → Concorrentes">
        Clique em <strong>Adicionar concorrente</strong> e informe o CNPJ da empresa que deseja monitorar.
      </Step>
      <Step n={2} title="A Bawzi busca o histórico no PNCP">
        São carregados automaticamente os contratos celebrados, pregões vencidos e padrão de deságio.
      </Step>
      <Step n={3} title="Acompanhe novas participações">
        Sempre que o concorrente participar de um edital que você também está analisando, uma
        notificação será gerada.
      </Step>
      <Callout type="info">
        O monitoramento de concorrentes é um recurso disponível nos planos <PlanBadge plan="Pro" /> e
        {' '}<PlanBadge plan="Elite" />.
      </Callout>

      <H2 id="historico-lances">Histórico de lances</H2>
      <P>
        Para cada pregão eletrônico no PNCP, a Bawzi extrai o histórico de lances público e exibe
        a evolução dos preços durante a disputa, o deságio médio e o percentual do menor lance em
        relação ao valor de referência.
      </P>
      <P>
        Esses dados alimentam a estimativa de pressão de preço no relatório GO/NO-GO, tornando
        a recomendação mais precisa para o seu mercado.
      </P>
    </>
  );
}

function SectionEquipe() {
  return (
    <>
      <H2 id="workspace">Workspace</H2>
      <P>
        Cada conta na Bawzi pertence a um <strong>Workspace</strong> — o espaço compartilhado da
        sua empresa. Todos os membros do Workspace compartilham o mesmo plano, radar, histórico
        de análises e lista de contratos.
      </P>
      <Callout type="info">
        O Workspace é criado automaticamente quando você cria a primeira conta. Membros adicionais
        entram por convite.
      </Callout>

      <H2 id="convidar-membros">Convidar membros</H2>
      <Step n={1} title="Acesse Perfil → Equipe">
        Você verá a lista de membros ativos e o botão <strong>Convidar membro</strong>.
      </Step>
      <Step n={2} title="Informe o e-mail do novo membro">
        O convidado receberá um link por e-mail para criar a conta e se juntar ao Workspace.
      </Step>
      <Step n={3} title="O novo membro aceita o convite">
        Ao criar a conta pelo link, ele é associado automaticamente ao Workspace da sua empresa.
      </Step>
      <Callout type="warning">
        Cada plano tem um limite de membros. Veja os limites em <strong>Planos & Assinatura</strong>.
        Ultrapassar o limite exige upgrade antes de convidar novos membros.
      </Callout>

      <H2 id="funcoes">Funções e permissões</H2>
      <P>Os membros do Workspace podem ter dois papéis:</P>
      <UL>
        <LI><strong>Administrador</strong> — pode gerenciar membros, configurar o Radar, acessar a assinatura e ver todos os dados</LI>
        <LI><strong>Membro</strong> — pode buscar, analisar editais, ver contratos e configurar o próprio perfil</LI>
      </UL>
      <P>
        Para alterar o papel de um membro, acesse <strong>Perfil → Equipe</strong>, clique nos três
        pontos ao lado do nome e selecione <strong>Alterar função</strong>.
      </P>

      <H2 id="empresas-monitoradas">Empresas monitoradas</H2>
      <P>
        Além dos membros, cada plano define quantas <strong>empresas</strong> podem ser monitoradas
        ativamente — ou seja, receber alertas do Radar e aparecer no contexto de análise.
      </P>
      <UL>
        <LI><strong>Gratuito</strong> — sem monitoramento de empresa</LI>
        <LI><strong>Essencial</strong> — 1 empresa</LI>
        <LI><strong>Pro</strong> — até 2 empresas</LI>
        <LI><strong>Elite</strong> — até 3 empresas</LI>
      </UL>
      <P>
        Gerencie as empresas monitoradas em <strong>Perfil → Área de trabalho → Empresas</strong>.
        Você pode adicionar, remover ou definir qual empresa está ativa para análise.
      </P>

      <H2 id="downgrade-empresas">O que acontece ao reduzir o plano</H2>
      <P>
        Se você fizer downgrade e tiver mais empresas cadastradas do que o novo plano permite, as empresas
        excedentes entram em estado <strong>suspenso</strong>: o Radar delas é pausado, mas todos os dados
        são preservados. Você tem <strong>7 dias</strong> para ajustar — removendo empresas ou reativando
        uma dentro do limite.
      </P>
      <Callout type="warning">
        Após os 7 dias sem ajuste, as empresas excedentes são desabilitadas automaticamente. Elas
        continuam salvas, mas ficam bloqueadas para análise até que você reduza a lista ou faça upgrade.
      </Callout>
      <P>
        Para reativar uma empresa dentro do limite: em <strong>Perfil → Área de trabalho → Empresas</strong>,
        localize a empresa suspensa e clique em <strong>Tornar ativa</strong>. O sistema a move
        automaticamente para dentro do limite do plano atual.
      </P>
    </>
  );
}

function SectionConta() {
  return (
    <>
      <H2 id="perfil">Editar perfil</H2>
      <P>
        Para atualizar seu nome, e-mail ou avatar, acesse <strong>Perfil → Dados pessoais</strong>.
        Para dados da empresa (CNPJ, nome fantasia, website), acesse <strong>Perfil → Minha empresa</strong>.
      </P>
      <Callout type="info">
        Alterações de e-mail exigem confirmação via link enviado para o novo endereço, por segurança.
      </Callout>

      <H2 id="2fa">Autenticação em dois fatores (2FA)</H2>
      <P>
        O 2FA adiciona uma segunda camada de proteção à sua conta. Após ativar, além da senha você
        precisará de um código gerado por um aplicativo autenticador (Google Authenticator, Authy etc.).
      </P>
      <Step n={1} title="Acesse Perfil → Segurança → Autenticação em dois fatores">
        Clique em <strong>Ativar 2FA</strong>.
      </Step>
      <Step n={2} title="Escaneie o QR code">
        Abra o aplicativo autenticador no celular, toque em "+" e escaneie o QR code exibido na tela.
      </Step>
      <Step n={3} title="Confirme com o código">
        Digite o código de 6 dígitos gerado pelo app para confirmar a ativação.
      </Step>
      <Step n={4} title="Guarde os códigos de backup">
        A Bawzi exibe 8 códigos de uso único. Salve-os num lugar seguro — eles permitem acesso à
        conta caso você perca o celular.
      </Step>
      <Callout type="warning">
        Se você perder acesso ao app autenticador e não tiver os códigos de backup, precisará
        contatar o suporte para recuperar a conta via verificação de identidade.
      </Callout>

      <H2 id="sessao">Sessão e dispositivos</H2>
      <P>
        A Bawzi usa uma arquitetura de tokens seguros: o token de acesso fica apenas na memória do
        navegador (não no localStorage), protegendo contra ataques XSS. O token de renovação fica
        num cookie HttpOnly, invisível para scripts.
      </P>
      <P>A sessão se renova automaticamente enquanto a aba estiver aberta. Após 30 dias sem atividade,
        o login é necessário novamente.
      </P>
      <Callout type="tip">
        Para encerrar a sessão em todos os dispositivos de uma vez, acesse <strong>Perfil → Segurança</strong>
        e clique em <strong>Encerrar todas as sessões</strong>.
      </Callout>
    </>
  );
}

function SectionPlanos() {
  const plans = [
    {
      name: 'Gratuito',
      badge: <PlanBadge plan="Gratuito" />,
      features: ['5 análises / mês', 'Busca básica no PNCP', '1 membro', 'Sem empresa monitorada'],
    },
    {
      name: 'Essencial',
      badge: <PlanBadge plan="Essencial" />,
      features: ['Análises ilimitadas', 'Radar de alertas', '2 membros', '1 empresa monitorada', 'Alertas por e-mail e push'],
    },
    {
      name: 'Pro',
      badge: <PlanBadge plan="Pro" />,
      features: ['Análises ilimitadas', '5 membros', '2 empresas monitoradas', 'Monitoramento de concorrentes', 'Modelos IA avançados (Claude Sonnet)', 'Relatórios exportáveis'],
    },
    {
      name: 'Elite',
      badge: <PlanBadge plan="Elite" />,
      features: ['Tudo do Pro', '10 membros', '3 empresas monitoradas', 'Modelos IA premium (o3-mini + Claude Opus)', 'API Enterprise', 'Suporte prioritário'],
    },
  ];

  return (
    <>
      <H2 id="comparar-planos">Comparar planos</H2>
      <P>
        A Bawzi oferece 4 planos para atender desde autônomos e pequenas empresas até grandes
        operações comerciais com equipes dedicadas a licitações.
      </P>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
        {plans.map((p) => (
          <div key={p.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">{p.badge}<span className="font-semibold text-slate-800">{p.name}</span></div>
            <ul className="space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-sm text-slate-600">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Callout type="tip">
        Acesse <strong>Perfil → Assinatura</strong> para ver a tabela de preços atualizada e fazer
        upgrade com um clique.
      </Callout>

      <H2 id="upgrade">Fazer upgrade</H2>
      <Step n={1} title="Acesse Perfil → Assinatura">
        Você verá o plano atual, os limites de uso e os planos disponíveis para upgrade.
      </Step>
      <Step n={2} title="Escolha o novo plano e clique em 'Fazer upgrade'">
        Você será redirecionado para o checkout seguro (Stripe). O pagamento é processado com cartão
        de crédito ou boleto.
      </Step>
      <Step n={3} title="O upgrade é imediato">
        Assim que o pagamento é confirmado, os limites do novo plano são liberados instantaneamente.
      </Step>

      <H2 id="cancelamento">Cancelamento</H2>
      <P>
        Você pode cancelar a assinatura a qualquer momento em <strong>Perfil → Assinatura → Cancelar plano</strong>.
        O acesso às funcionalidades pagas continua até o fim do período já pago (sem reembolso proporcional).
        Após o vencimento, a conta volta automaticamente para o plano Gratuito.
      </P>
      <Callout type="info">
        Ao cancelar, seus dados (histórico de análises, contratos, configurações) são preservados por
        90 dias. Reativando a assinatura nesse período, tudo é restaurado.
      </Callout>
    </>
  );
}

function SectionPrivacidade() {
  return (
    <>
      <H2 id="lgpd-consentimento">Consentimento LGPD</H2>
      <P>
        Na primeira visita ao site, a Bawzi exibe o banner de consentimento de privacidade conforme
        a <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong>. Ao clicar em
        <strong> Entendi</strong>, você registra seu consentimento — que é gravado com data, horário
        e versão do termo no banco de dados.
      </P>
      <P>
        Seguindo o Art. 8º §2º da LGPD, a Bawzi mantém registro de auditoria do consentimento,
        de modo que o ônus da prova recai sobre o controlador (nós), e não sobre o titular (você).
      </P>

      <H2 id="seus-dados">Seus dados na Bawzi</H2>
      <P>A Bawzi coleta e armazena apenas os dados estritamente necessários para operar a plataforma:</P>
      <UL>
        <LI><strong>Nome e e-mail</strong> — identificação e comunicação</LI>
        <LI><strong>CNPJ</strong> — Match CNAE e personalização dos alertas</LI>
        <LI><strong>Histórico de análises</strong> — exibição no painel e geração de relatórios</LI>
        <LI><strong>Palavras-chave do Radar</strong> — configuração dos alertas automáticos</LI>
        <LI><strong>Endereço IP no momento do consentimento</strong> — exigência legal (LGPD Art. 8º)</LI>
      </UL>
      <P>
        A Bawzi <strong>não vende</strong> dados a terceiros nem usa os dados para treinar modelos de IA
        externos. Os dados de análise são usados exclusivamente para gerar os relatórios do próprio usuário.
      </P>
      <Callout type="info">
        Para solicitar uma cópia dos seus dados ou pedir a exclusão total da conta, acesse
        <strong> Perfil → Zona de risco → Excluir conta</strong> ou envie uma solicitação para
        development@bawzi.com.
      </Callout>

      <H2 id="revogar">Revogar consentimento</H2>
      <P>
        Você pode revogar o consentimento LGPD a qualquer momento em
        <strong> Perfil → Privacidade & Notificações → Consentimento LGPD → Revogar consentimento</strong>.
      </P>
      <P>
        Ao revogar, o banner de privacidade reaparecerá na próxima visita. A revogação é registrada
        no banco de dados com timestamp, conforme o Art. 8º §5º da LGPD (direito de retirada do
        consentimento a qualquer momento).
      </P>
      <Callout type="warning">
        A revogação do consentimento não exclui seus dados automaticamente — ela apenas registra que
        você não deseja mais que seus dados sejam usados para finalidades que dependem de consentimento.
        Para excluir os dados definitivamente, use a opção de exclusão de conta.
      </Callout>
    </>
  );
}

const SECTION_CONTENT: Record<string, React.ReactNode> = {
  inicio:      <SectionInicio />,
  busca:       <SectionBusca />,
  analise:     <SectionAnalise />,
  radar:       <SectionRadar />,
  contratos:   <SectionContratos />,
  concorrentes: <SectionConcorrentes />,
  equipe:      <SectionEquipe />,
  conta:       <SectionConta />,
  planos:      <SectionPlanos />,
  privacidade: <SectionPrivacidade />,
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('inicio');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Filtra seções pela busca
  const filteredNav = searchQuery
    ? NAV.filter((s) =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.articles.some((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : NAV;

  const currentSection = NAV.find((s) => s.id === activeSection) ?? NAV[0];
  const currentIndex = NAV.indexOf(currentSection);
  const prevSection = currentIndex > 0 ? NAV[currentIndex - 1] : null;
  const nextSection = currentIndex < NAV.length - 1 ? NAV[currentIndex + 1] : null;

  const navigate = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#059669,#047857)' }} className="px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-emerald-200 text-sm mb-3">
            <Link href="/" className="hover:text-white transition-colors">Bawzi</Link>
            <ChevronRight size={14} />
            <span>Documentação</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Central de Ajuda</h1>
              <p className="text-emerald-100 text-sm">Aprenda a usar todos os recursos da Bawzi</p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar na documentação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Layout ───────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-8 flex gap-8 relative">

        {/* Botão mobile sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-xl bg-white border border-slate-200 shadow-lg px-3 py-2 text-sm font-medium text-slate-700"
        >
          <Menu size={16} /> Menu
        </button>

        {/* ── Sidebar overlay mobile ────────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <aside
              className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Documentação</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-500 hover:text-slate-800">
                  <X size={18} />
                </button>
              </div>
              <nav className="p-3 space-y-0.5">
                {filteredNav.map((s) => {
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* ── Sidebar desktop ───────────────────────────────────── */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-6 self-start">
          <nav className="space-y-0.5">
            {filteredNav.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                  {s.label}
                  {isActive && <ChevronRight size={13} className="ml-auto text-emerald-400" />}
                </button>
              );
            })}
          </nav>

          {/* Link suporte */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-1">Precisa de ajuda?</p>
            <p className="text-xs text-slate-500 mb-3">Nossa equipe responde em até 24h.</p>
            <a
              href="mailto:development@bawzi.com"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Falar com suporte <ExternalLink size={11} />
            </a>
          </div>
        </aside>

        {/* ── Conteúdo ──────────────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 min-w-0">
          {/* Cabeçalho da seção */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
            >
              <currentSection.icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Documentação</p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{currentSection.label}</h1>
            </div>
          </div>

          {/* Índice rápido */}
          {currentSection.articles.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nesta seção</p>
              <ul className="space-y-1">
                {currentSection.articles.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`#${a.id}`}
                      className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <ChevronRight size={13} className="text-emerald-400" />
                      {a.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Corpo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            {SECTION_CONTENT[activeSection]}
          </div>

          {/* Navegação anterior / próximo */}
          <div className="flex gap-3 mt-6">
            {prevSection && (
              <button
                onClick={() => navigate(prevSection.id)}
                className="flex-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-200 hover:bg-emerald-50 transition-all group"
              >
                <div className="text-slate-400 group-hover:text-emerald-600 transition-colors">
                  <ChevronRight size={18} className="rotate-180" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Anterior</p>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">{prevSection.label}</p>
                </div>
              </button>
            )}
            {nextSection && (
              <button
                onClick={() => navigate(nextSection.id)}
                className="flex-1 flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right hover:border-emerald-200 hover:bg-emerald-50 transition-all group"
              >
                <div>
                  <p className="text-xs text-slate-400">Próximo</p>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">{nextSection.label}</p>
                </div>
                <div className="text-slate-400 group-hover:text-emerald-600 transition-colors">
                  <ChevronRight size={18} />
                </div>
              </button>
            )}
          </div>

          {/* Footer da doc */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Última atualização: Junho 2026</p>
            <a
              href="mailto:development@bawzi.com"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
            >
              Esta página foi útil? <span className="underline ml-1">Fale conosco</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
