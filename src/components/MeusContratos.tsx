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
 * ⚠️ O AVISO DO TOPO MUDOU DE PREMISSA — E O TEXTO ANTIGO VIROU MENTIRA
 * ═══════════════════════════════════════════════════════════════════════════
 * Enquanto a carteira saía do índice nacional, a lista podia estar incompleta
 * por culpa da ingestão, e a faixa do topo existia para admitir isso: dizia
 * quantos dias tinham sido varridos, o que era amostra, quantos documentos
 * eram "cegos". Era honesto e era necessário.
 *
 * Deixou de ser as duas coisas quando a carteira passou a vir da BUSCA
 * DIRIGIDA (`worker_carteira_empresa`): uma consulta ao PNCP pelo CNPJ da
 * própria empresa, que devolve os contratos dela independentemente do que o
 * índice tenha ou deixe de ter. Hoje só existem dois estados — ou essa busca
 * rodou e a lista está completa, ou ela não rodou e é isso que precisa estar
 * escrito. "Dias varridos" não responde mais nenhuma pergunta de quem lê.
 *
 * ⚠️ E O VOCABULÁRIO ERA DE DENTRO DA CASA. "Varredura", "índice", "amostra",
 * "herdados da busca antiga", "não atribuíveis", "dias corridos": nada disso
 * é palavra de fornecedor abrindo a própria carteira. O aviso do topo agora
 * só carrega o que muda a decisão de quem está lendo — a busca falhou, a
 * busca nunca rodou, ou a lista mistura contrato vivo com histórico.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
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

/** Vagas de CNPJ do plano. Ver `_vagas_de_cnpj` no backend.
 *
 *  ⚠️ EXISTE PARA O ESTADO VAZIO NÃO MANDAR NINGUÉM NUMA PORTA TRANCADA.
 *  A dica "cadastre o outro CNPJ da sua empresa" resolveu o caso real da
 *  Stefanini — mas o plano Gratuito tem ZERO vagas e o Essencial tem UMA, já
 *  ocupada pela empresa que a pessoa está olhando. Para esses dois, a frase
 *  manda fazer algo que a rota recusa com 403. */
interface Vagas {
  tier: number;
  limite: number;
  em_uso: number;
  livres: number;
  proximo_tier: number | null;
  proximo_tier_nome: string | null;
  proximo_tier_limite: number | null;
}

/** Estabelecimento do mesmo grupo com contrato público e fora do workspace.
 *
 *  ⚠️ VEM DA NOSSA BASE, NÃO DE CADASTRO EXTERNO. Só existem aqui as filiais que
 *  TÊM contrato — filial que nunca licitou não interessa a esta tela. Por isso a
 *  lista é sempre subconjunto do grupo real: pode sugerir de menos, nunca
 *  inventar uma filial que não existe. */
interface Filial {
  cnpj: string;
  nome: string;
  contratos: number;
  valor: number;
  matriz: boolean;
}

/** Contrato de OUTRO fornecedor, vencendo, num órgão onde a empresa já está.
 *
 *  ⚠️ É O ÚNICO DADO DA TELA QUE FALA DO FUTURO. Contrato público que vence
 *  vira licitação nova — não é previsão, é como a lei funciona. Saber disso 180
 *  dias antes do edital é a única vantagem de TEMPO que este produto pode dar. */
