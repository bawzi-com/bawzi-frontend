'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
// A régua de créditos é uma chave no Admin. A documentação lê a MESMA fonte
// que o portão de cobrança aplica, para não ensinar uma conta que o extrato
// não confirma. Ver `SectionCreditos`.
import { useTierConfig } from '../../Contexts/TierContext';
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
  Coins,
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
      { id: 'relatorio-ia', title: 'Painel de decisão (7 etapas)' },
      { id: 'match-cnae', title: 'Match CNAE' },
      { id: 'gestao-decisoes', title: 'Gestão vs. Central de Decisões' },
    ],
  },
  // Créditos ficam LOGO DEPOIS de Análise, e não dentro de Planos, de
  // propósito: a dúvida nasce olhando o laudo ("por que esta análise custou
  // 8?"), não olhando a tabela de preços. Era a única parte do produto que
  // cobra dinheiro e não tinha uma linha de documentação.
  {
    id: 'creditos',
    label: 'Créditos e consumo',
    icon: Coins,
    articles: [
      { id: 'como-conta-credito', title: 'Como o crédito é contado' },
      { id: 'rapida-vs-profunda', title: 'Rápida × Auditoria profunda' },
      { id: 'tamanho-do-edital', title: 'Editais grandes e o teto do plano' },
      { id: 'cota-acabou', title: 'O que acontece se a cota acabar' },
    ],
  },
  // ⚠️ OS RÓTULOS DESTA NAVEGAÇÃO PRECISAM SER OS DA TELA. "Radar de Alertas"
  // e "Contratos" não existem no menu lateral do app — os itens reais são
  // "Monitor" (nív. 3) e "Renovações". Quem lia a ajuda procurava um menu com
  // o nome errado, não achava, e concluía que o problema era ele.
  {
    id: 'radar',
    label: 'Alertas de editais',
    icon: Radar,
    articles: [
      { id: 'configurar-radar', title: 'Criar um alerta' },
      { id: 'alertas-email', title: 'O e-mail diário' },
      { id: 'push-notifications', title: 'Notificações push' },
    ],
  },
  {
    id: 'contratos',
    label: 'Renovações',
    icon: FileText,
    articles: [
      { id: 'monitorar-contratos', title: 'Contratos a vencer' },
      { id: 'alertas-vencimento', title: 'Alertas de vencimento' },
    ],
  },
  {
    id: 'concorrentes',
    label: 'Concorrentes',
    icon: BarChart2,
    articles: [
      { id: 'monitorar-concorrentes', title: 'Dossiê de concorrente' },
      { id: 'historico-lances', title: 'De onde vem o deságio' },
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

function PlanBadge({ plan }: { plan: 'Gratuito' | 'Essencial' | 'Profissional' | 'Avançado' }) {
  // ⚠️ Chaves = nomes OFICIAIS dos planos (tier_config.py). As chaves antigas
  // "Pro"/"Elite" nunca casavam com os badges "Profissional"/"Avançado" — que
  // renderizavam sem cor nenhuma, justamente os dois planos pagos de cima.
  const colors: Record<string, string> = {
    Gratuito:     'bg-slate-100 text-slate-600 border-slate-200',
    Essencial:    'bg-sky-50 text-sky-700 border-sky-200',
    Profissional: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Avançado:     'bg-violet-50 text-violet-700 border-violet-200',
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
        {/* ⚠️ "24h por dia" e "histórico de lances em pregões" descreviam
            capacidades que a plataforma não tem: a varredura é diária (07:00
            BRT) e não existe leitura de lances — o deságio é estimado. */}
        <LI>Recebe um alerta diário dos editais novos que combinam com os seus termos</LI>
        <LI>Recebe um score GO / NO-GO com base no perfil da sua empresa</LI>
        <LI>Encontra contratos públicos a vencer e é avisado dos seus antes do prazo</LI>
        <LI>Levanta o dossiê de um concorrente a partir do histórico público dele</LI>
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
      <Step n={3} title="Entre direto — sem confirmação por e-mail">
        Ao criar a conta, você já entra autenticado, sem etapa de link de confirmação. Guarde bem a
        senha; se precisar, use &ldquo;Esqueci minha senha&rdquo; na tela de login.
      </Step>
      <Step n={4} title="Explore o painel">
        Após o login, você cai direto no painel principal com acesso à busca, radar e análises.
      </Step>
      <Callout type="info">
        O plano gratuito dá acesso à busca e a uma cota mensal de créditos gratuitos — o número vigente
        aparece na <strong>página de planos</strong> e no seu medidor de créditos. Para uso intensivo,
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

      <H2 id="salvar-edital">Analisar e acompanhar editais</H2>
      <P>
        Em cada card de resultado, clique em <strong>Extrair e Analisar IA ⚡</strong> para rodar a análise
        completa do edital. Também é possível selecionar vários editais e analisar em lote de uma vez.
      </P>
      <Callout type="tip">
        Enquanto a extração está em andamento, o botão vira <strong>Cancelar extração</strong>. Clique nele
        se quiser interromper — a análise em lote também para no edital em que você cancelar, em vez de
        seguir para os próximos.
      </Callout>
      <P>
        Antes de gastar a análise, a Bawzi compara o objeto do edital com o CNAE e o ramo de atuação
        cadastrados da empresa ativa. Se não encontrar relação entre os dois, aparece uma confirmação —
        <strong> "Este edital parece fora do seu CNAE"</strong> — para você decidir se quer prosseguir mesmo assim.
      </P>
      <P>
        Toda análise concluída fica disponível na <strong>Central de Decisões</strong>, seu histórico completo.
        Se quiser acompanhar um edital específico com checklist e prazos, abra o laudo e clique em
        <strong> "+ Gestão"</strong> — só então ele passa a aparecer no painel Gestão (veja a seção
        "Gestão & Decisões").
      </P>
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

      <H2 id="relatorio-ia">Painel de decisão (7 etapas)</H2>
      <P>
        O resultado da análise é organizado como uma jornada de 7 etapas, pensada para dar uma leitura
        clara do início ao fim — cada etapa tem uma manchete com o que mais importa, e o detalhe completo
        fica um clique abaixo, atrás de "Ver detalhe completo":
      </P>
      <UL>
        <LI><strong>00 · Panorama</strong> — a história inteira em poucas linhas: veredito, score e o status das
          outras 5 etapas, cada uma clicável para ir direto ao detalhe</LI>
        <LI><strong>01 · Veredito</strong> — GO / GO condicionado / NO-GO, aderência ao negócio (CNAE), evidências,
          impedimentos e o plano de próximas ações</LI>
        <LI><strong>02 · Critérios</strong> — como o edital se sai nos critérios que você configurou, em ordem
          de severidade</LI>
        <LI><strong>03 · SWOT & Riscos</strong> — red flags, forças e fraquezas, checklist de habilitação e
          matriz de riscos</LI>
        <LI><strong>04 · Jurídico</strong> — parecer técnico-jurídico e o raciocínio estratégico da IA</LI>
        <LI><strong>05 · Concorrentes</strong> — radar de concorrência e inteligência de preços</LI>
        <LI><strong>06 · Cockpit</strong> — checklist de execução com responsável, prazo e status de cada tarefa</LI>
      </UL>
      <Callout type="tip">
        Os botões <strong>Imprimir</strong> e <strong>Baixar PDF</strong> trazem o conteúdo das 7 etapas
        inteiras, não só a etapa que está aberta na tela no momento.
      </Callout>
      <Callout type="info">
        Os relatórios ficam salvos no histórico enquanto sua conta estiver ativa, em qualquer plano.
        Após um cancelamento, você mantém acesso de leitura por 90 dias.
      </Callout>

      <H2 id="match-cnae">Match CNAE</H2>
      <P>
        O Match CNAE compara os CNAEs da sua empresa (via Receita Federal) com o objeto do edital. O
        resultado aparece na etapa <strong>Veredito → Aderência ao negócio</strong>, com o score de
        compatibilidade e a justificativa.
      </P>
      <P>
        A checagem considera tanto o <strong>CNAE principal</strong> quanto os <strong>CNAEs secundários</strong>
        cadastrados na empresa — se o objeto do edital bater com qualquer um deles, isso aparece
        destacado no relatório, com a indicação de qual CNAE gerou o match.
      </P>
      <P>
        Para configurar ou atualizar os CNAEs reconhecidos, acesse <strong>Perfil → Minha empresa</strong> e
        informe o CNPJ. A Bawzi consulta a Receita automaticamente.
      </P>
      <Callout type="warning">
        Se o CNPJ estiver desatualizado na Receita Federal, o Match CNAE pode ficar impreciso. Verifique
        seus CNAEs no site da Receita antes de confiar 100% neste indicador.
      </Callout>
      <Callout type="info">
        Antes mesmo de rodar a análise, a busca de editais já compara o objeto com o CNAE/ramo de atuação
        cadastrado e avisa se não encontrar relação — veja "Analisar e acompanhar editais" na seção Busca
        de Editais.
      </Callout>

      <H2 id="gestao-decisoes">Gestão vs. Central de Decisões</H2>
      <P>
        Depois de analisado, todo edital fica em dois lugares diferentes, com propósitos diferentes:
      </P>
      <UL>
        <LI><strong>Central de Decisões</strong> — o histórico completo, com todas as análises que você já rodou,
          sem exceção. É o lugar para reabrir um laudo antigo ou reprocessar uma decisão.</LI>
        <LI><strong>Gestão</strong> — um quadro (kanban) só com os editais que você adicionou de propósito,
          clicando em <strong>"+ Gestão"</strong> dentro do laudo. É onde você acompanha checklist, prazos e
          etapas (triagem → proposta → envio → resultado) só dos editais que realmente estão em jogo.</LI>
      </UL>
      <Callout type="tip">
        Gestão é opt-in: analisar um edital não o coloca automaticamente lá. Se um edital que você esperava
        ver na Gestão não aparece, abra o laudo dele na Central de Decisões e confira se o botão
        "+ Gestão" está ativado.
      </Callout>
      {/* Comportamento novo: a edição do plano saiu do laudo. Sem este
          parágrafo, quem já usava o produto procura os campos onde eles não
          estão mais e conclui que sumiram. */}
      <H3>Onde se preenche o plano de execução</H3>
      <P>
        O laudo <strong>mostra</strong> o plano — os passos, o responsável sugerido, o prazo e o
        progresso. Quem <strong>executa</strong> é a Gestão: responsável, prazo, nota interna e a
        marcação de concluído se preenchem lá, abrindo o edital no quadro.
      </P>
      <P>
        A divisão existe porque as duas telas respondem perguntas diferentes. No laudo, o plano
        está ancorado na cláusula que o gerou — é onde a ação faz sentido. Na Gestão, você vê
        todos os editais lado a lado, com prazos comparáveis: é onde dá para saber o que vence
        primeiro entre disputas diferentes, coisa que nenhum laudo isolado mostra.
      </P>
      <P>
        Para remover um edital da Gestão, abra o laudo e clique em <strong>"Remover do acompanhamento"</strong>.
        Ele some do quadro, mas continua disponível normalmente na Central de Decisões.
      </P>
    </>
  );
}

/* Como o crédito é contado — e o texto TROCA quando a régua troca.
 *
 * ⚠️ ANTES ISTO ERA PROSA FIXA, com "50.000" digitado no meio da frase.
 * A régua é uma chave no Admin (`regua_por_custo`): virá-la mudava a
 * cobrança e deixava esta página ensinando a conta antiga. Para um
 * comprador B2B isso não é um detalhe de cópia — é o extrato deixando de
 * ser reproduzível, que é exatamente o motivo de a régua ser fixa no
 * lançamento.
 *
 * `useTierConfig().regua` vem de `/api/tiers/config`, a MESMA fonte que o
 * portão consulta. Com a API fora cai no fallback da régua fixa, que é o
 * padrão do produto — errar para o lado do texto antigo mostra um número
 * velho; errar para o outro anuncia uma fórmula que ninguém está usando. */
function SectionCreditos() {
  const { regua } = useTierConfig();
  const porCusto = regua.tipo === 'custo';
  const unidade = (regua.caracteres_por_credito ?? 50000).toLocaleString('pt-BR');
  const peso = regua.peso_profunda ?? 4;

  return (
    <>
      <H2 id="como-conta-credito">Como o crédito é contado</H2>
      {porCusto ? (
        <>
          <P>
            Toda análise consome créditos da sua cota mensal. Um crédito mede o{' '}
            <strong>custo de processar a análise</strong> — não o tamanho do edital.
          </P>
          <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">
              O preço é estimado antes de enviar e aparece no botão
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Ele soma três coisas: um custo fixo por análise, um custo por caractere
              lido e, na auditoria profunda, um custo por bloco relido. Arredondando
              para cima, com mínimo de 1 crédito.
            </p>
          </div>
          <Callout type="info">
            <strong>Por que não é uma conta por caractere.</strong> Boa parte do custo de
            uma análise não depende do tamanho do edital: ela existe do mesmo jeito num
            documento de 5 mil caracteres e num de 500 mil. Cobrar só por tamanho fazia
            edital pequeno pagar caro por caractere e edital grande pagar barato demais.
            Medindo custo, o preço por caractere <em>cai</em> conforme o edital cresce —
            como o custo real sempre caiu.
          </Callout>
        </>
      ) : (
        <>
          <P>
            Toda análise consome créditos da sua cota mensal. A regra é uma só, e você
            consegue fazer a conta antes de enviar:
          </P>
          <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">
              1 crédito a cada {unidade} caracteres analisados
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Arredondando para cima, com mínimo de 1 crédito por análise.
            </p>
          </div>
        </>
      )}
      <Callout type="warning">
        <strong>&quot;Analisados&quot; inclui os PDFs, não só o que você digitou.</strong> O contador
        da caixa de texto mostra apenas o texto colado — mas a cobrança soma o texto,
        os PDFs que você anexou e os arquivos que baixamos do PNCP por você. É por isso
        que um edital do Radar quase sempre custa mais do que parece pelo campo de texto:
        o edital em si costuma ser pequeno perto dos anexos.
      </Callout>
      <P>
        O preço exato aparece no botão antes de você enviar, e é sempre esse valor que é
        debitado — a tela e a cobrança usam a mesma regra.
      </P>

      <H2 id="rapida-vs-profunda">Rápida × Auditoria profunda</H2>
      <P>
        Os dois modos leem o mesmo edital e entregam as mesmas seções do laudo. O que muda
        é a profundidade — e o preço.
      </P>
      <UL>
        <LI><strong>Análise rápida</strong> — uma leitura do edital.{' '}
          {porCusto
            ? 'É o modo mais barato, e a diferença cresce com o tamanho do edital.'
            : 'Custa o valor da régua acima.'}</LI>
        <LI><strong>Auditoria profunda</strong> — relê o documento inteiro em blocos, confere cada
          afirmação contra o texto original e procura contradições que a leitura única não
          enxerga.{' '}
          {porCusto
            ? 'Custa mais porque faz mais chamadas e usa os modelos mais capazes do seu plano — quanto mais, aparece no botão antes de você confirmar.'
            : `Multiplica o custo pelo fator do seu plano (hoje ${peso}×).`}</LI>
      </UL>
      <Callout type="tip">
        <strong>Aprofundar um laudo que você já rodou paga só a diferença.</strong>{' '}
        {porCusto
          ? 'Se a rápida custou 2 créditos e a auditoria completa custa 14, você paga 12. A conta aparece inteira antes de confirmar: valor cheio, o que já foi pago e o que você paga.'
          : `Se a rápida custou 8 créditos e o fator é ${peso}×, a auditoria completa custa ${8 * peso} — e como 8 já foram pagos, você paga ${8 * peso - 8}. A conta aparece inteira antes de confirmar: valor cheio, o que já foi pago e o que você paga.`}
      </Callout>
      <P>
        O <strong>parecer técnico-jurídico</strong> não depende do modo: ele é liberado a partir do
        Nível 3 (Profissional) e sai nos dois. O que a auditoria profunda muda é o embasamento —
        o parecer passa a ser escrito sobre fatos já conferidos contra o documento.
      </P>

      <H2 id="tamanho-do-edital">Editais grandes e o teto do plano</H2>
      <P>
        Além da cota mensal, cada plano tem um teto de tamanho por análise. É um limite
        diferente da cota: mesmo com créditos sobrando, um edital acima do teto do seu plano
        não é lido por inteiro.
      </P>
      <P>
        Quando isso acontece, a Bawzi <strong>preserva o início e o final do documento</strong> e
        omite o miolo — que normalmente é a relação de itens e quantitativos. O final é
        preservado de propósito: é lá que ficam termo de referência, sanções, minuta de
        contrato e matriz de risco.
      </P>
      <Callout type="info">
        O laudo sempre avisa quando foi feito sobre um recorte, e a IA é instruída a nunca
        afirmar que algo &quot;não existe&quot; por não estar no trecho recebido — a ausência é do
        recorte, não do edital. Se o aviso aparecer com frequência nos seus editais, o
        simulador da página de Planos mostra qual plano comporta o tamanho que você analisa.
      </Callout>

      <H2 id="cota-acabou">O que acontece se a cota acabar</H2>
      <P>
        As análises não param de uma hora para a outra. A sequência é esta:
      </P>
      <UL>
        <LI><strong>1. Margem de cortesia</strong> — passando da cota, você continua analisando
          normalmente por uma faixa que é por nossa conta. Esses créditos não são debitados
          agora nem descontados da próxima recarga.</LI>
        <LI><strong>2. Motor simplificado</strong> — esgotada a cortesia, as análises continuam
          saindo, mas num motor mais simples e <strong>sem auditoria profunda</strong>, até a
          renovação da cota.</LI>
        <LI><strong>3. Renovação</strong> — no reset mensal a cota do plano volta cheia.</LI>
      </UL>
      <Callout type="tip">
        Para não chegar no motor simplificado, dá para comprar um <strong>pacote avulso</strong> a
        qualquer momento. Créditos de pacote <strong>não expiram no reset</strong> — eles ficam
        acumulados por cima da cota mensal.
      </Callout>
      <P>
        A barra de créditos no topo da tela de análise mostra sempre os quatro números: cota do
        plano, adicionais comprados, disponível e quanto já foi usado no período.
      </P>
    </>
  );
}

function SectionRadar() {
  return (
    <>
      {/* ⚠️ ESTA SEÇÃO INTEIRA DESCREVIA OUTRO PRODUTO. Ela mandava "acesse
          Radar no menu lateral" (o item real é Monitor, e "Radar PNCP" é OUTRA
          tela — a de busca —, então o leitor ia parar no lugar errado), falava
          em "Adicionar palavra-chave" (o botão diz "Novo Alerta"), prometia
          "24h por dia" e "verificação a cada 2 horas" (o job roda UMA vez, às
          07:00 BRT — `scheduler.py:1003`), e não dizia que o recurso exige
          nível 3 (`AppSidebar.tsx:304`). */}
      <H2 id="configurar-radar">Criar um alerta</H2>
      <P>
        Os <strong>Alertas</strong> vasculham os editais publicados no PNCP e avisam quando
        aparece um que combina com um termo seu. É prospecção que roda sem você abrir a
        plataforma.
      </P>
      <Callout type="info">
        Os Alertas estão disponíveis a partir do plano <PlanBadge plan="Profissional" />. Nos
        planos abaixo o item aparece no menu com o cadeado de nível.
      </Callout>
      <Step n={1} title="Acesse Alertas no menu lateral">
        É o item com o sino, descrito como "Avisos sobre o que você segue". Não confunda com
        <strong> Analisar</strong>, que é a tela de busca manual — os Alertas são o que trabalha
        sozinho.
      </Step>
      <Step n={2} title="Clique em 'Novo Alerta'">
        Abre o formulário "Configurar novo alerta". Digite o termo — pode ser composto, como
        "engenharia elétrica", ou simples, como "limpeza".
      </Step>
      <Step n={3} title="Defina o filtro de UF (opcional)">
        Se sua empresa atende apenas determinados estados, filtre por UF para reduzir o ruído.
      </Step>
      <Step n={4} title="Salve e aguarde a próxima varredura">
        A verificação roda uma vez por dia, às <strong>07:00</strong> (horário de Brasília). Um
        alerta criado às 10h só produz resultado na manhã seguinte — ele não varre o passado.
      </Step>
      <Callout type="tip">
        Combine termos específicos do seu nicho com termos mais amplos. Ex.: para uma empresa de TI,
        cadastre "desenvolvimento de software", "sistema de informação" e "infraestrutura de TI".
      </Callout>

      {/* ⚠️ Dizia "cada vez que encontra, um e-mail é enviado", com "valor
          estimado e link direto para análise". É um DIGEST diário; o valor
          estimado não vai no e-mail; e o botão é um só, agregado, para a busca
          — não há link por edital (`scheduler.py:731-753`). */}
      <H2 id="alertas-email">O e-mail diário</H2>
      <P>
        Quando a varredura das 07:00 encontra editais novos para os seus termos, você recebe
        <strong> um e-mail</strong> com tudo o que apareceu — não é um e-mail por edital. Cada
        linha traz o <strong>órgão</strong>, a <strong>UF</strong> e o início do objeto; o botão
        no fim abre a busca já filtrada pelo termo, para você escolher qual analisar.
      </P>
      <Callout type="info">
        O valor estimado não vem no e-mail: ele só aparece depois, no card do edital dentro da
        plataforma.
      </Callout>
      <P>Os e-mails vão para o endereço cadastrado na conta. Para alterar, acesse
        <strong> Perfil → Dados pessoais</strong>.
      </P>
      <Callout type="info">
        Se você receber muitos alertas irrelevantes, refine os termos adicionando palavras
        mais específicas ou combinando com o filtro de UF.
      </Callout>

      <H2 id="push-notifications">Notificações push</H2>
      <P>
        As notificações push aparecem no seu sistema operacional (Windows, macOS, Android, iOS) mesmo
        com o navegador em segundo plano. Elas acompanham os mesmos três avisos que já chegam por
        e-mail: editais novos dos Alertas, contratos a vencer e alteração de edital em acompanhamento.
      </P>
      <Step n={1} title="Acesse Perfil → Privacidade & Notificações">
        Clique no botão <strong>Ativar notificações</strong>.
      </Step>
      <Step n={2} title="Permita no navegador">
        Uma janela do navegador pedirá permissão. Clique em <strong>Permitir</strong>.
      </Step>
      <Step n={3} title="Pronto">
        Os avisos passam a chegar como notificação do sistema, com link direto para a tela
        correspondente na plataforma.
      </Step>
      <Callout type="warning">
        As notificações push dependem do navegador e do sistema operacional. No iOS, é necessário
        adicionar a Bawzi à tela inicial para que elas funcionem.
      </Callout>
    </>
  );
}

function SectionContratos() {
  return (
    <>
      {/* ⚠️ ESTA SEÇÃO DESCREVIA UM REGISTRO DE CONTRATOS QUE A BAWZI NÃO TEM.
          Mandava para "Gestão → Contratos" (caminho inexistente; a tela é
          "Renovações", item de primeiro nível no menu), prometia "todos os
          contratos ativos" numa tela que EXIGE um termo de busca, e listava
          campos que ela não mostra: número do contrato, número do processo e
          os status "Ativo / A vencer / Encerrado". */}
      <H2 id="monitorar-contratos">Contratos a vencer</H2>
      <P>
        A tela <strong>Renovações</strong>, no menu lateral, encontra contratos publicados no PNCP
        cujo prazo de vigência está terminando. A ideia é prospecção: um contrato que vence é uma
        licitação que vem aí.
      </P>
      <Callout type="info">
        Não é um registro dos SEUS contratos. É uma busca sobre a base pública do PNCP — por isso
        ela pede um termo (o seu segmento, ou o CNPJ de um fornecedor) e uma janela de dias.
      </Callout>
      <Step n={1} title="Cadastre a empresa no Perfil">
        Sem CNPJ cadastrado, o item do menu leva ao Perfil em vez de abrir a tela.
      </Step>
      <Step n={2} title="Busque pelo seu segmento">
        Digite o termo e escolha a janela de vencimento — de 30 a 730 dias. O padrão é 30.
      </Step>
      <H3>Informações disponíveis por contrato</H3>
      <UL>
        <LI>Órgão contratante, UF e município</LI>
        <LI>Objeto e valor do contrato</LI>
        <LI>Data de término e dias restantes</LI>
        <LI>Fornecedor atual e o CNPJ dele</LI>
        <LI>Marca <Tag>Já aditivado</Tag> quando o valor global superou o inicial</LI>
        <LI>Urgência: de <Tag>VENCIDO</Tag> e <Tag>CRÍTICO</Tag> até <Tag>PIPELINE</Tag></LI>
      </UL>

      {/* ⚠️ "90 / 30 / 7 dias antes" era invenção completa: o job usa UMA
          janela, `dias=30`, e roda às 08:00 BRT (`scheduler.py:552,595`). */}
      <H2 id="alertas-vencimento">Alertas de vencimento</H2>
      <P>
        Além da busca manual, a Bawzi verifica sozinha, todo dia às <strong>08:00</strong> (horário
        de Brasília), os contratos do CNPJ cadastrado que vencem nos <strong>próximos 30 dias</strong>.
        Havendo algum, você recebe e-mail, aviso no sino e notificação push.
      </P>
      <Callout type="info">
        O alerta automático é enviado a partir do plano <PlanBadge plan="Profissional" /> e exige
        empresa cadastrada no Perfil. A busca manual em Renovações não tem essa exigência de nível.
      </Callout>
      <Callout type="tip">
        Para preparar renovação com antecedência maior, use a busca manual e aumente a janela de
        dias — o alerta automático olha só os 30 dias seguintes.
      </Callout>
    </>
  );
}

function SectionConcorrentes() {
  return (
    <>
      {/* ⚠️ ESTA SEÇÃO PROMETIA UM PRODUTO DE MONITORAMENTO CONTÍNUO QUE NÃO
          EXISTE: não há tela "Gestão → Concorrentes", não há lista de
          concorrentes cadastrados por CNPJ, e nada notifica quando um
          concorrente entra num edital seu. O que existe é um dossiê sob
          demanda, dentro do laudo. Prometer vigilância e entregar consulta é a
          diferença entre o cliente confiar e o cliente ser pego de surpresa. */}
      <H2 id="monitorar-concorrentes">Dossiê de concorrente</H2>
      <P>
        A Bawzi não mantém uma lista de concorrentes vigiados. O que ela faz é montar, na hora, um
        dossiê de uma empresa específica — e o lugar disso é <strong>dentro do laudo</strong>, na
        etapa <strong>Concorrentes</strong>, onde os prováveis participantes daquele edital já
        estão listados.
      </P>
      <Step n={1} title="Abra um laudo e vá até a etapa Concorrentes">
        A Bawzi já buscou no PNCP quem costuma vencer contratos parecidos com aquele objeto,
        naquela região.
      </Step>
      <Step n={2} title="Peça o dossiê de um deles">
        A Bawzi reúne o histórico público da empresa — contratos vencidos, porte, capital social —
        e produz a leitura ofensiva: onde ela é forte, onde é vulnerável, e o que sustentaria uma
        impugnação ou um recurso.
      </Step>
      <Callout type="info">
        Cada plano tem um teto diário de dossiês (5 no <PlanBadge plan="Gratuito" />, 500 no
        {' '}<PlanBadge plan="Avançado" />). Veja o número do seu na página de Planos.
      </Callout>
      <Callout type="warning">
        Não há alerta de "o concorrente X entrou neste edital". O PNCP publica o resultado, não a
        lista de participantes em tempo real — esse aviso não teria como existir.
      </Callout>

      {/* ⚠️ "extrai o histórico de lances público e exibe a evolução dos preços
          durante a disputa" — nada disso existe no código. Nenhuma rota lê
          lances do PNCP. O deságio é ESTIMADO estatisticamente em
          `pricing.py:1406`, a partir da dispersão de contratos parecidos.
          Chamar estimativa de extração é o tipo de erro que só aparece quando
          o cliente confia nela para fechar preço. */}
      <H2 id="historico-lances">De onde vem o deságio</H2>
      <P>
        O deságio que aparece no laudo é uma <strong>estimativa</strong>, não a leitura de uma
        disputa. A Bawzi não lê lance a lance: o PNCP não expõe a sessão em tempo real.
      </P>
      <P>
        O que ela faz é reunir contratos já homologados com objeto parecido, no mesmo tipo de
        órgão e região, medir o quanto os valores variam entre si e traduzir essa dispersão numa
        faixa de desconto provável — quanto mais disperso o mercado, mais agressiva tende a ser a
        disputa. Daí saem também o perfil do provável vencedor e o nível de ameaça.
      </P>
      <Callout type="warning">
        Trate o número como cenário, não como preço observado. Ele orienta a proposta; quem decide
        o piso é a sua planilha de custo.
      </Callout>
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

      {/* ⚠️ A ORDEM DOS PASSOS ESTAVA INVERTIDA E ISSO FAZIA O FLUXO FALHAR.
          Dizia que o convidado "receberá um link por e-mail para criar a conta"
          — não existe link de convite nem token em lugar nenhum do código. O
          endpoint procura o e-mail entre usuários JÁ CADASTRADOS e devolve 404
          ("Ele precisa criar uma conta grátis primeiro") se não achar
          (`router_workspaces.py:333`). Quem seguia a ajuda tentava convidar
          alguém que ainda não tinha conta e levava um erro que a documentação
          dizia ser impossível. */}
      <H2 id="convidar-membros">Convidar membros</H2>
      <Callout type="warning">
        O convidado precisa <strong>já ter uma conta na Bawzi</strong> antes de você convidá-lo.
        Peça que ele crie a conta gratuita primeiro, com o mesmo e-mail — sem isso o convite
        retorna "usuário não encontrado".
      </Callout>
      <Step n={1} title="Peça ao colega para criar a conta grátis">
        Qualquer e-mail serve, e a conta gratuita basta. Ele não precisa assinar nada: ao entrar
        no Workspace, passa a usar o plano da empresa.
      </Step>
      <Step n={2} title="Acesse Perfil → Equipe">
        Você verá a lista de membros ativos e o botão <strong>Convidar Colaborador</strong>.
      </Step>
      <Step n={3} title="Informe o e-mail que ele usou no cadastro">
        A entrada é imediata — não há convite a aceitar. Ele recebe um e-mail avisando que foi
        adicionado e, no próximo acesso, já está no Workspace da empresa.
      </Step>
      <Callout type="warning">
        Cada plano tem um limite de vagas. Veja o do seu em <strong>Perfil → Assinatura</strong>.
        Atingido o limite, o convite é recusado e é preciso subir de plano antes de adicionar mais
        gente.
      </Callout>

      {/* ⚠️ Eram TRÊS papéis, não dois, e o caminho descrito não existia: não
          há menu de três pontos nem item "Alterar função" no TeamManager — são
          botões inline, e o rótulo é "Promover"/"Despromover". Também faltava
          a regra que mais gera ticket: só o PROPRIETÁRIO promove alguém. */}
      <H2 id="funcoes">Funções e permissões</H2>
      <P>O Workspace tem três papéis:</P>
      <UL>
        <LI><strong>Proprietário</strong> — quem criou o Workspace. É o único que pode promover ou rebaixar administradores, e não pode ser removido</LI>
        <LI><strong>Administrador</strong> — pode adicionar e remover membros e ver todos os dados da equipe</LI>
        <LI><strong>Membro</strong> — pode buscar, analisar editais, ver renovações e configurar o próprio perfil</LI>
      </UL>
      <P>
        Para promover alguém a administrador, acesse <strong>Perfil → Equipe</strong> e use o botão
        <strong> Promover</strong> na linha do membro. O mesmo botão rebaixa quem já é
        administrador. Se ele não aparecer para você, é porque só o proprietário do Workspace tem
        essa permissão.
      </P>

      <H2 id="empresas-monitoradas">Empresas monitoradas</H2>
      <P>
        Além dos membros, cada plano define quantas <strong>empresas</strong> podem ser monitoradas
        ativamente — ou seja, receber alertas do Radar e aparecer no contexto de análise.
      </P>
      <UL>
        <LI><strong>Gratuito</strong> — sem monitoramento de empresa</LI>
        <LI><strong>Essencial</strong> — 1 empresa</LI>
        <LI><strong>Profissional</strong> — até 2 empresas</LI>
        <LI><strong>Avançado</strong> — até 3 empresas</LI>
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
    // ⚠️ SEM números de cota e SEM nome de modelo aqui.
    // "5 análises/mês" e "Análises ilimitadas" divergiam da cota real (os
    // planos são a créditos, servidos pela API na página de planos), e os
    // nomes de modelo ficam velhos a cada troca de geração no backend.
    // Documentação descreve CAPACIDADE; número vigente mora em /plans.
    {
      name: 'Gratuito',
      badge: <PlanBadge plan="Gratuito" />,
      features: ['Créditos gratuitos todo mês (cota vigente em Planos)', 'Busca no PNCP', '1 membro', 'Sem empresa monitorada'],
    },
    {
      name: 'Essencial',
      badge: <PlanBadge plan="Essencial" />,
      features: ['Cota mensal de créditos maior (veja Planos)', 'Agentes de mercado no laudo', 'Radar de alertas', '2 membros', '1 empresa monitorada', 'Alertas por e-mail e push'],
    },
    {
      name: 'Profissional',
      badge: <PlanBadge plan="Profissional" />,
      features: ['Cota mensal de créditos ampla (veja Planos)', '5 membros', '2 empresas monitoradas', 'Monitoramento de concorrentes', 'Parecer jurídico no laudo', 'Relatórios exportáveis'],
    },
    {
      name: 'Avançado',
      badge: <PlanBadge plan="Avançado" />,
      features: ['Tudo do Profissional', 'A maior cota de créditos (veja Planos)', '10 membros', '3 empresas monitoradas', 'Motores de IA premium', 'API Enterprise', 'Suporte prioritário'],
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
      {/* O simulador é o caminho mais curto para a resposta que esta seção
          tenta dar em prosa. Apontar para ele vale mais que uma tabela a mais. */}
      <H3>Não sabe qual plano é o seu?</H3>
      <P>
        A página de <strong>Planos</strong> tem um simulador: você descreve sua rotina — quantos
        editais por mês, quantos em auditoria profunda e o tamanho típico deles — e ele mostra,
        para cada plano, quantos créditos aquilo consumiria e se cabe. Ele avalia <em>dois</em>
        limites diferentes: a cota mensal e o teto de tamanho por edital.
      </P>
      <Callout type="info">
        Um plano pode ter crédito de sobra e ainda assim não servir, se os seus editais forem
        maiores que o teto dele — nesse caso o simulador marca &quot;recorta os maiores&quot; e não
        recomenda. Vale conferir o artigo{' '}
        <strong>Créditos e consumo → Editais grandes e o teto do plano</strong>.
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
  creditos:    <SectionCreditos />,
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
          {/* `flex-wrap` + `gap`: sem eles, os dois textos disputavam a mesma
              linha a 360px e o "Fale conosco" saía cortado pela borda. */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs text-slate-400">Última atualização: Agosto 2026</p>
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
