'use client';

/**
 * MeusContratos.tsx — a carteira da própria empresa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ESTA TELA NÃO É "RENOVAÇÕES"
 * ═══════════════════════════════════════════════════════════════════════════
 * O radar de renovações busca no PNCP inteiro por termo de segmento + UF:
 * devolve contratos de QUALQUER fornecedor que estão vencendo. É prospecção —
 * "quem vai perder o contrato que eu posso disputar". Aqui a pergunta é
 * "quais contratos EU tenho", e só o CNPJ do fornecedor responde isso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ A FAIXA DE COBERTURA NÃO É DECORAÇÃO — É A PRINCIPAL INFORMAÇÃO DA TELA
 * ═══════════════════════════════════════════════════════════════════════════
 * A API de consulta do PNCP não filtra contrato por CNPJ do fornecedor
 * (`/v1/contratos` aceita datas, `cnpjOrgao` — o CONTRATANTE — e paginação).
 * Então isto vem do índice local, que só tem o que o `worker_ingestao` baixou.
 *
 * Uma tela chamada "Meus contratos" promete completude. Se o índice cobre 15
 * dias e a empresa tem 40 contratos, ela mostra 1 — e alguém decide
 * faturamento em cima desse 1. Por isso o período coberto aparece SEMPRE, no
 * topo, antes dos números, e em âmbar quando a janela é curta demais para a
 * frase "todos os seus contratos" ser verdade.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen, RefreshCw, Loader2, AlertTriangle, Building2, MapPin,
  CalendarClock, CircleSlash, Search, Download, Users,
} from 'lucide-react';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

/** ⚠️ `renovar` (91–180 dias) existe porque 90 dias é tarde demais para um
 *  contrato público. Ver `DIAS_ALERTA_RENOVACAO` no backend. */
type Situacao = 'vigente' | 'renovar' | 'vencendo' | 'encerrado' | 'sem_prazo';

interface Contrato {
  numeroControlePNCP?: string | null;
  objeto: string;
  orgao_nome: string;
  orgao_cnpj?: string;
  uf: string;
  valor: number;
  /** Valor de assinatura. Diferente de `valor`, indica crescimento por aditivo. */
  valor_inicial?: number;
  modalidade?: string;
  data_assinatura?: string | null;
  data_vigencia_ini?: string | null;
  data_vigencia_fim?: string | null;
  total_itens: number;
  situacao: Situacao;
}

interface Resumo {
  total: number; vigentes: number; renovar: number; vencendo: number;
  encerrados: number; sem_prazo: number;
  valor_vigente: number; valor_total: number;
  /** Receita cuja continuidade se decide nos próximos 180 dias. */
  valor_em_risco: number;
  orgaos: number; ufs: number;
  maior_orgao: { nome: string; valor: number } | null;
  /** % do valor em execução que vem do maior órgão. Risco de conta. */
  concentracao: number | null;
  com_aditivo: number; valor_aditivo: number;
}

interface Sincronizacao {
  /** ISO da última atualização BEM-SUCEDIDA. `null` = nunca sincronizou. */
  atualizado_em: string | null;
  atualizando: boolean;
  nunca: boolean;
  erro: string | null;
}

interface OrgaoConcorrencia {
  orgao_cnpj: string;
  orgao_nome: string;
  valor_orgao: number;
  meu_valor: number;
  minha_fatia: number | null;
  concorrentes: number;
  maiores: { nome: string; cnpj: string; valor: number; contratos: number }[];
}

interface Cobertura {
  de: string | null;
  ate: string | null;
  total: number;
  /** Quantos contratos do índice têm o CNPJ do fornecedor preenchido.
   *  É a métrica que decide se esta tela consegue funcionar — ver o comentário
   *  de `cobertura_do_indice` no backend. `null` = não foi possível medir. */
  com_fornecedor: number | null;
  /** Contratos vindos da varredura dia-a-dia — o único subconjunto sobre o
   *  qual "todos os seus contratos" pode ser dito. O resto veio da busca do
   *  PNCP, que o Elasticsearch corta em 10.000 resultados: é amostra. */
  censo: number;
  /** Destes, quantos têm fornecedor. Tende a 100%: a lista de `/api/consulta`
   *  já traz o CNPJ e o nome do fornecedor no mesmo payload. É o número que
   *  decide se ESTA tela funciona — `com_fornecedor` sobre o total inclui os
   *  ~148 mil herdados do `/api/search`, que nasceram sem fornecedor e puxam
   *  o percentual para baixo sem dizer nada sobre a janela varrida. */
  censo_com_fornecedor: number | null;
  /** Contratos já encerrados dentro da varredura. Zero significa base de
   *  carteira viva; qualquer número acima disso significa que há histórico. */
  encerrados?: number;
  /** Dias DISTINTOS com dado. Comparado com o intervalo `de`→`ate`, é o que
   *  revela que a base é feita de ilhas e não de uma varredura contínua.
   *  `null` = não foi possível medir; a tela então não afirma continuidade
   *  nem buraco. */
  dias_com_dados?: number | null;
  /** `"vigentes"` = só carteira em execução · `"todos"` = inclui histórico ·
   *  `null` = base vazia, nada a anunciar. NÃO é uma constante do código: vem
   *  da contagem de encerrados, para a tela não poder mentir sobre o próprio
   *  recorte depois que a política de ingestão muda. */
  politica?: string | null;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const dataBr = (iso?: string | null) =>
  iso && iso.length >= 10 ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

/** "há 3 minutos", "há 5 horas", "ontem"… a partir de um ISO.
 *
 *  ⚠️ SÓ É CHAMADA DEPOIS DA RESPOSTA DA API, nunca durante a renderização
 *  inicial. Ler o relógio enquanto o Next pré-renderiza produz um HTML no
 *  servidor e outro no cliente, e o React reclama de hidratação — foi assim
 *  que o `Date.now()` da barra lateral quebrou. Aqui `sinc` só existe depois
 *  do `fetch`, que roda no navegador. */
function haQuanto(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Dias entre hoje e a data — negativo quando já passou. */
function diasAte(iso?: string | null): number | null {
  if (!iso || iso.length < 10) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - hojeUtc) / 86_400_000);
}

