'use client';

/**
 * AppSidebar.tsx
 * Barra lateral do painel: navegação primária, contexto ativo e conta.
 *
 * Template de todo item: [ícone 36px] [rótulo + descrição] [selo].
 *   · ativo   — fundo sólido no acento da seção, texto branco, ponto branco.
 *   · inativo — NEUTRO. Cinza. Sem cor.
 *   · travado — linha compacta com cadeado, agrupada fora da nav.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ POR QUE O ESTADO INATIVO PERDEU A COR
 * ═══════════════════════════════════════════════════════════════════════════
 * Cada item tinha o seu próprio matiz no ícone E no selo, o tempo todo:
 * verde, azul, índigo, ardósia, violeta, verde-água, âmbar. Sete matizes
 * acesos ao mesmo tempo numa coluna de sete linhas. O problema não é feiura —
 * é que o estado ATIVO também é uma cor, e ele tinha que se distinguir de um
 * fundo que já era colorido inteiro. Com o inativo em cinza, existe uma cor só
 * na barra a cada instante, e ela é exatamente a que diz onde você está.
 *
 * O acento por seção continua vivo no estado ativo — ali ele é orientação, e
 * só um aparece por vez.
 *
 * ⚠️ E POR QUE ISTO VIROU UM COMPONENTE SÓ (`NavRow`)
 * Havia sete blocos de ~25 linhas quase idênticos, copiados um do outro. Foi
 * essa cópia que deixou "NOVO" sair em três cores diferentes e "IA" em duas:
 * ninguém compara sete blocos distantes para conferir se combinam. Um
 * componente com props não tem como divergir de si mesmo.
 */