interface Oportunidade {
  numeroControlePNCP: string | null;
  objeto: string;
  orgao_nome: string;
  uf: string;
  concorrente_cnpj: string;
  concorrente_nome: string;
  valor: number;
  data_vigencia_fim: string | null;
  dias: number | null;
  /** Já cresceu por aditivo: relação estabelecida, mais chance de o órgão
   *  prorrogar em vez de licitar. Cautela, não erro.
   *  `null` = valor inicial ou global desconhecido — não dá para dizer. */
  prorrogavel: boolean | null;
  /** O objeto se parece com o que a SUA empresa entrega?
   *  `null` = carteira pequena demais, ou objeto sem texto útil. Nesse caso a
   *  tela MOSTRA: em `aderencia.py`, não saber nunca vira esconder. */
  no_seu_ramo: boolean | null;
  aderencia: number | null;
  /** Palavras que casaram, da mais distintiva para a mais banal. Existem para
   *  a pessoa poder discordar de forma informada da classificação. */
  comuns: string[];
  /** Quantos existem no total, antes do corte do backend. Ver o comentário de
   *  `contratos_de_concorrentes_vencendo`: cortar em silêncio faria a tela
   *  parecer completa sem ser. */
  _total?: number;
  _truncado?: boolean;
  _fora_do_ramo?: number;
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

/** O que a base local tem, no agregado.
 *
 *  ⚠️ NÃO DESCREVE MAIS A LISTA DESTA TELA. A carteira vem da busca dirigida
 *  ao PNCP pelo CNPJ da empresa, não daqui — medir a base para falar sobre a
 *  lista era o erro que produzia a faixa de "varredura/amostra/dias corridos"
 *  no topo. O que sobra é o painel de concorrentes, que de fato só enxerga o
 *  que já foi ingerido: lá o recorte é real e precisa ser dito.
 *
 *  Os campos continuam vindo do backend inteiros (ver `cobertura_do_indice`);
 *  só o uso encolheu. */
interface Cobertura {
  de: string | null;
  ate: string | null;
  total: number;
  com_fornecedor: number | null;
  censo: number;
  censo_com_fornecedor: number | null;
  encerrados?: number;
  dias_com_dados?: number | null;
  /** `"vigentes"` = só carteira em execução · `"todos"` = inclui histórico ·
   *  `null` = base vazia. Vem da contagem de encerrados, não de uma constante
   *  do código. */
  politica?: string | null;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const dataBr = (iso?: string | null) =>
  iso && iso.length >= 10 ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

/** Quanto do contrato já correu, de 0 a 1. `null` quando não dá para saber.
 *
 *  ═══════════════════════════════════════════════════════════════════════════
 *  ⚠️ "VIGÊNCIA ATÉ 29/11/2026" NÃO RESPONDE A PERGUNTA QUE A PESSOA TEM
 *  ═══════════════════════════════════════════════════════════════════════════
 *  Uma data de fim sozinha não diz se o contrato é de um ano ou de cinco, nem
 *  quanto já passou. E é disso que depende a decisão: um contrato de 5 anos com
 *  4 meses restantes está no fim da vida e a renovação é uma conversa; um de 6
 *  meses com 4 meses restantes mal começou.
 *
 *  Os dois contratos "hora de renovar" da carteira real mostram isso —
 *  MJ vence em 29/11/2026 e TJMG em 18/12/2026, quase a mesma data. Sem saber
 *  quando começaram, parecem o mesmo caso. Não são.
 *
 *  ⚠️ DEVOLVE `null`, NÃO ZERO. Contrato sem data de início existe na base, e
 *  uma barra em 0% diria "acabou de começar" sobre algo que não se sabe. Zero é
 *  uma afirmação; `null` some da tela, que é o correto. */
function progressoVigencia(ini?: string | null, fim?: string | null): number | null {
  if (!ini || !fim || ini.length < 10 || fim.length < 10) return null;
  const t0 = Date.parse(`${ini.slice(0, 10)}T00:00:00Z`);
  const t1 = Date.parse(`${fim.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const agora = Date.now();
  return Math.max(0, Math.min(1, (agora - t0) / (t1 - t0)));
}

/** "3 anos e 2 meses", "8 meses", "24 dias" — a duração TOTAL do contrato. */
function duracao(ini?: string | null, fim?: string | null): string | null {
  if (!ini || !fim || ini.length < 10 || fim.length < 10) return null;
  const t0 = Date.parse(`${ini.slice(0, 10)}T00:00:00Z`);
  const t1 = Date.parse(`${fim.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  const dias = Math.round((t1 - t0) / 86_400_000);
  if (dias < 60) return `${dias} dias`;
  const meses = Math.round(dias / 30.44);
  if (meses < 24) return `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anos} anos e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : `${anos} anos`;
}

/** `58069360000120` → `58.069.360/0001-20`.
 *
 *  ⚠️ DEVOLVE `null`, NÃO O LIXO DE ENTRADA. Se o que chegou não tem 14
 *  dígitos, quem chama decide o que dizer — imprimir um CNPJ malformado no
 *  meio de "procuramos por X e não achamos nada" transforma um estado vazio
 *  legítimo em suspeita de bug. */
function cnpjBr(v?: string | null): string | null {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 14) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

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

/** Quanto o contrato cresceu desde a assinatura. `0` quando não cresceu.
 *
 *  ⚠️ ADITIVO É A INFORMAÇÃO MAIS ACIONÁVEL DA CARTEIRA, e estava só somada.
 *  A faixa "Saúde da carteira" dizia "Um contrato cresceu +R$ 3.222.662 por
 *  aditivo" — um número real, importante, e sem nenhum caminho até o contrato.
 *  Quem lê fica sabendo que existe e não consegue achar.
 *
 *  Importa porque contrato que cresceu é relação que se expandiu: o órgão
 *  confiou mais trabalho ao mesmo fornecedor. É o melhor candidato a nova
 *  expansão, e o pior de perder. Saber que "um" cresceu não permite agir; saber
 *  QUAL, sim. */
function ganhoPorAditivo(c: Contrato): number {
  const inicial = c.valor_inicial ?? 0;
  if (!inicial || !c.valor || c.valor <= inicial) return 0;
  return c.valor - inicial;
}

/** Um contrato, como linha da lista. Extraído para o agrupamento poder reusar
 *  exatamente a mesma linha ao expandir — se o grupo desenhasse a sua própria
 *  versão simplificada, expandir mostraria menos do que a lista normal e a
 *  pessoa perderia informação justamente ao pedir mais detalhe. */
function LinhaContrato({ c, compacta = false, onOrgao }: {
  c: Contrato; compacta?: boolean; onOrgao?: (nome: string) => void;
}) {
  const dias = diasAte(c.data_vigencia_fim);
  const est = ESTILO[c.situacao];
  const progresso = progressoVigencia(c.data_vigencia_ini, c.data_vigencia_fim);
  const dur = duracao(c.data_vigencia_ini, c.data_vigencia_fim);
  return (
    <li className={`flex gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-slate-300 ${
      compacta ? 'border-slate-100' : 'border-slate-200'
    }`}>
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
          {/* ⚠️ VERDE, NÃO ÂMBAR. Aditivo não é problema: é o órgão confiando
              mais trabalho ao mesmo fornecedor. Pintar de alerta ensinaria a
              pessoa a evitar o que ela deveria estar buscando repetir. */}
          {ganhoPorAditivo(c) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
              <TrendingUp size={9} />+{brl(ganhoPorAditivo(c))} por aditivo
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800">
          {c.objeto || 'Objeto não informado'}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500">
          {/* ⚠️ O NOME DO ÓRGÃO É A PORTA PARA A PERGUNTA SEGUINTE.
              Quem lê "MINISTERIO DA JUSTICA" numa linha quase sempre quer ver
              o que mais tem ali — e a única forma era digitar o nome na busca,
              sem errar acento. */}
          {c.orgao_nome && !compacta && (
            onOrgao ? (
              <button type="button" onClick={() => onOrgao(c.orgao_nome)}
                      title={`Ver só os contratos de ${c.orgao_nome}`}
                      className="inline-flex items-center gap-1 rounded hover:text-emerald-700 hover:underline">
                <Building2 size={10} className="shrink-0" />{c.orgao_nome}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Building2 size={10} className="shrink-0" />{c.orgao_nome}
              </span>
            )
          )}
          {c.orgao_nome && !compacta && <span className="text-slate-300">·</span>}
          <span>vigência até {dataBr(c.data_vigencia_fim)}</span>
          {/* A duração total é o que transforma a data numa informação: "até
              29/11/2026" é igual para um contrato de 6 meses e para um de 5
              anos. */}
          {dur && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{dur} de contrato</span>
            </>
          )}
        </p>
        {/* ⚠️ SÓ PARA CONTRATO VIVO. Numa linha de encerrado a barra estaria
            sempre em 100% — decoração que ocupa espaço e não informa. E só
            quando há data de início: barra em 0% por falta de dado afirmaria
            "acabou de começar" sobre algo que não se sabe. */}
        {c.situacao !== 'encerrado' && progresso !== null && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${est.barra}`}
                   style={{ width: `${Math.round(progresso * 100)}%` }} />
            </div>
            <span className="shrink-0 text-[10px] font-bold text-slate-400">
              {Math.round(progresso * 100)}% decorrido
            </span>
          </div>
        )}
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
}

/** Um grupo de contratos semelhantes, colapsado.
 *
 *  ⚠️ EXTRAÍDO PORQUE EU O DUPLIQUEI. Ao separar a lista em "vivos" e
 *  "encerrados" para encaixar o painel de disputas no meio, copiei estas ~90
 *  linhas para a segunda lista. Duas cópias do mesmo cartão significam que a
 *  próxima mudança precisa ser lembrada duas vezes — e é exatamente assim que
 *  uma das cópias deixa de ser corrigida. Um componente, dois usos. */
function LinhaGrupo({ chave, itens, aberto, onAlternar, onOrgao }: {
  chave: string;
  itens: Contrato[];
  aberto: boolean;
  onAlternar: (chave: string) => void;
  onOrgao?: (nome: string) => void;
}) {
  const total = itens.reduce((s, x) => s + (x.valor || 0), 0);
  const est = ESTILO[itens[0].situacao];
  const datas = itens.map((x) => x.data_vigencia_fim).filter(Boolean).sort() as string[];
  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* ⚠️ O CABEÇALHO DIZ QUANTOS E QUANTO. Colapsar 36 linhas sem mostrar a
          soma trocaria ruído por omissão: a pessoa deixaria de ver as linhas E
          não saberia o que elas valem juntas. */}
      <button
        type="button"
        onClick={() => onAlternar(chave)}
        aria-expanded={aberto}
        className="flex w-full gap-3 p-4 text-left transition-colors hover:bg-slate-50"
      >
        <span className={`w-1 shrink-0 rounded-full ${est.barra}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${est.chip}`}>
              {est.rotulo}
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
              {itens.length} contratos semelhantes
            </span>
            {itens[0].uf && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                <MapPin size={9} />{itens[0].uf}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800">
            {itens[0].objeto || 'Objeto não informado'}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-slate-500">
            {itens[0].orgao_nome && (
              <span className="inline-flex items-center gap-1">
                <Building2 size={10} className="shrink-0" />{itens[0].orgao_nome}
              </span>
            )}
            {datas.length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>
                  {datas[0] === datas[datas.length - 1]
                    ? <>vigência até {dataBr(datas[0])}</>
                    : <>vigências de {dataBr(datas[0])} a {dataBr(datas[datas.length - 1])}</>}
                </span>
              </>
            )}
            <span className="text-slate-300">·</span>
            <span className="font-black text-emerald-700">
              {aberto ? 'ocultar' : 'ver um a um'}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black leading-none text-slate-900">{brl(total)}</p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">somados</p>
        </div>
      </button>
      {aberto && (
        <ul className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 p-3">
          {itens.map((c, j) => (
            <LinhaContrato key={c.numeroControlePNCP || `g-${j}`} c={c} compacta onOrgao={onOrgao} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Texto reduzido ao que importa para comparar dois objetos.
 *
 *  ⚠️ SEM ACENTO, SEM PONTUAÇÃO, SEM ESPAÇO DUPLO — porque a diferença real
 *  entre as linhas repetidas da carteira era exatamente essa:
 *
 *     "INSTALAÇÃO DE EQUIPAMENTO - PRESTAÇÃO DE SERVIÇOS…"
 *     "INSTALAÇÃO DE EQUIPAMENTO -PRESTAÇÃO DE SERVIÇOS…"   ← um espaço a menos
 *
 *  Comparar as strings cruas trataria as duas como objetos diferentes e o
 *  agrupamento não agruparia nada. */
const enxuto = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** Chave de agrupamento: mesmo órgão + mesma situação + mesmo objeto.
 *
 *  ⚠️ PREFIXO DE 60 CARACTERES, NÃO O OBJETO INTEIRO. A carteira real tem
 *  "…SUBSTITUIÇÃO DE DESKTOPS" e "…SUBSTITUIÇÃO DE DESKTOP", singular e plural
 *  na última palavra. O prefixo ignora a divergência de cauda sem precisar de
 *  heurística de plural, que erraria em português mais vezes do que acertaria.
 *
 *  ⚠️ A SITUAÇÃO ENTRA NA CHAVE. Sem ela um grupo misturaria contrato vivo com
 *  encerrado e esconderia o vivo atrás de um rótulo de arquivo morto — que é o
 *  oposto do que este agrupamento existe para fazer. */
const chaveGrupo = (c: Contrato) =>
  `${enxuto(c.orgao_nome)}|${c.situacao}|${enxuto(c.objeto).slice(0, 60)}`;

/** Quantas linhas iguais justificam colapsar. Abaixo disso, agrupar esconde
 *  mais do que organiza. */
const MIN_PARA_AGRUPAR = 3;

type Linha =
  | { tipo: 'un'; c: Contrato }
  | { tipo: 'grupo'; chave: string; itens: Contrato[] };

/** Colapsa repetições preservando a ORDEM já decidida pelo backend.
 *
 *  ⚠️ ISTO É APRESENTAÇÃO, E SÓ. Os cartões de resumo, os chips de contagem e a
 *  exportação continuam contando contrato por contrato. Um agrupamento que
 *  mexesse na soma transformaria uma melhoria de leitura numa alteração de
 *  número financeiro — e a pessoa não teria como saber que os R$ que ela vê
 *  dependem de quantas linhas o front resolveu juntar. */
function agrupar(contratos: Contrato[]): Linha[] {
  const contagem = new Map<string, number>();
  for (const c of contratos) {
    const k = chaveGrupo(c);
    contagem.set(k, (contagem.get(k) || 0) + 1);
  }
  const saida: Linha[] = [];
  const jaEmitido = new Set<string>();
  for (const c of contratos) {
    const k = chaveGrupo(c);
    if ((contagem.get(k) || 0) < MIN_PARA_AGRUPAR) {
      saida.push({ tipo: 'un', c });
      continue;
    }
    if (jaEmitido.has(k)) continue;   // o grupo já saiu na posição do primeiro
    jaEmitido.add(k);
    saida.push({ tipo: 'grupo', chave: k, itens: contratos.filter((x) => chaveGrupo(x) === k) });
  }
  return saida;
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
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  // ⚠️ FILTRO NO CLIENTE, NÃO NO SERVIDOR. O backend já devolve até 80 e a
  // agregação é a consulta mais cara da tela — refazer a ida ao cluster a cada
  // clique de chip trocaria uma resposta instantânea por meio segundo de espera
  // para filtrar dado que já está na memória do navegador.
  const [prazoMax, setPrazoMax] = useState<number | null>(null);
  const [ocultarProrrogaveis, setOcultarProrrogaveis] = useState(false);
  // ⚠️ COMEÇA ESCONDIDO, MAS NUNCA APAGADO. O padrão é mostrar só o que a
  // empresa pode disputar; o contador ao lado diz quanto ficou de fora e um
  // clique traz tudo de volta. Esconder sem contar seria trocar um painel
  // ruidoso por um painel que mente por omissão.
  const [verForaDoRamo, setVerForaDoRamo] = useState(false);
  const [orgaoDisputa, setOrgaoDisputa] = useState<string | null>(null);
  const [sinc, setSinc] = useState<Sincronizacao | null>(null);
  const [vagas, setVagas] = useState<Vagas | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set());
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [incluindo, setIncluindo] = useState<string | null>(null);
  // ⚠️ FILTRO SEPARADO DE `filtro`. "Cresceu por aditivo" é uma dimensão
  // diferente de situação — um contrato pode ser vigente E ter aditivo. Enfiar
  // os dois no mesmo estado obrigaria a escolher entre ver "os que crescem" e
  // "os que vencem", quando a interseção é justamente a lista mais interessante.
  const [soAditivo, setSoAditivo] = useState(false);
  // ⚠️ MESMO MOTIVO DO `soAditivo`: órgão é outra dimensão. "O que vence NO
  // Ministério da Justiça" é a pergunta que decide uma renovação, e ela precisa
  // dos dois filtros ao mesmo tempo.
  const [filtroOrgao, setFiltroOrgao] = useState<string | null>(null);

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
      setVagas(json.vagas || null);
      setFiliais(json.filiais || []);
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
      setOportunidades(json.oportunidades || []);
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
  // ⚠️ O POLLING PRECISA TER FIM, E NÃO TINHA.
  // Era `setInterval(…, 8000)` enquanto `atualizando` fosse verdadeiro — sem
  // teto. Como `atualizando` só volta a falso quando a busca dá CERTO, uma
  // busca que falha deixava a tela perguntando de 8 em 8 segundos para sempre,
  // exibindo "Buscando no PNCP… leva cerca de um minuto" indefinidamente.
  //
  // E cada pergunta reagendava a busca no backend, que refazia ~55 requisições
  // ao PNCP e falhava de novo. A tela não estava só esperando: estava CAUSANDO
  // a falha que a mantinha esperando.
  //
  // O freio principal é do lado do servidor (`ESPERA_APOS_FALHA_MIN`). Este
  // aqui é o segundo: a tela desiste sozinha depois de 4 minutos — a busca leva
  // ~70s, então 4 min já é sinal de que não vai terminar — e para de imediato
  // se o backend reportar erro.
  const [tentativas, setTentativas] = useState(0);
  useEffect(() => {
    if (!sinc?.atualizando) { setTentativas(0); return; }
    if (sinc?.erro) return;                    // já falhou: não insiste
    if (tentativas >= 30) return;              // 30 × 8s = 4 minutos
    const t = setTimeout(() => {
      setTentativas((n) => n + 1);
      carregar();
      carregarArena();
    }, 8000);
    return () => clearTimeout(t);
  }, [sinc?.atualizando, sinc?.erro, tentativas, carregar, carregarArena]);

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


  const incluirFilial = useCallback(async (cnpj: string) => {
    setIncluindo(cnpj);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const res = await apiFetch(`${API_URL}/api/pncp/meus-contratos/incluir-filial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // ⚠️ SOME DA LISTA NA HORA, sem esperar o recarregamento. O backend leva
      // ~70s montando a carteira dela; deixar o cartão no lugar durante esse
      // tempo faria a pessoa clicar de novo achando que não funcionou.
      setFiliais((fs) => fs.filter((f) => f.cnpj !== cnpj));
      carregar();
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      setErro('Não foi possível incluir este estabelecimento agora.');
    } finally {
      setIncluindo(null);
    }
  }, [carregar]);

  // ── Filtros do painel de disputas ────────────────────────────────────────
  // ⚠️ OS CONTADORES SAEM DO CONJUNTO COMPLETO, NÃO DO FILTRADO. Um chip que
  // mostrasse a contagem já filtrada iria a zero assim que fosse clicado — e a
  // pessoa perderia a referência de quanto existe fora do recorte atual.
  const disputasVisiveis = oportunidades.filter((o) => {
    // ⚠️ SÓ ESCONDE O `false` EXPLÍCITO — `null` PASSA.
    // `null` significa "não deu para classificar" (carteira curta, objeto sem
    // texto). Tratar isso como "fora do ramo" esconderia um contrato de R$ 16
    // milhões por causa de um campo vazio, que é o mesmo erro que `prorrogavel`
    // cometia do outro lado: falta de evidência lida como evidência.
    if (!verForaDoRamo && o.no_seu_ramo === false) return false;
    if (prazoMax !== null && (o.dias === null || o.dias > prazoMax)) return false;
    if (ocultarProrrogaveis && o.prorrogavel === true) return false;
    if (orgaoDisputa && o.orgao_nome !== orgaoDisputa) return false;
    // ⚠️ O PAINEL SEGUE O RECORTE DA LISTA. Se a pessoa filtrou a carteira por
    // "Ministério da Justiça", mostrar disputas dos outros três órgãos ao lado
    // é responder uma pergunta que ela não fez — e faz o painel parecer
    // desconectado do resto da tela.
    if (filtroOrgao && o.orgao_nome !== filtroOrgao) return false;
    return true;
  });
  const orgaosDisputa = Array.from(
    oportunidades.reduce((m, o) => m.set(o.orgao_nome, (m.get(o.orgao_nome) || 0) + 1),
                         new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
  // ⚠️ O "EM JOGO" SOMA SÓ O QUE ESTÁ NA TELA. Somar o que foi escondido faria
  // R$ 31,9 mi aparecer sobre uma lista de R$ 6,8 mi — e o número grande é
  // justamente o que decide se a pessoa vai olhar o painel.
  const valorEmDisputa = disputasVisiveis.reduce((s, o) => s + (o.valor || 0), 0);
  const foraDoRamo = oportunidades[0]?._fora_do_ramo
    ?? oportunidades.filter((o) => o.no_seu_ramo === false).length;

  const alternarGrupo = (chave: string) => setGruposAbertos((sa) => {
    const n = new Set(sa);
    if (n.has(chave)) { n.delete(chave); } else { n.add(chave); }
    return n;
  });

  const termo = busca.trim().toLowerCase();
  const visiveis = contratos.filter((c) => {
    if (filtro && c.situacao !== filtro) return false;
    if (soAditivo && ganhoPorAditivo(c) <= 0) return false;
    if (filtroOrgao && c.orgao_nome !== filtroOrgao) return false;
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

  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ O QUE ESTA TELA TEM O DIREITO DE AFIRMAR
  // ═════════════════════════════════════════════════════════════════════════
  // Aqui existiam sete medidas derivadas da cobertura do índice — dias
  // varridos, buracos, percentual de fornecedor identificado, documentos
  // "cegos" — e todas alimentavam uma faixa que explicava ao usuário o estado
  // interno da ingestão. Elas serviam quando a lista SAÍA do índice.
  //
  // A lista não sai mais do índice: sai da busca dirigida ao PNCP pelo CNPJ da
  // empresa. Se ela rodou, a carteira está completa mesmo que o índice esteja
  // vazio; se não rodou, nenhuma cobertura do mundo salva a tela. Todo aquele
  // cálculo respondia uma pergunta que deixou de existir — e o texto que ele
  // produzia estava, na prática, contando ao fornecedor sobre a saúde do nosso
  // banco de dados em vez de sobre os contratos dele.
  //
  // Restam três fatos, e os três são sobre a busca dele, não sobre a base:
  const buscaFalhou = !!sinc?.erro && !sinc?.atualizando;
  const nuncaBuscou = !!sinc?.nunca && !sinc?.atualizando && !buscaFalhou;
  // Muda o que a lista É: carteira de hoje ou carteira + histórico. Sai do
  // resumo DELE (contratos que a busca trouxe), não da contagem da base —
  // `cobertura.encerrados` falava dos 35 mil encerrados de todo mundo, número
  // que não tem nada a ver com a pessoa que está lendo.
  const encerrados = resumo?.encerrados ?? 0;

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
                  ? (tentativas >= 30
                      ? 'está demorando mais que o normal — recarregue a página'
                      : 'leva cerca de um minuto')
                  : sinc.nunca
                    ? 'nunca sincronizado'
                    : `sincronizado ${haQuanto(sinc.atualizado_em)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── O estado da busca, em português ───────────────────────────────── */}
      {/* ⚠️ AQUI SÓ ENTRA O QUE MUDA A DECISÃO DE QUEM LÊ.
          A faixa anterior tinha até seis frases empilhadas e nenhuma delas era
          acionável: quantos dias foram varridos, o que era amostra, quantos
          contratos "herdados da busca antiga" não eram atribuíveis a ninguém.
          Um fornecedor abrindo a própria carteira não tem o que fazer com
          nada disso — e o texto ainda ocupava o lugar mais nobre da tela,
          acima dos números, empurrando a informação real para baixo da dobra.

          Sobrou o que ele decide em cima: a busca falhou (tento de novo?), a
          busca nunca rodou (mando rodar?), a lista mistura vivo com encerrado
          (filtro?). Três estados, mutuamente exclusivos, na ordem em que
          importam. */}
      {buscaFalhou ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 md:px-6">
          <AlertTriangle size={14} className="shrink-0 text-amber-700" />
          <p className="min-w-0 flex-1 text-[11px] font-semibold leading-relaxed text-amber-900">
            A última busca no PNCP não chegou ao fim.{' '}
            {sinc?.atualizado_em
              ? <>O que está abaixo é o resultado da busca anterior, de {haQuanto(sinc.atualizado_em)}.</>
              : <>Ainda não temos um resultado completo para esta empresa.</>}
          </p>
          <button type="button" onClick={sincronizar}
                  className="shrink-0 text-[11px] font-black text-amber-800 underline hover:text-amber-900">
            tentar de novo
          </button>
        </div>
      ) : nuncaBuscou ? (
        /* ⚠️ ESTE ESTADO EXISTE PARA A TELA NÃO DIZER "VOCÊ NÃO TEM CONTRATOS"
           ANTES DE TER OLHADO. Era o papel do alarme vermelho de cobertura, e
           continua sendo necessário — só que a pergunta certa não é "o índice
           sabe quem é o fornecedor?", é "nós já procuramos por este CNPJ?". */
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 md:px-6">
          <AlertTriangle size={14} className="shrink-0 text-amber-700" />
          <p className="min-w-0 flex-1 text-[11px] font-semibold leading-relaxed text-amber-900">
            Ainda não buscamos os contratos de{' '}
            <strong className="font-black">{empresa?.nome || 'sua empresa'}</strong> no PNCP —
            então esta tela ainda não tem como dizer o que ela tem.
          </p>
          <button type="button" onClick={sincronizar}
                  className="shrink-0 text-[11px] font-black text-amber-800 underline hover:text-amber-900">
            buscar agora
          </button>
        </div>
      ) : encerrados > 0 ? (
        /* O único recorte que sobrou e que o usuário precisa saber: a lista
           não é só a carteira de hoje. Sem esta frase, quem conta as linhas
           conclui coisa errada sobre o próprio negócio. */
        <div className="flex flex-wrap items-start gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 md:px-6">
          <CalendarClock size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-[11px] font-semibold leading-relaxed text-slate-600">
            A lista traz a carteira de hoje <em>e</em> o histórico:{' '}
            <strong className="font-black">{encerrados.toLocaleString('pt-BR')}</strong>{' '}
            {encerrados === 1 ? 'contrato já encerrado' : 'contratos já encerrados'}.
            Os valores acima somam <strong className="font-black">só o que está em
            execução</strong> — use os filtros abaixo para ver um ou outro.
          </p>
        </div>
      ) : null}

      <div className="p-5 md:p-6">

        {carregando && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
            {/* ⚠️ "CONSULTANDO O ÍNDICE" ERA NOME DE COMPONENTE INTERNO NA
                CARA DO CLIENTE. Ele não sabe o que é um índice, não pediu um,
                e o que está esperando são os contratos dele. */}
            <Loader2 size={16} className="animate-spin" /> Carregando seus contratos…
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
            {/* ── Outros estabelecimentos da mesma empresa ────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════
                ⚠️ O SISTEMA DESCOBRE, A PESSOA DECIDE.
                ═══════════════════════════════════════════════════════════════
                Ninguém sabe de cor quais das próprias filiais têm contrato
                público — é justamente o trabalho que o produto deveria fazer.
                Mas incluir sozinho também não serve: cada CNPJ acrescenta ~75s
                ao sincronismo noturno, e a carteira é da pessoa, não nossa.

                Então o card mostra o que achou, com quantos contratos e quanto
                valem, e a inclusão é um clique explícito. Não consome vaga do
                plano — é a mesma empresa, e a contagem passou a ser por raiz
                de CNPJ. */}
            {filiais.length > 0 && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="mb-2 flex items-start gap-2">
                  <Building2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-emerald-900">
                      {filiais.length === 1
                        ? 'Encontramos outro estabelecimento desta empresa com contrato público'
                        : `Encontramos ${filiais.length} estabelecimentos desta empresa com contrato público`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-emerald-800">
                      Mesmo CNPJ raiz, unidade diferente. Incluir não consome vaga do
                      seu plano — a carteira deles entra na sua.
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {filiais.map((f) => (
                    <li key={f.cnpj}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-emerald-100 bg-white px-3 py-2.5">
                      <span className="text-[11px] font-black text-slate-800">
                        {cnpjBr(f.cnpj) || f.cnpj}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                        {f.matriz ? 'matriz' : 'filial'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-600"
                            title={f.nome}>
                        {f.nome || 'Razão social não informada'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {f.contratos} {f.contratos === 1 ? 'contrato' : 'contratos'}
                        {f.valor > 0 && <> · {brl(f.valor)}</>}
                      </span>
                      <button
                        type="button"
                        onClick={() => incluirFilial(f.cnpj)}
                        disabled={incluindo === f.cnpj}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {incluindo === f.cnpj ? 'incluindo…' : 'incluir'}
                      </button>
                    </li>
                  ))}
                </ul>
                {/* ⚠️ O LIMITE DA DESCOBERTA, DITO EM VOZ NORMAL. A lista sai
                    dos contratos que já temos: uma filial cujo contrato esteja
                    fora do que foi ingerido não aparece aqui. Prometer "todos
                    os estabelecimentos" seria a promessa que a base não
                    sustenta — o erro que esta tela já cometeu antes. */}
                <p className="mt-2 text-[10px] font-medium text-emerald-700/80">
                  Encontrados entre os contratos que já temos. Pode haver outras
                  unidades que ainda não apareceram.
                </p>
              </div>
            )}

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
                {/* ⚠️ O OUTRO NÚMERO QUE NÃO LEVAVA A LUGAR NENHUM.
                    "45% do valor vem do MINISTERIO DA JUSTICA" é a informação
                    de risco mais importante desta faixa — e não havia como ver
                    QUAIS contratos formam esses 45%. Diagnóstico sem acesso ao
                    caso é a mesma falha do aditivo, no cartão ao lado. */}
                {resumo.concentracao != null && resumo.maior_orgao && (
                  <button
                    type="button"
                    onClick={() => setFiltroOrgao((v) =>
                      v === resumo.maior_orgao!.nome ? null : resumo.maior_orgao!.nome)}
                    aria-pressed={filtroOrgao === resumo.maior_orgao.nome}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] font-bold transition-colors ${
                      filtroOrgao === resumo.maior_orgao.nome
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : `border-transparent hover:border-slate-300 hover:bg-white ${
                            resumo.concentracao >= 70 ? 'text-red-700'
                              : resumo.concentracao >= 40 ? 'text-amber-700' : 'text-slate-700'}`
                    }`}
                  >
                    <strong className="font-black">{resumo.concentracao}%</strong> do valor vem de{' '}
                    <span className="font-black">{resumo.maior_orgao.nome}</span>
                    {resumo.orgaos === 1
                      ? ' — cliente único'
                      : resumo.concentracao >= 70 && ' — risco de concentração'}
                    <span className={filtroOrgao === resumo.maior_orgao.nome
                      ? 'text-white/70' : 'opacity-60'}>
                      {filtroOrgao === resumo.maior_orgao.nome ? '· mostrando só eles' : '· ver quais'}
                    </span>
                  </button>
                )}
                {/* ⚠️ ERA TEXTO MORTO. Dizia "Um contrato cresceu +R$ 3.222.662
                    por aditivo" e não havia caminho até esse contrato: a pessoa
                    ficava sabendo que existe e não conseguia achar numa lista de
                    53 linhas. Um número que informa e não deixa agir é o pior
                    tipo — ocupa a atenção e devolve frustração.
                    Agora é botão: filtra a lista para exatamente esses. */}
                {resumo.com_aditivo > 0 && (
                  <button
                    type="button"
                    onClick={() => setSoAditivo((v) => !v)}
                    aria-pressed={soAditivo}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                      soAditivo
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-transparent text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <TrendingUp size={11} />
                    {resumo.com_aditivo === 1 ? 'Um contrato cresceu' : `${resumo.com_aditivo} contratos cresceram`}{' '}
                    <strong className="font-black">+{brl(resumo.valor_aditivo)}</strong> por aditivo
                    <span className={soAditivo ? 'text-white/70' : 'text-emerald-600/60'}>
                      {soAditivo ? '· mostrando só eles' : '· ver quais'}
                    </span>
                  </button>
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
                {/* ⚠️ FILTRO ACIONADO LÁ EMBAIXO PRECISA APARECER AQUI EM CIMA.
                    Clicar no nome do órgão na linha 40 encurta a lista — e sem
                    um indicador visível a pessoa rola de volta ao topo, vê
                    poucos contratos e conclui que sumiu dado. O chip com o × é
                    o que impede "a tela perdeu meus contratos". */}
                {filtroOrgao && (
                  <button
                    type="button"
                    onClick={() => setFiltroOrgao(null)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white"
                    title="Remover o filtro de órgão"
                  >
                    <Building2 size={11} className="shrink-0" />
                    <span className="truncate">{filtroOrgao}</span>
                    <span className="shrink-0 text-white/70">×</span>
                  </button>
                )}
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
                  {nuncaBuscou || buscaFalhou
                    ? 'Ainda não dá para responder isso'
                    : 'Nenhum contrato encontrado para este CNPJ'}
                </p>
                {/* ⚠️ NÃO OFERECER "SUA EMPRESA NÃO TEM CONTRATOS" COMO
                    HIPÓTESE ANTES DE TER PROCURADO. Esta tela mostrou zero
                    para a Stefanini — que tem contrato público às centenas — e
                    sugeriu que ou a base não cobria o período (cobria) ou a
                    empresa não tinha contratos (tem). A segunda é uma
                    afirmação sobre o negócio de quem lê, e estava errada.
                    Quando a busca ainda não rodou, a resposta honesta é "eu
                    ainda não sei", e é isso que fica escrito. */}
                <p className="mx-auto mt-1.5 max-w-md text-[12px] font-medium leading-relaxed text-slate-500">
                  {nuncaBuscou || buscaFalhou ? (
                    <>
                      A busca no PNCP por este CNPJ ainda não foi concluída — esta lista
                      vazia não diz nada sobre a sua empresa. Use o botão{' '}
                      <strong className="font-black">Atualizar</strong>, aqui em cima,
                      para buscar agora.
                    </>
                  ) : (
                    /* ⚠️ A HIPÓTESE QUE FALTAVA, E QUE JÁ ACONTECEU NA PRÁTICA.
                       A Stefanini opera com mais de um CNPJ; a busca por um
                       deles devolve a carteira daquele, e só. "A empresa não
                       tem contratos" é conclusão errada quando o contrato está
                       no CNPJ da outra filial.

                       ⚠️ MAS A DICA SÓ VALE PARA QUEM TEM VAGA. Gratuito tem
                       zero, Essencial tem uma — e a única vaga do Essencial já
                       é a empresa que ele está olhando. Mandar esses dois
                       cadastrarem outro CNPJ é mandá-los tomar um 403. */
                    <>
                      Procuramos no PNCP por{' '}
                      <strong className="font-black">{cnpjBr(empresa?.cnpj) || 'este CNPJ'}</strong>{' '}
                      e nenhum contrato aparece com ele como fornecedor.{' '}
                      {(vagas?.livres ?? 0) > 0 ? (
                        <>
                          Se a sua empresa também contrata por outro CNPJ — matriz, filial
                          ou outra razão social —, cadastre-o em{' '}
                          <a href="/profile" className="font-black text-emerald-700 underline">
                            Minha empresa
                          </a>
                          : cada CNPJ tem a sua própria carteira no PNCP.
                        </>
                      ) : vagas?.proximo_tier_nome ? (
                        <>
                          Empresas que contratam por mais de um CNPJ — matriz e filial —
                          têm uma carteira para cada um. Seu plano cobre{' '}
                          <strong className="font-black">
                            {vagas.limite} {vagas.limite === 1 ? 'CNPJ' : 'CNPJs'}
                          </strong>
                          ; o <strong className="font-black">{vagas.proximo_tier_nome}</strong>{' '}
                          cobre {vagas.proximo_tier_limite}.{' '}
                          <a href="/plans" className="font-black text-emerald-700 underline">
                            ver planos
                          </a>
                        </>
                      ) : (
                        <>
                          Se a empresa contrata por outro CNPJ, a carteira dele é separada —
                          troque de empresa no seletor acima para consultá-la.
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            ) : visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-400">
                Nenhum contrato com esse recorte.{' '}
                <button onClick={() => { setFiltro(null); setBusca(''); setSoAditivo(false); setFiltroOrgao(null); }}
                        className="font-black text-emerald-700 underline">limpar filtros</button>
              </p>
            ) : (
              <>
                {/* ⚠️ O QUE VAI ABRIR ENTRA ANTES DO QUE JÁ ACABOU.
                    O painel de disputas ficava depois da lista inteira — ou
                    seja, depois de 48 contratos encerrados. A informação com
                    maior valor de decisão da tela estava atrás do arquivo
                    morto, e só chegava nela quem rolasse até o fim.
                    A ordem de leitura agora é: o que está vivo, o que vem aí,
                    e por último o histórico. */}
                <ul className="flex flex-col gap-2.5">
                {agrupar(visiveis).filter((l) => (l.tipo === 'un' ? l.c.situacao : l.itens[0].situacao) !== 'encerrado').map((linha, i) => {
                  if (linha.tipo === 'un') {
                    return <LinhaContrato key={linha.c.numeroControlePNCP || `u-${i}`} c={linha.c}
                                          onOrgao={setFiltroOrgao} />;
                  }
                  return (
                    <LinhaGrupo key={linha.chave} chave={linha.chave} itens={linha.itens}
                                aberto={gruposAbertos.has(linha.chave)}
                                onAlternar={alternarGrupo} onOrgao={setFiltroOrgao} />
                  );
                })}
                </ul>

            {/* ── Disputas que vão abrir ──────────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════
                ⚠️ O ÚNICO BLOCO DESTA TELA QUE DÁ VANTAGEM DE TEMPO.
                ═══════════════════════════════════════════════════════════════
                Todo o resto responde sobre o presente. O alerta por palavra-
                chave avisa quando o edital JÁ saiu — e nesse instante todo
                mundo soube junto, o prazo já corre, e não sobra tempo de
                preparar nada.

                Contrato público que vence vira licitação nova: não é previsão,
                é o funcionamento da lei. Um contrato de concorrente terminando
                em 180 dias é uma disputa que VAI existir, com data aproximada,
                meses antes de qualquer publicação. E só listamos órgãos onde a
                empresa já fornece — onde ela tem cadastro, histórico e alguém
                que atende o telefone. */}
            {/* ⚠️ NÃO APARECE QUANDO O RECORTE É HISTÓRICO.
                Filtrando por "Encerrado", a lista de vivos fica vazia e o
                painel subia para o topo — a pessoa pediu o que já acabou e
                recebia, em primeiro lugar, um bloco sobre o que vai começar.
                O painel existe na FRONTEIRA entre presente e passado; sem
                presente na tela, não há fronteira onde ele faça sentido. */}
            {oportunidades.length > 0 && filtro !== 'encerrado' && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="mb-1 flex items-center gap-2">
                  <CalendarClock size={14} className="text-amber-600" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Disputas que vão abrir nos seus órgãos
                  </h3>
                </div>
                <p className="mb-3 text-[11px] font-medium text-slate-500">
                  Contratos de <strong className="font-black">outros fornecedores</strong> terminando
                  em até 180 dias, onde você já é fornecedor. Quando vencem, a compra
                  costuma voltar ao mercado.
                  {filtroOrgao && (
                    <> Filtrado por <strong className="font-black">{filtroOrgao}</strong>,
                    acompanhando a lista acima.</>
                  )}
                </p>

                {/* ── Filtro rápido ────────────────────────────────────────
                    ⚠️ EMPRESA GRANDE ESTÁ EM DEZENAS DE ÓRGÃOS, e cada um tem
                    seus fornecedores vencendo. Sem recorte, a lista vira um
                    muro de cartões onde as duas disputas que valem a pena ficam
                    perdidas entre quarenta que não valem. */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                    prazo
                  </span>
                  {[30, 60, 90, null].map((p) => {
                    const ativo = prazoMax === p;
                    const n = p === null
                      ? oportunidades.length
                      : oportunidades.filter((o) => o.dias !== null && o.dias <= p).length;
                    return (
                      <button key={String(p)} type="button"
                        onClick={() => setPrazoMax(ativo ? null : p)}
                        aria-pressed={ativo}
                        disabled={n === 0}
                        className={`rounded-lg border px-2 py-1 text-[10px] font-black transition-colors disabled:opacity-30 ${
                          ativo ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                        }`}>
                        {p === null ? 'todos' : `≤ ${p} dias`}
                        <span className={ativo ? 'ml-1 text-white/70' : 'ml-1 opacity-50'}>{n}</span>
                      </button>
                    );
                  })}

                  {/* ⚠️ "PROVÁVEL" FALA DO ÓRGÃO, NÃO DE VOCÊ. Contrato que já
                      cresceu por aditivo tende a ser prorrogado em vez de
                      licitado. Diz que a disputa provavelmente vai existir —
                      não que você leva vantagem nela. Quem responde isso é o
                      botão de ramo, ao lado. */}
                  <button type="button"
                    onClick={() => setOcultarProrrogaveis((v) => !v)}
                    aria-pressed={ocultarProrrogaveis}
                    title="Esconde contratos que já cresceram por aditivo — o órgão tende a prorrogar em vez de licitar"
                    className={`rounded-lg border px-2 py-1 text-[10px] font-black transition-colors ${
                      ocultarProrrogaveis ? 'border-slate-900 bg-slate-900 text-white'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                    }`}>
                    só disputas prováveis
                  </button>

                  {/* ⚠️ O CONTADOR É OBRIGATÓRIO AQUI. Escondendo por padrão, é
                      este número que impede o painel de mentir por omissão —
                      sem ele, "8 disputas" pareceria tudo o que existe. */}
                  {foraDoRamo > 0 && (
                    <button type="button"
                      onClick={() => setVerForaDoRamo((v) => !v)}
                      aria-pressed={verForaDoRamo}
                      title="Comparação entre o objeto do contrato e o que a sua empresa já entregou. É uma estimativa por texto — confira antes de descartar."
                      className={`rounded-lg border px-2 py-1 text-[10px] font-black transition-colors ${
                        verForaDoRamo ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}>
                      {verForaDoRamo ? 'ocultar fora do seu ramo' : `+${foraDoRamo} fora do seu ramo`}
                    </button>
                  )}

                  {orgaosDisputa.length > 1 && !filtroOrgao && (
                    <select
                      value={orgaoDisputa ?? ''}
                      onChange={(e) => setOrgaoDisputa(e.target.value || null)}
                      aria-label="Filtrar por órgão"
                      className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 outline-none focus:border-slate-400"
                    >
                      <option value="">todos os órgãos ({orgaosDisputa.length})</option>
                      {orgaosDisputa.map(([nome, n]) => (
                        <option key={nome} value={nome}>{nome.slice(0, 44)} ({n})</option>
                      ))}
                    </select>
                  )}

                  <span className="ml-auto text-[10px] font-bold text-slate-500">
                    {disputasVisiveis.length === oportunidades.length
                      ? `${oportunidades.length} disputas`
                      : `${disputasVisiveis.length} de ${oportunidades.length}`}
                    {valorEmDisputa > 0 && (
                      <> · <strong className="font-black text-slate-700">{brl(valorEmDisputa)}</strong> em jogo</>
                    )}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {disputasVisiveis.map((o, i) => (
                    <li key={o.numeroControlePNCP || `op-${i}`}
                        className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                      <span className="w-1 shrink-0 rounded-full bg-amber-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          {o.dias !== null && (
                            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              o.dias <= 60
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}>
                              vence em {o.dias} dias
                            </span>
                          )}
                          {o.uf && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                              <MapPin size={9} />{o.uf}
                            </span>
                          )}
                          {/* ⚠️ A RESSALVA FICA NO CARTÃO, NÃO NO RODAPÉ.
                              Vencimento não obriga licitação: o órgão pode
                              prorrogar. Contrato que já cresceu por aditivo tem
                              relação estabelecida e chance maior de renovar sem
                              disputa. Dizer isso só no rodapé faria a pessoa
                              preparar proposta para uma disputa que não vem. */}
                          {o.prorrogavel === true && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500"
                                  title="Já cresceu por aditivo — o órgão pode prorrogar em vez de licitar">
                              pode ser prorrogado
                            </span>
                          )}
                          {/* ⚠️ ANTES ISTO ERA INVISÍVEL E CONTAVA COMO "PROVÁVEL".
                              Sem valor inicial no PNCP, a conta de aditivo dava
                              falso e o contrato passava por disputa provável sem
                              nenhum sinal. Agora quem não se sabe, se diz. */}
                          {o.prorrogavel === null && (
                            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400"
                                  title="O PNCP não informou o valor inicial deste contrato — não dá para saber se ele já cresceu por aditivo">
                              sem valor inicial
                            </span>
                          )}
                          {o.no_seu_ramo === false && (
                            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400"
                                  title="O objeto não se parece com o que a sua empresa já entregou. É uma estimativa por texto — confira antes de descartar.">
                              fora do seu ramo
                            </span>
                          )}
                          {o.no_seu_ramo === true && o.comuns.length > 0 && (
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700"
                                  title={`Casou com a sua carteira em: ${o.comuns.join(', ')}`}>
                              do seu ramo
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800">
                          {o.objeto || 'Objeto não informado'}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500">
                          <button type="button" onClick={() => setFiltroOrgao(o.orgao_nome)}
                                  title={`Ver seus contratos em ${o.orgao_nome}`}
                                  className="inline-flex items-center gap-1 hover:text-emerald-700 hover:underline">
                            <Building2 size={10} className="shrink-0" />{o.orgao_nome}
                          </button>
                          <span className="text-slate-300">·</span>
                          <span>hoje com{' '}
                            <strong className="font-black text-slate-700">
                              {o.concorrente_nome || cnpjBr(o.concorrente_cnpj) || 'fornecedor não identificado'}
                            </strong>
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black leading-none text-slate-900">{brl(o.valor)}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                          até {dataBr(o.data_vigencia_fim)}
                        </p>
                        {o.numeroControlePNCP && (
                          <a href={`https://pncp.gov.br/app/contratos/${o.numeroControlePNCP}`}
                             target="_blank" rel="noopener noreferrer"
                             className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:underline">
                            Ver no PNCP ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {disputasVisiveis.length === 0 && (
                  <p className="py-6 text-center text-[12px] font-semibold text-slate-400">
                    Nenhuma disputa com esse recorte.{' '}
                    <button type="button"
                      onClick={() => { setPrazoMax(null); setOcultarProrrogaveis(false); setOrgaoDisputa(null); }}
                      className="font-black text-emerald-700 underline">
                      limpar
                    </button>
                  </p>
                )}
                {/* ⚠️ O CORTE DO BACKEND, DITO EM VOZ ALTA. O serviço devolve no
                    máximo 80. Sem esta linha, uma empresa com 200 disputas veria
                    80 e concluiria que era tudo — o mesmo defeito da
                    "varredura completa" que esta tela já teve. */}
                {oportunidades[0]?._truncado && (
                  <p className="mt-2 text-[10px] font-bold text-amber-700">
                    Mostrando as {oportunidades.length} de maior valor, de{' '}
                    {oportunidades[0]._total} encontradas. Use os filtros acima para
                    recortar.
                  </p>
                )}
                <p className="mt-2.5 text-[10px] font-medium leading-relaxed text-slate-400">
                  Vencimento não garante nova licitação — o órgão pode prorrogar. Sai
                  dos contratos que já temos destes órgãos, então pode haver mais.
                </p>
              </div>
            )}

                {/* Histórico por último: não pede ação, serve de referência. */}
                {agrupar(visiveis).some((l) => (l.tipo === 'un' ? l.c.situacao : l.itens[0].situacao) === 'encerrado') && (
                  <ul className="mt-2.5 flex flex-col gap-2.5">
                    {agrupar(visiveis).filter((l) => (l.tipo === 'un' ? l.c.situacao : l.itens[0].situacao) === 'encerrado').map((linha, i) => {
                      if (linha.tipo === 'un') {
                        return <LinhaContrato key={linha.c.numeroControlePNCP || `e-${i}`} c={linha.c}
                                              onOrgao={setFiltroOrgao} />;
                      }
                      return (
                        <LinhaGrupo key={linha.chave} chave={linha.chave} itens={linha.itens}
                                    aberto={gruposAbertos.has(linha.chave)}
                                    onAlternar={alternarGrupo} onOrgao={setFiltroOrgao} />
                      );
                    })}
                  </ul>
                )}
              </>
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
                          ? 'nenhum outro fornecedor encontrado'
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
                {/* ⚠️ ESTE É O ÚNICO LUGAR DA TELA ONDE A COBERTURA AINDA É
                    VERDADE. A lista de cima vem da busca dirigida pelo CNPJ da
                    empresa e é completa; ESTE painel fala dos concorrentes,
                    que ninguém foi buscar um a um — ele só enxerga o que já
                    entrou na base. Uma fatia de mercado sem essa ressalva vira
                    base de decisão sobre um denominador incompleto.
                    Dito com data, não com "varredura": um intervalo de datas é
                    linguagem de gente, e é exatamente a informação que limita
                    a comparação. */}
                <p className="mt-2.5 text-[10px] font-medium leading-relaxed text-slate-400">
                  Compara apenas os contratos em execução que já temos destes órgãos
                  {cobertura?.de && cobertura?.ate && (
                    <> (publicados entre {dataBr(cobertura.de)} e {dataBr(cobertura.ate)})</>
                  )}
                  . Um concorrente que só apareça fora disso não entra na conta.
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