const ESTILO: Record<Situacao, { rotulo: string; chip: string; barra: string }> = {
  vencendo:  { rotulo: 'Vence em breve', chip: 'border-red-200 bg-red-50 text-red-800',         barra: 'bg-red-500' },
  // ⚠️ ÂMBAR, NÃO VERDE. Este contrato ainda está saudável, mas é a faixa em
  // que a decisão de prorrogar ou disputar ainda cabe no calendário. Pintá-lo
  // de verde junto com os de dois anos de vigência apagaria a diferença que
  // justifica a faixa existir.
  renovar:   { rotulo: 'Hora de renovar', chip: 'border-amber-200 bg-amber-50 text-amber-800',  barra: 'bg-amber-500' },
  vigente:   { rotulo: 'Vigente',        chip: 'border-emerald-200 bg-emerald-50 text-emerald-800', barra: 'bg-emerald-500' },
  sem_prazo: { rotulo: 'Sem prazo',      chip: 'border-slate-200 bg-slate-50 text-slate-600',   barra: 'bg-slate-300' },
  encerrado: { rotulo: 'Encerrado',      chip: 'border-slate-200 bg-white text-slate-500',      barra: 'bg-slate-300' },
};

// A ordem em que as situações importam: o que exige ação primeiro.
const ORDEM: Situacao[] = ['vencendo', 'renovar', 'vigente', 'sem_prazo', 'encerrado'];

/** ⚠️ CSV COM `;` E BOM, NÃO O PADRÃO INTERNACIONAL.
 *  Quem gere carteira pública abre isto no Excel em português, onde a vírgula
 *  é separador DECIMAL: um CSV com vírgulas joga "55.885.500,00" em duas
 *  colunas e a planilha chega quebrada. E sem o BOM, todo "ó" de "órgão" vira
 *  caractere solto. Os dois detalhes decidem se o arquivo é útil ou lixo. */