import React, { useEffect, useState } from 'react';
import {
  Zap, BookOpen, RefreshCw, Lock, DollarSign,
  Scale, GitCompare, TrendingDown, ShieldCheck, Cpu, ScanSearch, Target, Bell,
  ClipboardList, MessageCircle, SlidersHorizontal, ChevronDown, UserCog, FolderOpen,
  PanelLeftClose,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActiveContextSwitcher from './ActiveContextSwitcher';
import NotificationPanel, { type AlvoNotificacao } from './NotificationPanel';
import { getCompanyDisplayName } from '@/lib/activeContext';
import type { UserData } from '@/lib/types';
import { LAUNCH_FLAGS } from '@/lib/launchFlags';

interface AppSidebarProps {
  token: string | null;
  userData: UserData | null;
  currentTier: number;
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  /** ⚠️ CANAL SEPARADO DO `onSetActiveTab`, de propósito.
   *  O sino precisa dizer "abra a Gestão NESTE edital", e `onSetActiveTab` só
   *  carrega o nome da aba. Alargar a assinatura dele contaminaria os doze
   *  cliques de menu que não têm alvo nenhum. Sem esta prop, o sino continua
   *  funcionando pelo caminho antigo — só trocando de aba. */
  onNotificacaoAberta?: (tab: string, alvo?: AlvoNotificacao) => void;
  renovacoesCount: number | null;
  onNotifCountChange: (n: number) => void;
  onShowAuthModal: (mode: 'login' | 'register') => void;
  /** Oculta a coluna lateral. Só o OCULTAR mora aqui — reabrir tem de existir
   *  fora do menu, senão o controle desaparece junto com ele. */
  onOcultarMenu?: () => void;
}

// ─── Componentes internos ──────────────────────────────────────────────────────

/* ═══════════════════════════════════════════════════════════════════════════
 * SELOS — DUAS ESPÉCIES, NÃO SETE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ O QUE HAVIA: nove linhas de menu, nove selos, sete matizes. "NOVO" saía
 * em violeta no Priorizar, âmbar no Monitor e azul no Capital — três cores
 * para a mesma palavra. "IA" saía em verde no Radar e índigo na Parametrização
 * — mesma palavra, duas cores, e nenhuma delas queria dizer nada de diferente.
 *
 * O custo não é estético. Selo em navegação significa UMA de duas coisas:
 * «tem trabalho parado esperando você» (contagem) ou «isto apareceu depois da
 * última vez que você olhou» (novidade). "SALVO", "EXEC.", "CNAE" e "ATIVO"
 * não eram nem uma nem outra — eram etiquetas de categoria, que não pedem nada
 * de ninguém e repetem o que o subtítulo da linha já diz.
 *
 * E quando seis de sete linhas vêm marcadas, marca nenhuma chama: o "600" de
 * Renovações — o único número acionável da barra inteira — disputava atenção
 * com quatro adesivos decorativos.
 *
 * Ficaram duas espécies. Nada mais entra aqui sem ser uma delas.
 */

/** Até quando cada destino tem direito de se anunciar como novo.
 *
 *  ⚠️ SELO DE NOVIDADE PRECISA DE VALIDADE. Sem data, "NOVO" fica para sempre,
 *  e um aviso permanente é um aviso que ninguém mais lê — o Monitor já
 *  carregava o dele desde que nasceu. Estender é editar a data aqui; não
 *  existe caminho que renove sozinho, e é essa a graça.
 */
const NOVIDADE_ATE: Record<string, string> = {
  alertas:  '2026-10-31',  // Monitor
  comparar: '2026-10-31',  // Priorizar
  capital:  '2026-12-31',
};

/** Indicador de ativo (ponto branco sobre o acento da seção) */
function ActiveDot() {
  return <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white opacity-80" />;
}

/** Contagem — trabalho parado esperando alguém. O único selo com direito de
 *  competir com o rótulo por atenção. */
function SeloContagem({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black tabular-nums text-amber-800">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Novidade — uma cor só, e com prazo. */
function SeloNovo() {
  return (
    <span className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700">
      Novo
    </span>
  );
}

/** Acento de cada seção — usado SÓ no estado ativo. */
type Acento = 'emerald' | 'sky' | 'indigo' | 'slate' | 'violet' | 'teal' | 'amber';
const FUNDO_ATIVO: Record<Acento, string> = {
  emerald: 'bg-emerald-600',
  sky:     'bg-sky-600',
  indigo:  'bg-indigo-600',
  slate:   'bg-slate-900',
  violet:  'bg-violet-600',
  teal:    'bg-teal-600',
  amber:   'bg-amber-600',
};

/** A linha de navegação. Uma só, para os sete destinos.
 *
 *  ⚠️ TUDO AQUI DENTRO É `<span>`, e não `<div>`/`<p>`. Um `<button>` só aceita
 *  conteúdo de frase; os blocos originais punham `<div>` e `<p>` dentro do
 *  botão, o que é HTML inválido — o navegador perdoa, mas leitor de tela e
 *  hidratação do React não têm por que perdoar junto.
 */
function NavRow({
  Icon, rotulo, descricao, ativo, acento, onClick, selo,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  rotulo: string;
  descricao: string;
  ativo: boolean;
  acento: Acento;
  onClick: () => void;
  selo?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
        ativo ? FUNDO_ATIVO[acento] : 'hover:bg-slate-100'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        ativo ? 'bg-white/15' : 'border border-slate-200 bg-slate-50'
      }`}>
        <Icon size={16} strokeWidth={2.2} className={ativo ? 'text-white' : 'text-slate-500'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-black leading-none ${ativo ? 'text-white' : 'text-slate-800'}`}>
          {rotulo}
        </span>
        <span className={`mt-1 block truncate text-[10px] font-medium leading-none ${ativo ? 'text-white/60' : 'text-slate-400'}`}>
          {descricao}
        </span>
      </span>
      {ativo ? <ActiveDot /> : selo}
    </button>
  );
}

/** Rótulo de grupo da nav.
 *
 *  ⚠️ EXISTE PARA TORNAR A ORDEM VISÍVEL, não para decorar. Dez linhas sem
 *  divisão viram uma lista onde tudo pesa igual e a ordem parece arbitrária —
 *  que é como estava: "Parametrização", uma tela de configuração, era o
 *  TERCEIRO item, à frente de Gestão e de tudo que se usa todo dia. Com os
 *  grupos, a ordem passa a afirmar o ciclo do produto (encontrar → decidir e
 *  executar → ajustar) em vez de só existir. */
function GrupoNav({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3.5 pb-1 pt-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
      {children}
    </p>
  );
}

/**
 * Linha compacta para item de nav ainda bloqueado por nível.
 * Agrupados à parte (fora da nav ativa) para não competir visualmente
 * com o que o usuário já pode usar agora.
 */
function LockedNavRow({ label, tier, onClick }: { label: string; tier: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Lock size={11} className="shrink-0 text-slate-400" />
        <span className="truncate text-[12px] font-bold text-slate-500">{label}</span>
      </span>
      <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-slate-400">{tier}</span>
    </button>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function AppSidebar({
  token,
  userData,
  currentTier,
  activeTab,
  onSetActiveTab,
  onNotificacaoAberta,
  renovacoesCount,
  onNotifCountChange,
  onShowAuthModal,
  onOcultarMenu,
}: AppSidebarProps) {
  const router = useRouter();

  const isAnalise = activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes';

  // ⚠️ A DATA SÓ É LIDA DEPOIS DE MONTAR. Estas páginas são pré-renderizadas
  // no build (`○ Static`); comparar `new Date()` durante a renderização faria
  // o HTML gerado na compilação discordar do que o navegador calcula meses
  // depois — e discordância de HTML entre servidor e cliente é erro de
  // hidratação, não detalhe. Antes de montar, nenhum "Novo" aparece: é um
  // quadro de atraso num selo decorativo, contra uma classe inteira de bug.
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => { setAgora(Date.now()); }, []);
  const seloNovo = (chave: string) => {
    const ate = NOVIDADE_ATE[chave];
    if (!ate || agora === null) return undefined;
    return agora < new Date(`${ate}T23:59:59`).getTime() ? <SeloNovo /> : undefined;
  };

  const empresas = userData?.companies?.length
    ? userData.companies
    : userData?.company ? [userData.company] : [];

  return (
    <div className="flex flex-col gap-5 sticky top-28 print:hidden">

      {/* ── NAV PRINCIPAL ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 p-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm">

        {/* Perfil + sino */}
        {token && userData && (
          <>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {(userData.name || userData.nome || 'B').charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-black text-slate-700 truncate max-w-[100px]">
                  {(userData.name || userData.nome || '').split(' ')[0]}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <NotificationPanel
                  token={token ?? ''}
                  onNavigate={(tab, alvo) => {
                    if (alvo && onNotificacaoAberta) onNotificacaoAberta(tab, alvo);
                    else onSetActiveTab(tab);
                  }}
                  onCountChange={onNotifCountChange}
                />
                {/* ⚠️ SÓ O "OCULTAR" MORA AQUI — E ISSO É DELIBERADO.
                    Esconder o menu é uma ação SOBRE o menu, então o lugar dela
                    é dentro dele: some o botão flutuante que ficava por cima do
                    conteúdo em todas as telas.
                    Mas o par simétrico não pode morar junto: escondido o menu,
                    o botão de reabrir iria junto e não haveria volta. Quem
                    reabre é a aba na borda direita, renderizada pela casca
                    (`analysis-app.tsx`) justamente por sobreviver ao
                    fechamento. Dois lugares porque são dois contextos. */}
                {onOcultarMenu && (
                  <button
                    type="button"
                    onClick={onOcultarMenu}
                    title="Ocultar o menu e usar os 288px na tela"
                    aria-label="Ocultar menu"
                    className="hidden rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:inline-flex"
                  >
                    <PanelLeftClose size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="h-px bg-slate-100 mx-3 mb-0.5" />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            A ORDEM SEGUE O CICLO DO PRODUTO, e antes não seguia nenhum.

            Estava assim: Analisar, Decisões, Parametrização, Gestão, Meus
            contratos, Sugestões, Alertas, Vencendo no mercado. Três defeitos
            concretos nisso:

              • "Parametrização" era o 3º item. É tela de configuração — mexe-se
                uma vez e quase nunca mais — ocupando o lugar de honra à frente
                de Gestão, que se usa todo dia.
              • As duas telas de prospecção ("Sugestões" e a de contratos do
                setor a vencer) estavam separadas por Alertas e Capital, apesar
                de responderem à mesma pergunta: onde está o próximo edital.
              • "Alertas" parece acompanhamento e não é: é onde se ESCOLHE quais
                avisos receber. Os avisos em si chegam pelo sino. Configuração,
                portanto — o lugar dela é junto de Parametrização.

            Agora: encontrar → decidir e executar → ajustar.
            ═══════════════════════════════════════════════════════════════ */}
        <GrupoNav>Encontrar</GrupoNav>

        <NavRow
          Icon={Zap} rotulo="Analisar" descricao="Buscar no PNCP ou enviar o seu"
          ativo={isAnalise} acento="emerald"
          onClick={() => onSetActiveTab('workspace')}
        />

        {/* Sem nível: PNCP é API pública e a rota tem cache. Continua exigindo
            `userData` porque o fit depende do CNAE da empresa. */}
        {token && userData && (
          <NavRow
            Icon={Target} rotulo="Sugestões" descricao="O que combina com seu CNAE"
            ativo={activeTab === 'cnae'} acento="teal"
            onClick={() => onSetActiveTab('cnae')}
          />
        )}

        {/* ── Disputas que vão abrir ──────────────────────────────────────
            ⚠️ CHAMAVA-SE "VENCENDO NO MERCADO", e o nome dizia o contrário do
            que a tela faz. Em português "vencer" é ganhar E expirar, e a frase
            inteira só tem uma leitura idiomática: sucesso, resultado
            alcançado. Só que aqui não há nada ganho — são contratos de OUTROS
            fornecedores chegando ao fim, ou seja, disputas que ainda vão
            existir. O menu prometia troféu e entregava lista de prospecção.

            "Próximas disputas" fala de oportunidade, que é o que a tela é: o
            contrato do concorrente acabando é a disputa que vem. O catálogo de
            alertas chama o mesmo conceito de "Disputas que vão abrir"
            (`catalogo_alertas.py`) — a frase inteira não cabe aqui em uma
            linha quando o selo de contagem aparece ao lado, e linha de menu
            que quebra em duas some com o alinhamento da coluna. Mesmo
            substantivo, comprimento diferente conforme o espaço.

            ⚠️ NÃO CONFUNDIR COM "MEUS CONTRATOS", logo abaixo: aquele filtra
            pelo CNPJ da empresa como FORNECEDORA — é a carteira. Este busca
            por termo de segmento e devolve contrato de qualquer fornecedor.

            Sem nível: `contratos_vencendo.py` não chama modelo nenhum. A
            exigência real é ter empresa cadastrada — e é ela que decide entre
            as duas formas abaixo. */}
        {token && userData && (
          empresas.length > 0 ? (
            <NavRow
              Icon={RefreshCw} rotulo="Próximas disputas"
              descricao={renovacoesCount && renovacoesCount > 0
                ? `${renovacoesCount} contrato${renovacoesCount > 1 ? 's' : ''} do setor a vencer`
                : 'Contratos do setor a vencer'}
              ativo={activeTab === 'renovacoes'} acento="amber"
              onClick={() => onSetActiveTab('renovacoes')}
              selo={renovacoesCount && renovacoesCount > 0
                ? <SeloContagem count={renovacoesCount} />
                : undefined}
            />
          ) : (
            /* Sem empresa: a linha vira um convite. O selo "CONFIG." saiu — a
               descrição já É a instrução, e repeti-la em caixa alta no canto
               não acrescenta nada que a frase não diga melhor. */
            <NavRow
              Icon={RefreshCw} rotulo="Próximas disputas" descricao="Configure a empresa primeiro"
              ativo={false} acento="amber"
              onClick={() => router.push('/profile')}
            />
          )
        )}

        {token && <GrupoNav>Decidir e executar</GrupoNav>}

        {/* Sem nível: roda sobre análises que o cliente já pagou. */}
        {token && (
          <NavRow
            Icon={BookOpen} rotulo="Decisões" descricao="Laudos e resultados salvos"
            ativo={activeTab === 'history'} acento="sky"
            onClick={() => onSetActiveTab('history')}
          />
        )}

        {/* Sem nível: comparação entre laudos já pagos. Fora da barra no
            lançamento (LAUNCH_FLAGS) — a comparação vive como botão dentro de
            Decisões, onde os laudos já estão. */}
        {LAUNCH_FLAGS.compararNaSidebar && token && (
          <NavRow
            Icon={GitCompare} rotulo="Priorizar" descricao="Escolha o melhor edital"
            ativo={activeTab === 'comparar'} acento="violet"
            onClick={() => onSetActiveTab('comparar')}
            selo={seloNovo('comparar')}
          />
        )}

        {/* Sem nível. Estava exigindo 4 aqui e 2 na aba — o usuário do
            Essencial tinha a funcionalidade e não tinha como chegar nela.

            ⚠️ TROCA DE ABA, NÃO NAVEGA PARA OUTRA ROTA.
            Este era o ÚNICO item do menu com `router.push` em vez de
            `onSetActiveTab`, e `/gestao` é uma página avulsa que não renderiza
            a `AppSidebar`. Clicar em "Gestão" fazia o menu inteiro desaparecer,
            sem caminho de volta que não fosse o botão do navegador — e some
            junto a marcação de aba ativa, que é a referência de onde a pessoa
            está.

            A aba interna já existe (`activeTab === 'gestao'` em
            `analysis-app.tsx`) e a casca oferece o botão "Expandir", que libera
            os 288px desta coluna em QUALQUER aba. Espaço vira escolha
            reversível, em vez de efeito colateral da navegação. */}
        {token && (
          <NavRow
            Icon={ClipboardList} rotulo="Gestão" descricao="Fluxo dos editais"
            ativo={activeTab === 'gestao'} acento="slate"
            onClick={() => onSetActiveTab('gestao')}
          />
        )}

        {token && userData && (
          <NavRow
            Icon={FolderOpen} rotulo="Meus contratos" descricao="Carteira da sua empresa"
            ativo={activeTab === 'meus-contratos'} acento="emerald"
            onClick={() => onSetActiveTab('meus-contratos')}
          />
        )}

        {/* Atrás de flag no lançamento: integração bancária é aposta pós-PMF.
            Fica na execução, não na descoberta: é fôlego para entregar o que
            já foi ganho. */}
        {LAUNCH_FLAGS.capital && token && currentTier >= 3 && (
          <NavRow
            Icon={DollarSign} rotulo="Capital" descricao="Fôlego para executar"
            ativo={activeTab === 'capital'} acento="sky"
            onClick={() => onSetActiveTab('capital')}
            selo={seloNovo('capital')}
          />
        )}

        {token && <GrupoNav>Ajustes</GrupoNav>}

        {/* ⚠️ ALERTAS É CONFIGURAÇÃO, não caixa de entrada. A tela lista os dez
            tipos de aviso e deixa ligar/desligar cada um; os avisos em si
            chegam pelo sino, no topo desta mesma coluna. Enquanto ficava no
            meio da nav, entre Sugestões e Capital, prometia ser o lugar de LER
            alertas. */}
        {token && currentTier >= 3 && (
          <NavRow
            Icon={Bell} rotulo="Alertas" descricao="Escolha quais avisos receber"
            ativo={activeTab === 'alertas'} acento="amber"
            onClick={() => onSetActiveTab('alertas')}
            selo={seloNovo('alertas')}
          />
        )}

        {token && (
          <NavRow
            Icon={SlidersHorizontal} rotulo="Parametrização" descricao="Critérios de avaliação por IA"
            ativo={activeTab === 'parametrizacao'} acento="indigo"
            onClick={() => onSetActiveTab('parametrizacao')}
          />
        )}
      </div>

      {/* ── RECURSOS BLOQUEADOS (agrupados, fora da nav ativa) ──────────────── */}
      {token && (currentTier < 4) && (
        <details open className="group rounded-[1.5rem] border border-slate-100 bg-slate-50/60 px-1 py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-white">
            <span className="flex items-center gap-1.5">
              <Lock size={11} className="shrink-0" />
              Recursos por nível
            </span>
            <ChevronDown size={13} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-0.5 px-1 pb-1 pt-1">
            {/* Sobraram só as que realmente travam. Cinco linhas saíram
                daqui porque as funcionalidades foram abertas — deixar o selo
                sem a trava seria a mesma incoerência ao contrário.

                O Simulador entrou: ele é travado no Nível 4 desde sempre
                (TacticalSimulator.tsx) e nunca tinha aparecido nesta lista,
                então a única exclusividade real do plano de R$ 497 não
                circulava nem como promessa. */}
            {currentTier < 3 && (
              <LockedNavRow label="Alertas" tier="NÍV. 3" onClick={() => router.push('/plans')} />
            )}
            {/* Capital fora do lançamento: não se promete cadeado de um módulo
                que a flag esconde até para quem paga. */}
            {LAUNCH_FLAGS.capital && currentTier < 3 && (
              <LockedNavRow label="Capital" tier="NÍV. 3" onClick={() => router.push('/plans')} />
            )}
            {currentTier < 4 && (
              <LockedNavRow label="Simulador de preços" tier="NÍV. 4" onClick={() => router.push('/plans')} />
            )}
          </div>
        </details>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RODAPÉ — CONTEXTO E CONTA
          ═══════════════════════════════════════════════════════════════════
          ⚠️ AQUI HAVIA UM CARTÃO DE 250px CHAMADO "IDENTIDADE ESTRATÉGICA",
          com avatar de 56px, nome, crachá de nível, e-mail, barra de vagas da
          equipe e seletor de contexto. Dois problemas.

          O primeiro é de convenção: conta e perfil ficam no RODAPÉ da barra,
          discretos, atrás de um divisor — não num painel com título próprio no
          meio da navegação. Nome e avatar já estavam no topo desta mesma
          coluna; o cartão era a segunda vez.

          O segundo é de destino: "1 de 10 Vagas" e o e-mail não mudam nada no
          que você está fazendo agora, e a página /profile já tem os dois, com
          a lista de membros junto. Fato de conta pertence à tela de conta.

          O que ficou é o que É operacional: o CONTEXTO ATIVO decide por qual
          CNPJ o app inteiro consulta, e trocar de empresa muda a tela toda. */}
      {token && userData ? (
        <div className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-100 bg-white p-2 shadow-sm">
          {/* ⚠️ SÓ RENDERIZA QUANDO HÁ O QUE TROCAR. Com uma empresa só — o
              caso da maioria — o `ActiveContextSwitcher` desenha um `<p>`
              estático dentro de uma caixa com borda e rótulo em caixa alta:
              a moldura de um controle inteiro para exibir um nome. Com uma
              empresa, o nome desce para a linha da conta, como texto. */}
          {empresas.length > 1 && (
            <ActiveContextSwitcher
              companies={empresas}
              activeCnpj={userData.active_cnpj}
              label="Contexto ativo"
              compact
              className="border-slate-200 bg-slate-50"
            />
          )}

          {/* ⚠️ SEM AVATAR E SEM O NOME AQUI. O topo desta mesma coluna já tem
              os dois, e a primeira versão deste rodapé repetia ambos — "Marcelo"
              no alto, "Marcelo Mendes" embaixo, na mesma barra de 288px. O que
              o rodapé precisa carregar é o que o topo NÃO diz: por qual empresa
              o app está consultando (visível em toda aba, não só no Radar) e o
              caminho para a conta. */}
          {empresas.length === 1 && (
            <div className="px-2.5 pt-1">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                Contexto ativo
              </p>
              <p className="mt-1 truncate text-[12px] font-black text-slate-800">
                {getCompanyDisplayName(empresas[0])}
              </p>
            </div>
          )}

          <button
            onClick={() => router.push('/profile')}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <UserCog size={13} className="shrink-0 text-slate-400" />
            Conta e equipe
            <span className="ml-auto text-[10px] font-medium text-slate-400">Nível {currentTier}</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300" />
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform shadow-inner">
            <ScanSearch size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">Modo anônimo</h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
            Inicie sessão para ativar o Matchmaker de CNAE e salvar análises.
          </p>
          <button
            onClick={() => onShowAuthModal('login')}
            className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 border border-emerald-600 shadow-sm"
          >
            Entrar na conta
          </button>
        </div>
      )}

      {/* ── MOTOR DE ANÁLISE — 4 agentes (colapsado por padrão) ─────────────
          Isto é copy de página de vendas dentro do produto: descreve o que a
          ferramenta faz para alguém que já comprou e já usou. Fica, porque
          colapsado custa uma linha e a lista tem valor de consulta — mas
          desceu para o fim e perdeu o ponto verde pulsando.

          ⚠️ O PONTO PULSAVA SEM MEDIR NADA. Mesma família do "PNCP ativo" que
          saiu do topo: animação de "ao vivo" num bloco estático. Nenhum dos
          quatro agentes é consultado para desenhar esta lista — ela é um array
          escrito à mão logo abaixo. Ponto parado, cinza. */}
      <details className="group bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motor de Análise</span>
          <span className="ml-auto text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold border border-slate-200">
            4 Agentes IA
          </span>
          <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="divide-y divide-slate-50 border-t border-slate-100">
          {[
            { bg: 'bg-amber-50',   border: 'border-amber-100',   Icon: Scale,        color: 'text-amber-500',  label: 'Agente Jurídico',   desc: 'Fundamentação legal · Impugnações · Lei 14.133/21' },
            { bg: 'bg-emerald-50', border: 'border-emerald-100', Icon: TrendingDown,  color: 'text-emerald-500',label: 'Agente Financeiro', desc: 'Score de deságio · Margens · Viabilidade real' },
            { bg: 'bg-sky-50',     border: 'border-sky-100',     Icon: ShieldCheck,   color: 'text-sky-500',    label: 'Agente Auditor',    desc: 'Armadilhas contratuais · Compliance · Riscos' },
            { bg: 'bg-sky-50',     border: 'border-sky-100',     Icon: Cpu,           color: 'text-sky-500',    label: 'Neural Matchmaker', desc: 'CNAE vs. edital · Capacidade técnica · Fit' },
          ].map(({ bg, border, Icon, color, label, desc }) => (
            <div key={label} className="flex items-start gap-3 px-5 py-4">
              <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[13px] font-black text-slate-800 leading-none mb-1.5">{label}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-1.5">
          {['Go/No-Go', 'Score Deságio', 'Radar Concorrentes', 'Parecer Jurídico', 'Capital de Giro'].map(item => (
            <span key={item} className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
              ✓ {item}
            </span>
          ))}
        </div>
      </details>

      {/* ── SUPORTE ────────────────────────────────────────────────────────
          Eram três elementos empilhados num cartão de 110px — título, promessa
          de SLA e botão — para uma ação que a maioria nunca usa. Virou uma
          linha. O "responde em até 24h" continua, agora como o próprio rótulo:
          é a informação que decide se a pessoa clica. */}
      <a
        href="mailto:development@bawzi.com"
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <MessageCircle size={13} className="shrink-0 text-slate-400" />
        Falar com o suporte
        <span className="ml-auto text-[10px] font-medium text-slate-400">responde em 24h</span>
      </a>

    </div>
  );
}