function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const escapar = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = linhas.map((l) => l.map(escapar).join(';')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MeusContratos({ activeCnpj }: { activeCnpj?: string | null }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [empresa, setEmpresa] = useState<{ cnpj: string; nome: string } | null>(null);
  const [semEmpresa, setSemEmpresa] = useState(false);
  const [filtro, setFiltro] = useState<Situacao | null>(null);
  const [busca, setBusca] = useState('');
  // ⚠️ ESTADO SEPARADO, CARREGAMENTO SEPARADO. O painel de concorrentes vem de
  // uma agregação sobre TODOS os fornecedores dos órgãos da carteira — a
  // consulta mais cara da tela. Junto na resposta principal, a lista de
  // contratos (que é o que a pessoa veio ver) esperaria por ele. Aqui a lista
  // aparece na hora e o painel chega quando ficar pronto.
  const [arena, setArena] = useState<OrgaoConcorrencia[] | null>(null);
  const [arenaFalhou, setArenaFalhou] = useState(false);
  const [sinc, setSinc] = useState<Sincronizacao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const url = `${API_URL}/api/pncp/meus-contratos${activeCnpj ? `?active_cnpj=${encodeURIComponent(activeCnpj)}` : ''}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.status === 'sem_empresa') {
        setSemEmpresa(true);
        setContratos([]); setResumo(null); setCobertura(null);
        return;
      }
      setSemEmpresa(false);
      setContratos(json.data || []);
      setResumo(json.resumo || null);
      setCobertura(json.cobertura || null);
      setEmpresa(json.empresa || null);
      setSinc(json.sincronizacao || null);
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      // ⚠️ MENSAGEM DE ERRO COM SAÍDA. "Falha ao carregar" sem botão deixa a
      // pessoa recarregando a página inteira para tentar de novo.
      setErro('Não foi possível carregar seus contratos agora.');
    } finally {
      setCarregando(false);
    }
  }, [activeCnpj]);

  const carregarArena = useCallback(async () => {
    setArenaFalhou(false);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const url = `${API_URL}/api/pncp/meus-contratos/concorrentes${activeCnpj ? `?active_cnpj=${encodeURIComponent(activeCnpj)}` : ''}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setArena(json.orgaos || []);
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      // ⚠️ FALHA AQUI NÃO DERRUBA A TELA. O painel é complementar; a carteira
      // já está na frente da pessoa. Some o painel, aparece um retry, e o
      // resto continua funcionando.
      setArenaFalhou(true);
    }
  }, [activeCnpj]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarArena(); }, [carregarArena]);

  // ⚠️ ENQUANTO ATUALIZA, A TELA VOLTA SOZINHA — SENÃO A PROMESSA FICA NO AR.
  // O backend responde na hora e faz a busca dirigida atrás (~70s). Se a tela
  // dissesse "atualizando…" e nunca mais olhasse, o texto viraria mentira
  // permanente até alguém apertar F5 — e a pessoa não tem como saber quando.
  // A consulta é barata (o índice resolve em ~10ms) e para sozinha quando a
  // atualização termina.
  useEffect(() => {
    if (!sinc?.atualizando) return;
    const t = setInterval(() => { carregar(); carregarArena(); }, 8000);
    return () => clearInterval(t);
  }, [sinc?.atualizando, carregar, carregarArena]);

  const sincronizar = useCallback(async () => {
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      await apiFetch(
        `${API_URL}/api/pncp/meus-contratos/sincronizar${activeCnpj ? `?active_cnpj=${encodeURIComponent(activeCnpj)}` : ''}`,
        { method: 'POST' },
      );
      // Marca "atualizando" na hora, sem esperar o próximo carregamento: é o
      // que faz o botão responder ao clique em vez de parecer travado.
      setSinc((s) => (s ? { ...s, atualizando: true } : s));
      carregar();
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      setErro('Não foi possível iniciar a atualização agora.');
    }
  }, [activeCnpj, carregar]);


  const termo = busca.trim().toLowerCase();
  const visiveis = contratos.filter((c) => {
    if (filtro && c.situacao !== filtro) return false;
    if (!termo) return true;
    return (`${c.objeto} ${c.orgao_nome}`).toLowerCase().includes(termo);
  });

  const exportar = useCallback(() => {
    const linhas: (string | number)[][] = [
      ['Situação', 'Objeto', 'Órgão', 'UF', 'Modalidade', 'Valor (R$)',
       'Valor inicial (R$)', 'Assinatura', 'Início vigência', 'Fim vigência',
       'Dias restantes', 'Nº controle PNCP', 'Link'],
      ...visiveis.map((c) => [
        ESTILO[c.situacao].rotulo,
        c.objeto,
        c.orgao_nome,
        c.uf,
        c.modalidade || '',
        // ⚠️ Vírgula decimal: é o que o Excel em português entende como número.
        // Com ponto, a coluna inteira vira texto e nenhuma soma funciona.
        c.valor.toFixed(2).replace('.', ','),
        (c.valor_inicial ?? 0).toFixed(2).replace('.', ','),
        c.data_assinatura || '',
        c.data_vigencia_ini || '',
        c.data_vigencia_fim || '',
        diasAte(c.data_vigencia_fim) ?? '',
        c.numeroControlePNCP || '',
        c.numeroControlePNCP ? `https://pncp.gov.br/app/contratos/${c.numeroControlePNCP}` : '',
      ]),
    ];
    const hoje = new Date().toISOString().slice(0, 10);
    baixarCsv(`meus-contratos-${hoje}.csv`, linhas);
  }, [visiveis]);

  // Janela curta = a promessa do título não se sustenta. O corte é 180 dias:
  // abaixo disso é impossível que a carteira de uma empresa ativa caiba aqui.
  const diasCobertos = (() => {
    if (!cobertura?.de || !cobertura?.ate) return 0;
    const ini = diasAte(cobertura.de), fim = diasAte(cobertura.ate);
    return ini !== null && fim !== null ? Math.abs(fim - ini) + 1 : 0;
  })();
  const coberturaCurta = diasCobertos > 0 && diasCobertos < 180;

  // ⚠️ A DIFERENÇA ENTRE "INTERVALO" E "VARREDURA".
  // `diasCobertos` é a distância entre o primeiro e o último dia com dado —
  // um intervalo. `dias_com_dados` é quantos daqueles dias foram de fato
  // varridos. Quando o segundo é bem menor que o primeiro, a base é feita de
  // ilhas, e chamar isso de "varredura completa" é a promessa que esta tela
  // não pode fazer. 90% de folga porque fim de semana no PNCP tem publicação
  // rala e um punhado de dias vazios não significa buraco de varredura.
  const temBuracos =
    cobertura?.dias_com_dados != null &&
    diasCobertos > 0 &&
    cobertura.dias_com_dados < diasCobertos * 0.9;

  // ⚠️ A PERGUNTA QUE DECIDE TUDO: o índice sabe de QUEM são os contratos?
  // O `/api/search` do PNCP não devolve fornecedor; o índice grava o campo
  // vazio e depende de um worker de enriquecimento para preenchê-lo depois.
  // Enquanto esse worker não roda, a coluna que esta tela consulta está em
  // branco na base inteira — e a busca devolve zero para todo mundo, inclusive
  // para quem tem centenas de contratos. Sem medir isto, a tela leria esse
  // zero como "você não tem contratos". É o pior erro que ela poderia cometer:
  // afirmar um fato sobre o negócio da pessoa a partir de um campo não
  // preenchido.
  //
  // ⚠️ MAS O ALARME TEM QUE OLHAR PARA A POPULAÇÃO CERTA.
  // A primeira versão media `com_fornecedor / total` sobre a coleção inteira.
  // Depois que o censo passou a funcionar, isso ficou errado ao contrário: a
  // base guarda ~148 mil documentos herdados do `/api/search` que nasceram sem
  // fornecedor e nunca vão ter um, então o percentual global segue baixo mesmo
  // com a janela varrida 100% identificada. A tarja vermelha aparecia por cima
  // de uma tela que já respondia certo, e mandava a pessoa esperar um worker
  // que não precisa mais rodar.
  // O alarme só é verdade quando NÃO HÁ censo em que se apoiar — ou quando o
  // próprio censo está cego.
  const pctComFornecedor =
    cobertura?.com_fornecedor != null && cobertura.total > 0
      ? Math.round((cobertura.com_fornecedor / cobertura.total) * 100)
      : null;
  const pctCensoComFornecedor =
    cobertura?.censo_com_fornecedor != null && cobertura.censo > 0
      ? Math.round((cobertura.censo_com_fornecedor / cobertura.censo) * 100)
      : null;
  const censoCego = pctCensoComFornecedor != null && pctCensoComFornecedor < 5;
  const semCenso = (cobertura?.censo ?? 0) === 0;

  const semFornecedorNoIndice =
    cobertura != null &&
    cobertura.com_fornecedor != null &&
    cobertura.total > 0 &&
    cobertura.com_fornecedor / cobertura.total < 0.05 &&
    (semCenso || censoCego);

  // Documentos que a tela NUNCA vai conseguir atribuir a ninguém: estão no
  // índice, mas sem fornecedor. Não é motivo de alarme — é um ponto cego que
  // precisa ser dito em voz normal, senão a pessoa acha que a lista é o total.
  const cegos =
    cobertura?.com_fornecedor != null
      ? Math.max(0, cobertura.total - cobertura.com_fornecedor)
      : 0;

  return (
    <div className="w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700 shadow-sm">
              <FolderOpen size={13} />
              Meus contratos
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">
              Contratos da sua empresa
            </h2>
            <p className="mt-1.5 text-[13px] font-medium text-slate-500">
              Onde{' '}
              <strong className="font-black text-slate-800">
                {empresa?.nome || 'sua empresa'}
              </strong>{' '}
              aparece como fornecedor no PNCP.
            </p>
          </div>
          {/* ⚠️ "ATUALIZAR" PRECISA DIZER DE QUANDO É O DADO.
              Antes o botão só recarregava a tela a partir do banco — e o banco
              podia estar de uma semana atrás sem nada na interface indicando
              isso. Um botão chamado "Atualizar" que não busca nada novo na
              fonte é pior que nenhum: ele dá a sensação de estar em dia. Agora
              ele pede uma busca real no PNCP, e a idade do dado fica escrita
              ao lado, sempre. */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={sincronizar}
              disabled={carregando || !!sinc?.atualizando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={12} className={carregando || sinc?.atualizando ? 'animate-spin' : ''} />
              {sinc?.atualizando ? 'Buscando no PNCP…' : 'Atualizar'}
            </button>
            {sinc && (
              <span className="text-[10px] font-semibold text-slate-400">
                {sinc.atualizando
                  ? 'leva cerca de um minuto'
                  : sinc.nunca
                    ? 'nunca sincronizado'
                    : `sincronizado ${haQuanto(sinc.atualizado_em)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── O que o índice sabe — antes de qualquer número ────────────────── */}
      {semFornecedorNoIndice ? (
        /* Este estado tem prioridade sobre tudo: enquanto ele existe, nenhum
           número desta tela significa coisa alguma. */
        <div className="flex flex-wrap items-start gap-2 border-b border-red-200 bg-red-50 px-5 py-3 md:px-6">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700" />
          <p className="text-[11px] font-semibold leading-relaxed text-red-900">
            <strong className="font-black">O índice ainda não sabe quem é o fornecedor dos contratos.</strong>{' '}
            São {cobertura!.total.toLocaleString('pt-BR')} contratos indexados e apenas{' '}
            {cobertura!.com_fornecedor!.toLocaleString('pt-BR')} com o CNPJ do fornecedor
            preenchido ({pctComFornecedor}%). A busca do PNCP não devolve esse campo — ele é
            preenchido depois, contrato a contrato, pelo worker de enriquecimento.
            Enquanto ele não concluir, esta tela devolve zero para qualquer empresa,
            inclusive as que têm centenas de contratos.
          </p>
        </div>
      ) : cobertura?.de ? (
        <div className={`flex flex-wrap items-start gap-2 border-b px-5 py-3 md:px-6 ${
          coberturaCurta ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'
        }`}>
          <CalendarClock size={14} className={`mt-0.5 shrink-0 ${coberturaCurta ? 'text-amber-700' : 'text-slate-400'}`} />
          <p className={`text-[11px] font-semibold leading-relaxed ${coberturaCurta ? 'text-amber-900' : 'text-slate-600'}`}>
            {/* ⚠️ "VARRIDO POR INTEIRO", E NÃO "COBRE". A frase antiga dizia
                "cobre os contratos publicados entre X e Y" medindo a data de
                ASSINATURA — e três dias de varredura real produziram "de
                20/12/2022 a 05/01/2026", porque contrato publicado em 2025 pode
                ter sido assinado em 2022. Três anos anunciados sobre três dias.
                Agora a medida é a data de PUBLICAÇÃO, que é por onde a
                varredura caminha, e a contagem diz quantos contratos vieram
                dela — o resto do índice é amostra e não sustenta a promessa. */}
            {/* ⚠️ ISTO JÁ DISSE "VARREDURA COMPLETA DO PNCP ENTRE X E Y", E ERA
                FALSO. Com 57 mil documentos entre 02/01/2023 e 06/08/2026, a
                frase anunciava três anos e meio auditados — quando o PNCP
                publica milhares de contratos POR DIA e uma varredura de fato
                completa desse intervalo teria milhões, não 57 mil. O que existe
                são ilhas: 2023 só vigentes, pedaços de 2024, uma semana de
                agosto de 2026. Mínimo e máximo não revelam buraco nenhum, e
                "completa" é exatamente a palavra que uma base com buracos não
                pode usar. Agora quem fala é a contagem de dias varridos. */}
            {temBuracos ? (
              <>
                A varredura cobre{' '}
                <strong className="font-black">{cobertura.dias_com_dados!.toLocaleString('pt-BR')} dias</strong>
                {' '}dentro do intervalo de {dataBr(cobertura.de)} a {dataBr(cobertura.ate)}
                {' '}({diasCobertos.toLocaleString('pt-BR')} dias corridos) —{' '}
                <strong className="font-black">o resto ainda não foi varrido</strong>.
                São {cobertura.censo.toLocaleString('pt-BR')} contratos.
              </>
            ) : (
              <>
                Varredura completa do PNCP entre{' '}
                <strong className="font-black">{dataBr(cobertura.de)}</strong> e{' '}
                <strong className="font-black">{dataBr(cobertura.ate)}</strong>
                {' '}({cobertura.censo.toLocaleString('pt-BR')} contratos).
              </>
            )}
            {/* ⚠️ O PERCENTUAL AQUI É O DO CENSO, NÃO O DA BASE INTEIRA.
                A lista de `/api/consulta` traz o fornecedor no mesmo payload,
                então dentro da varredura ele é conhecido em ~100%. Exibir o
                percentual global misturava esse dado com os herdados do
                `/api/search`, que nasceram sem fornecedor: dava ~27% e sugeria
                que a varredura estava incompleta quando não estava. */}
            {pctCensoComFornecedor != null && pctCensoComFornecedor < 100 && (
              <>
                {' '}Em <strong className="font-black">{pctCensoComFornecedor}%</strong> deles
                o fornecedor está identificado.
              </>
            )}
            {' '}Fora dessas datas, o que existe é uma amostra — contratos podem faltar.
            {/* O ponto cego, dito em voz normal: documentos que estão no índice
                mas não pertencem a ninguém que a tela consiga nomear. */}
            {cegos > 0 && (
              <>
                {' '}Há ainda <strong className="font-black">{cegos.toLocaleString('pt-BR')}</strong>
                {' contratos herdados da busca antiga do PNCP, que não devolve o fornecedor: '}
                esses não são atribuíveis a nenhuma empresa e não entram na sua lista.
              </>
            )}
            {/* ⚠️ O RECORTE PRECISA SER ANUNCIADO. O índice guarda só contratos
                em execução — decisão tomada contra o teto de 512 MB do cluster,
                já que o PNCP publica ~1,4 milhão de contratos por ano. Sem esta
                frase, alguém abre a tela, vê quatro contratos e conclui que a
                empresa teve quatro na vida. É a mesma falha que fez esta tela
                dizer "sua empresa não tem contratos" para quem tem centenas. */}
            {cobertura.politica === 'vigentes' && (
              <>
                {' '}Esta base guarda <strong className="font-black">apenas contratos em
                execução</strong>: os já encerrados saem dela, então isto é a sua
                carteira de hoje — não o seu histórico.
              </>
            )}
            {/* O oposto também precisa ser dito. Com a base completa, a lista
                mistura contrato vivo e contrato morto — e um total que soma os
                dois responde a pergunta errada se ninguém avisar. O filtro por
                situação, logo abaixo, é o que separa. */}
            {cobertura.politica === 'todos' && (
              <>
                {' '}Esta base inclui <strong className="font-black">contratos já
                encerrados</strong>{cobertura.encerrados ? <> ({cobertura.encerrados.toLocaleString('pt-BR')} na janela)</> : null}:
                a lista abaixo é carteira viva <em>e</em> histórico juntos — use os
                filtros de situação para separar.
              </>
            )}
            {coberturaCurta && (
              <>
                {' '}São {diasCobertos} dia{diasCobertos === 1 ? '' : 's'} de base — contratos
                assinados fora dessa janela <strong className="font-black">não aparecem aqui</strong>,
                mesmo existindo. Amplie a base rodando a ingestão do período que faltar.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="p-5 md:p-6">

        {carregando && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Consultando o índice…
          </div>
        )}

        {!carregando && erro && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle size={18} className="shrink-0 text-red-600" />
            <p className="flex-1 text-sm font-semibold text-red-800">{erro}</p>
            <button onClick={carregar}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-red-700">
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !erro && semEmpresa && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <Building2 size={22} className="mx-auto mb-2 text-amber-600" />
            <p className="text-sm font-black text-amber-900">Cadastre o CNPJ da empresa</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] font-medium text-amber-800">
              É o CNPJ que identifica os contratos em que sua empresa é a fornecedora.
              Sem ele, não há como separar os seus dos de todo mundo.
            </p>
            <a href="/profile"
              className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-amber-700">
              Cadastrar empresa →
            </a>
          </div>
        )}

        {!carregando && !erro && !semEmpresa && resumo && (
          <>
            {/* ── Resumo ─────────────────────────────────────────────────── */}
            {/* ⚠️ O SEGUNDO CARTÃO ERA "VENCENDO EM 90 DIAS" E MOSTRAVA ZERO
                AO LADO DE UM CONTRATO DE R$ 55,8 MILHÕES QUE VENCE EM 105
                DIAS. Aritmeticamente certo, operacionalmente errado: juntos,
                os dois diziam "nada exige sua atenção". Agora a janela é de
                180 dias e o cartão mostra DINHEIRO, não contagem — é o valor
                que faz alguém largar o que está fazendo, não o número 1. */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { r: 'Em execução', v: String(resumo.vigentes + resumo.renovar + resumo.vencendo), cor: 'text-slate-900' },
                { r: 'Valor em execução', v: brl(resumo.valor_vigente), cor: 'text-emerald-700' },
                {
                  r: 'Em decisão · 180 dias',
                  v: resumo.valor_em_risco > 0 ? brl(resumo.valor_em_risco) : '—',
                  cor: resumo.vencendo > 0 ? 'text-red-700'
                     : resumo.renovar > 0 ? 'text-amber-700' : 'text-slate-300',
                },
                { r: 'Encerrados', v: String(resumo.encerrados), cor: 'text-slate-400' },
              ].map(({ r, v, cor }) => (
                <div key={r} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{r}</p>
                  <p className={`mt-1 truncate text-lg font-black leading-none ${cor}`}>{v}</p>
                </div>
              ))}
            </div>

            {/* ── Saúde da carteira ──────────────────────────────────────── */}
            {/* ⚠️ CONCENTRAÇÃO É A PERGUNTA QUE UMA LISTA NÃO RESPONDE.
                A lista diz o que a empresa tem. Não diz o que acontece se um
                cliente sair — e em contrato público o cliente sai por decisão
                administrativa, não por insatisfação. Duas carteiras de mesmo
                valor, uma num órgão só e outra em doze, são negócios
                diferentes; a tela mostrava as duas igual. */}
            {resumo.orgaos > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Saúde da carteira
                </span>
                <span className="text-[11px] font-bold text-slate-700">
                  <strong className="font-black text-slate-900">{resumo.orgaos}</strong>{' '}
                  {resumo.orgaos === 1 ? 'órgão' : 'órgãos'}
                  {resumo.ufs > 0 && <> · {resumo.ufs} {resumo.ufs === 1 ? 'UF' : 'UFs'}</>}
                </span>
                {resumo.concentracao != null && resumo.maior_orgao && (
                  <span className={`text-[11px] font-bold ${
                    resumo.concentracao >= 70 ? 'text-red-700'
                      : resumo.concentracao >= 40 ? 'text-amber-700' : 'text-slate-700'
                  }`}>
                    <strong className="font-black">{resumo.concentracao}%</strong> do valor vem de{' '}
                    <span className="font-black">{resumo.maior_orgao.nome}</span>
                    {resumo.orgaos === 1
                      ? ' — cliente único'
                      : resumo.concentracao >= 70 && ' — risco de concentração'}
                  </span>
                )}
                {resumo.com_aditivo > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700">
                    {resumo.com_aditivo === 1 ? 'Um contrato cresceu' : `${resumo.com_aditivo} contratos cresceram`}{' '}
                    <strong className="font-black">+{brl(resumo.valor_aditivo)}</strong> por aditivo
                  </span>
                )}
              </div>
            )}

            {/* ── Filtros por situação + busca ───────────────────────────── */}
            {resumo.total > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {/* ⚠️ MAPA, NÃO CADEIA DE TERNÁRIOS. A versão anterior era
                    `s === 'vigente' ? … : s === 'vencendo' ? … : …` com
                    `sem_prazo` no `else` final. Ao acrescentar `renovar`, o
                    novo chip cairia silenciosamente no `else` e exibiria a
                    contagem de "sem prazo" — número errado, sem erro nenhum.
                    Um mapa quebra explícito quando falta uma situação. */}
                {ORDEM.map((s) => {
                  const n = ({
                    vigente:   resumo.vigentes,
                    renovar:   resumo.renovar,
                    vencendo:  resumo.vencendo,
                    encerrado: resumo.encerrados,
                    sem_prazo: resumo.sem_prazo,
                  } as Record<Situacao, number>)[s];
                  if (!n) return null;
                  const ativo = filtro === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setFiltro(ativo ? null : s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors ${
                        ativo ? 'border-slate-900 bg-slate-900 text-white' : ESTILO[s].chip + ' hover:border-slate-400'
                      }`}
                    >
                      {ESTILO[s].rotulo}
                      <span className={ativo ? 'text-white/70' : 'opacity-60'}>{n}</span>
                    </button>
                  );
                })}
                <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[260px]">
                  <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar por objeto ou órgão"
                    aria-label="Filtrar contratos"
                    className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
                {/* ⚠️ EXPORTA O QUE ESTÁ NA TELA, NÃO A CARTEIRA INTEIRA.
                    Se a pessoa filtrou "vence em breve" e exportou, ela espera
                    esses contratos — não os 400 que acabou de esconder. O
                    rótulo diz a contagem justamente para isso não virar
                    surpresa dentro do Excel. */}
                <button
                  type="button"
                  onClick={exportar}
                  disabled={visiveis.length === 0}
                  title="Baixar em CSV (abre no Excel)"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Download size={12} />
                  Exportar {visiveis.length}
                </button>
              </div>
            )}

            {/* ── Lista ──────────────────────────────────────────────────── */}
            {/* ⚠️ PRIMEIRA CARGA NÃO É "VOCÊ NÃO TEM CONTRATOS".
                Enquanto a primeira sincronização roda, a lista está vazia
                porque o trabalho não terminou — não porque a empresa não tem
                nada. Mostrar o estado vazio normal aqui seria, mais uma vez,
                afirmar um fato sobre o negócio de alguém a partir de dado que
                ainda não existe. */}
            {resumo.total === 0 && sinc?.atualizando ? (
              <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-8 text-center">
                <Loader2 size={22} className="mx-auto mb-2 animate-spin text-emerald-600" />
                <p className="text-sm font-black text-emerald-900">
                  Montando a carteira de {empresa?.nome || 'sua empresa'}…
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-[12px] font-medium leading-relaxed text-emerald-800">
                  Estamos consultando o PNCP contrato a contrato para confirmar em quais
                  sua empresa aparece como fornecedora. Leva cerca de um minuto — a tela
                  se atualiza sozinha quando terminar.
                </p>
              </div>
            ) : resumo.total === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <CircleSlash size={22} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-black text-slate-700">
                  {semFornecedorNoIndice
                    ? 'Ainda não dá para responder isso'
                    : 'Nenhum contrato encontrado para este CNPJ'}
                </p>
                {/* ⚠️ NÃO OFERECER "SUA EMPRESA NÃO TEM CONTRATOS" COMO HIPÓTESE
                    QUANDO O ÍNDICE NÃO TEM COMO SABER. Esta tela mostrou zero
                    para a Stefanini — que tem contrato público às centenas — e
                    sugeriu que ou a base não cobria o período (cobria: mais de
                    um ano) ou a empresa não tinha contratos (tem). As duas
                    alternativas eram falsas, e a segunda é uma afirmação sobre
                    o negócio de quem lê. Quando o campo do fornecedor está
                    vazio na base, a resposta honesta é "eu não sei". */}
                <p className="mx-auto mt-1.5 max-w-md text-[12px] font-medium leading-relaxed text-slate-500">
                  {semFornecedorNoIndice ? (
                    <>
                      Os contratos estão no índice, mas sem o CNPJ do fornecedor não há
                      como dizer quais são os seus. Isto não significa que sua empresa
                      não tenha contratos — significa que a base ainda não sabe de quem
                      cada contrato é.
                    </>
                  ) : (
                    /* ⚠️ TRÊS HIPÓTESES, E A PRIMEIRA É A MAIS PROVÁVEL.
                       Com o índice restrito a contratos em execução, "zero"
                       quase nunca quer dizer "a empresa não tem contratos" —
                       quer dizer que nenhum contrato VIVO dela foi publicado
                       dentro da janela já varrida. Listar "a empresa não tem"
                       como única alternativa é o mesmo erro de antes, com
                       outra causa. */
                    <>
                      Ou os contratos da empresa foram publicados fora da janela já
                      varrida{cobertura?.de && <> (hoje ela vai de {dataBr(cobertura.de)} a {dataBr(cobertura.ate)}, por data de publicação)</>}
                      {cobertura?.politica === 'vigentes' && <>, ou todos já se encerraram — esta base só guarda o que está em execução</>},
                      ou a empresa ainda não tem contrato publicado no PNCP.
                    </>
                  )}
                </p>
              </div>
            ) : visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-400">
                Nenhum contrato com esse recorte.{' '}
                <button onClick={() => { setFiltro(null); setBusca(''); }}
                        className="font-black text-emerald-700 underline">limpar filtros</button>
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visiveis.map((c, i) => {
                  const dias = diasAte(c.data_vigencia_fim);
                  const est = ESTILO[c.situacao];
                  return (
                    <li key={c.numeroControlePNCP || `${c.objeto}-${i}`}
                        className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
                      <span className={`w-1 shrink-0 rounded-full ${est.barra}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${est.chip}`}>
                            {est.rotulo}
                          </span>
                          {c.situacao === 'vencendo' && dias !== null && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                              {dias <= 0 ? 'vence hoje' : `faltam ${dias} dia${dias === 1 ? '' : 's'}`}
                            </span>
                          )}
                          {c.uf && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                              <MapPin size={9} />{c.uf}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800">
                          {c.objeto || 'Objeto não informado'}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500">
                          {c.orgao_nome && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 size={10} className="shrink-0" />{c.orgao_nome}
                            </span>
                          )}
                          <span className="text-slate-300">·</span>
                          <span>vigência até {dataBr(c.data_vigencia_fim)}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black leading-none text-slate-900">
                          {c.valor > 0 ? brl(c.valor) : '—'}
                        </p>
                        {c.numeroControlePNCP && (
                          <a
                            href={`https://pncp.gov.br/app/contratos/${c.numeroControlePNCP}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            Ver no PNCP ↗
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* ── A arena: quem mais fornece para os seus órgãos ──────────── */}
            {/* ═══════════════════════════════════════════════════════════════
                ⚠️ SEM ISTO, "MEUS CONTRATOS" É UM ESPELHO.
                ═══════════════════════════════════════════════════════════════
                A lista acima devolve para a empresa exatamente o que ela já
                sabe que tem — e ninguém abre um espelho toda semana. O índice,
                porém, não guarda só os contratos dela: guarda os de todo mundo
                no mesmo órgão. "Quanto eu tenho no Ministério da Justiça" é
                contabilidade; "que fatia do Ministério da Justiça é minha" é
                estratégia, e sai do mesmo dado. */}
            {arena && arena.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={14} className="text-slate-400" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Quem mais fornece para os seus órgãos
                  </h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {arena.map((o) => (
                    <div key={o.orgao_cnpj} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="truncate text-[12px] font-black text-slate-800" title={o.orgao_nome}>
                        {o.orgao_nome || 'Órgão não identificado'}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {o.minha_fatia != null ? (
                          <>
                            Você tem <strong className={`font-black ${
                              o.minha_fatia >= 50 ? 'text-emerald-700' : 'text-slate-800'
                            }`}>{o.minha_fatia}%</strong> dos {brl(o.valor_orgao)} em execução
                          </>
                        ) : (
                          <>{brl(o.valor_orgao)} em execução no órgão</>
                        )}
                        {' · '}
                        {o.concorrentes === 0
                          ? 'nenhum outro fornecedor no índice'
                          : `${o.concorrentes} ${o.concorrentes === 1 ? 'concorrente' : 'concorrentes'}`}
                      </p>
                      {o.maiores.length > 0 && (
                        <ul className="mt-2.5 flex flex-col gap-1.5">
                          {o.maiores.map((m) => (
                            <li key={m.cnpj} className="flex items-baseline gap-2 text-[11px]">
                              <span className="min-w-0 flex-1 truncate font-bold text-slate-600" title={m.nome}>
                                {m.nome}
                              </span>
                              <span className="shrink-0 font-black text-slate-800">{brl(m.valor)}</span>
                              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                {m.contratos}x
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {/* ⚠️ O RECORTE DESTE PAINEL TAMBÉM PRECISA SER DITO. Ele só
                    enxerga contratos vigentes vindos do censo; os herdados do
                    `/api/search` não têm fornecedor e ficam de fora. Um número
                    de concorrente sem essa ressalva vira base de decisão. */}
                <p className="mt-2.5 text-[10px] font-medium leading-relaxed text-slate-400">
                  Considera apenas contratos em execução já varridos. Concorrente que só
                  aparece fora dessa janela não entra na conta.
                </p>
              </div>
            )}
            {arenaFalhou && (
              <p className="mt-6 border-t border-slate-100 pt-5 text-[11px] font-semibold text-slate-400">
                Não foi possível carregar o painel de concorrentes.{' '}
                <button onClick={carregarArena} className="font-black text-emerald-700 underline">
                  tentar de novo
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
