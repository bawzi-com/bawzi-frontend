'use client';

import { useState, useEffect } from 'react';
import {
  Building2, DollarSign, Sparkles, ExternalLink, ChevronDown, ChevronUp,
  AlertTriangle, TrendingUp, Zap, Shield, Clock, CheckCircle2, XCircle,
  Minus, Star, BarChart3, FileCheck, AlertCircle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LinhaCredito {
  nome: string;
  instituicao: string;
  tipo: string;
  descricao: string;
  taxa_estimada: string;
  prazo_maximo: string;
  valor_maximo_estimado: string;
  requisitos: string[];
  link: string;
  adequacao: 'ALTA' | 'MEDIA' | 'BAIXA';
  motivo_adequacao: string;
}

interface RecomendacaoCapital {
  razao_social: string;
  porte_estimado: string;
  capital_social: number;
  valor_edital: number;
  valor_necessario_estimado: number;
  percentual_do_contrato: number;
  linhas_credito: LinhaCredito[];
  recomendacao_geral: string;
  alerta: string;
}

interface InstituicaoPreQualificacao {
  nome: string;
  produto: string;
  taxa_estimada: string;
  prazo_maximo: string;
  valor_pre_aprovado: number;
  status: 'PRE_QUALIFICADO' | 'ANALISE_NECESSARIA' | 'NAO_ELEGIVEL';
  probabilidade_aprovacao: number;
  requisitos_atendidos: string[];
  requisitos_pendentes: string[];
  diferenciais: string[];
  link_aplicacao: string;
  motivo: string;
}

interface AnaliseInstituicoesResponse {
  cnpj: string;
  razao_social: string;
  porte: string;
  idade_empresa_meses: number;
  capital_social: number;
  valor_solicitado: number;
  score_geral: number;
  situacao_cadastral: string;
  opcao_simples: boolean;
  instituicoes: InstituicaoPreQualificacao[];
  resumo_consultor: string;
}

interface Empresa {
  cnpj: string;
  razao_social?: string;
  nome?: string;
  uf?: string;
}

interface Props {
  token: string;
  defaultCnpj?: string;
  defaultUf?: string;
  companies?: Empresa[];
  tier?: number;
  /** Valor pré-preenchido vindo de uma análise (ex: resultado.estimated_value parseado) */
  defaultValorEdital?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type int = number;

const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  publica:      { label: 'Linha Pública',         color: 'bg-blue-50 text-blue-700 border-blue-200' },
  capital_giro: { label: 'Capital de Giro',        color: 'bg-violet-50 text-violet-700 border-violet-200' },
  antecipacao:  { label: 'Antecipação',            color: 'bg-amber-50 text-amber-700 border-amber-200' },
  fintech:      { label: 'Fintech / Privado',      color: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const ADEQUACAO_CONFIG = {
  ALTA:  { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Alta adequação' },
  MEDIA: { icon: Minus,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     label: 'Adequação média' },
  BAIXA: { icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-50 border-red-200',         label: 'Baixa adequação' },
};

const STATUS_CONFIG = {
  PRE_QUALIFICADO:   {
    label: 'Pré-qualificado',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    barClass: 'bg-emerald-500',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    cardBorder: 'border-emerald-200 shadow-emerald-50',
  },
  ANALISE_NECESSARIA: {
    label: 'Análise Necessária',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    barClass: 'bg-amber-400',
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    cardBorder: 'border-amber-200 shadow-amber-50',
  },
  NAO_ELEGIVEL: {
    label: 'Não elegível agora',
    badgeClass: 'bg-red-100 text-red-600 border-red-200',
    barClass: 'bg-red-400',
    icon: XCircle,
    iconClass: 'text-red-400',
    cardBorder: 'border-slate-200',
  },
};

const BANCO_LOGO: Record<string, { emoji: string; bg: string }> = {
  'BTG Pactual Empresas': { emoji: '🏦', bg: 'from-blue-600 to-blue-800' },
  'Capital Empreendedor': { emoji: '🚀', bg: 'from-emerald-500 to-teal-700' },
  'Banco Inter Empresas': { emoji: '🟠', bg: 'from-orange-400 to-orange-600' },
  'Celcoin Empresas':     { emoji: '⚡', bg: 'from-violet-600 to-purple-700' },
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// ─── Card de linha de crédito IA ──────────────────────────────────────────────

function CardLinha({ linha, index }: { linha: LinhaCredito; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const adequacao = ADEQUACAO_CONFIG[linha.adequacao] || ADEQUACAO_CONFIG.MEDIA;
  const tipo = TIPO_LABEL[linha.tipo] || { label: linha.tipo, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  const AdequacaoIcon = adequacao.icon;

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${linha.adequacao === 'ALTA' ? 'border-emerald-200 shadow-sm shadow-emerald-50' : 'border-slate-200'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-3 p-5 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
            ${linha.adequacao === 'ALTA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-black text-slate-900 text-[15px]">{linha.nome}</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tipo.color}`}>
                {tipo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{linha.instituicao}</p>
            <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${adequacao.bg} ${adequacao.color}`}>
              <AdequacaoIcon size={11} />
              {adequacao.label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Taxa</p>
            <p className="text-xs font-bold text-slate-700">{linha.taxa_estimada}</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{linha.descricao}</p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: DollarSign, label: 'Taxa', value: linha.taxa_estimada },
              { icon: Clock,      label: 'Prazo', value: linha.prazo_maximo },
              { icon: TrendingUp, label: 'Valor máx.', value: linha.valor_maximo_estimado },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <Icon size={14} className="text-slate-400 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-xs font-black text-slate-800 mt-0.5 leading-tight">{value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl p-3 border ${adequacao.bg}`}>
            <p className={`text-[11px] font-black uppercase tracking-wide mb-1 ${adequacao.color}`}>Por que esta linha?</p>
            <p className={`text-xs leading-relaxed ${adequacao.color}`}>{linha.motivo_adequacao}</p>
          </div>

          {linha.requisitos.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">Requisitos principais</p>
              <ul className="space-y-1">
                {linha.requisitos.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={linha.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors"
          >
            Saiba mais e solicite <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Card de banco parceiro ───────────────────────────────────────────────────

function CardBanco({ inst, isRealApi = false, isLoading = false }: {
  inst: InstituicaoPreQualificacao;
  isRealApi?: boolean;
  isLoading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.ANALISE_NECESSARIA;
  const StatusIcon = cfg.icon;
  const logo = BANCO_LOGO[inst.nome] || { emoji: '🏛', bg: 'from-slate-500 to-slate-700' };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${logo.bg} flex items-center justify-center text-xl flex-shrink-0`}>
            {logo.emoji}
          </div>
          <div className="flex-1 min-w-0 space-y-2 pt-0.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping inline-block" />
                Consultando API...
              </span>
            </div>
            <div className="h-3 w-48 bg-slate-100 rounded animate-pulse" />
            <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden bg-white ${cfg.cardBorder}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-3 p-5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Logo */}
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${logo.bg} flex items-center justify-center text-xl flex-shrink-0`}>
            {logo.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="font-black text-slate-900 text-[15px]">{inst.nome}</h3>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                <StatusIcon size={10} />
                {cfg.label}
              </span>
              {isRealApi && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
                  API AO VIVO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">{inst.produto}</p>

            {/* Probabilidade */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cfg.barClass}`}
                  style={{ width: `${inst.probabilidade_aprovacao}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-slate-600 whitespace-nowrap">
                {inst.probabilidade_aprovacao}% aprovação
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {inst.valor_pre_aprovado > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-medium">Pré-aprovado</p>
              <p className="text-sm font-black text-slate-800">{fmt(inst.valor_pre_aprovado)}</p>
            </div>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Expandido */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* Motivo */}
          <p className="text-sm text-slate-600 leading-relaxed">{inst.motivo}</p>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: DollarSign, label: 'Taxa', value: inst.taxa_estimada },
              { icon: Clock,      label: 'Prazo', value: inst.prazo_maximo },
              { icon: BarChart3,  label: 'Pré-aprovado', value: inst.valor_pre_aprovado > 0 ? fmt(inst.valor_pre_aprovado) : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <Icon size={14} className="text-slate-400 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-xs font-black text-slate-800 mt-0.5 leading-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* Requisitos atendidos */}
          {inst.requisitos_atendidos.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <CheckCircle2 size={12} /> Requisitos atendidos
              </p>
              <ul className="space-y-1">
                {inst.requisitos_atendidos.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Requisitos pendentes */}
          {inst.requisitos_pendentes.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Pendências / melhorias
              </p>
              <ul className="space-y-1">
                {inst.requisitos_pendentes.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diferenciais */}
          {inst.diferenciais.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Star size={11} /> Diferenciais desta instituição
              </p>
              <ul className="space-y-1">
                {inst.diferenciais.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <a
            href={inst.link_aplicacao}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 bg-gradient-to-r ${logo.bg}`}
          >
            <FileCheck size={13} />
            Iniciar solicitação em {inst.nome} <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    score >= 45 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                  'text-red-500 bg-red-50 border-red-200';

  const label =
    score >= 70 ? 'Perfil forte' :
    score >= 45 ? 'Perfil moderado' :
                  'Perfil fraco';

  return (
    <div className={`inline-flex flex-col items-center px-4 py-2 rounded-2xl border font-black ${color}`}>
      <span className="text-2xl leading-none">{score}</span>
      <span className="text-[10px] uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

// ─── Converter resposta real da Celcoin → InstituicaoPreQualificacao ──────────

function _celcoinApiToInstituicao(data: {
  aprovado: boolean;
  status: string;
  valor_aprovado?: number;
  parcela_estimada?: number;
  taxa_anual?: number;
  mensagem: string;
  proposta_id?: string;
  sandbox?: boolean;
}): InstituicaoPreQualificacao {
  const statusMap: Record<string, InstituicaoPreQualificacao['status']> = {
    APPROVED:                 'PRE_QUALIFICADO',
    PRE_APPROVED:             'PRE_QUALIFICADO',
    APPROVED_WITH_CONDITIONS: 'PRE_QUALIFICADO',
    PENDING:                  'ANALISE_NECESSARIA',
    PENDING_DOCS:             'ANALISE_NECESSARIA',
    UNDER_ANALYSIS:           'ANALISE_NECESSARIA',
    REJECTED:                 'NAO_ELEGIVEL',
    CANCELLED:                'NAO_ELEGIVEL',
    EXPIRED:                  'ANALISE_NECESSARIA',
  };
  const st = statusMap[data.status.toUpperCase()] ?? 'ANALISE_NECESSARIA';
  const prob = data.aprovado ? 85 : st === 'ANALISE_NECESSARIA' ? 50 : 10;
  const taxa = data.taxa_anual
    ? `${data.taxa_anual.toFixed(2)}% a.a.`
    : 'a partir de 1,29% a.m.';

  return {
    nome: 'Celcoin Empresas',
    produto: 'Crédito PJ via API — Capital de Giro / Consignado',
    taxa_estimada: taxa,
    prazo_maximo: 'até 48 meses',
    valor_pre_aprovado: data.valor_aprovado ?? 0,
    status: st,
    probabilidade_aprovacao: prob,
    requisitos_atendidos: data.aprovado
      ? ['CNPJ validado pela Celcoin ✓', 'Perfil de crédito aprovado na análise real ✓']
      : [],
    requisitos_pendentes: !data.aprovado
      ? [data.mensagem]
      : (data.sandbox ? ['⚠️ Resultado gerado em ambiente sandbox — não vinculante'] : []),
    diferenciais: [
      'Decisão em tempo real via API (crédito embedded)',
      'Infraestrutura financeira para 6.000+ clientes — R$ 30 bi/mês',
      'Integração nativa com Pix, Boleto e Open Finance',
      data.proposta_id ? `ID Proposta: ${data.proposta_id}` : 'Sandbox disponível para teste',
    ],
    link_aplicacao: 'https://www.celcoin.com.br/solucoes/corban-as-a-service/',
    motivo: data.mensagem,
  };
}


// ─── Componente principal ─────────────────────────────────────────────────────

export default function CapitalIntelligence({ token, defaultCnpj = '', defaultUf = '', companies = [], tier = 3, defaultValorEdital }: Props) {
  // Domínio .bawzi.com → apenas empresas cadastradas; outros → livre
  const isBawziDomain = typeof window !== 'undefined' && window.location.hostname.endsWith('.bawzi.com');

  const hasCompanies = companies.length > 0;

  // CNPJ inicial: primeira empresa cadastrada ou o defaultCnpj recebido
  const initialCnpj = hasCompanies ? companies[0].cnpj : defaultCnpj;

  const [cnpj, setCnpj]             = useState(initialCnpj);
  const [useCustomCnpj, setCustom]  = useState(false); // "Outro CNPJ" só em domínios internos

  // Inicialização direta com lazy initializer — garante que o campo está preenchido
  // no primeiro render, mesmo que `defaultValorEdital` chegue junto com a montagem.
  const [valorEdital, setValor] = useState<string>(() => {
    if (!defaultValorEdital || defaultValorEdital <= 0) return '';
    const num = String(Math.round(defaultValorEdital * 100)).replace(/\D/g, '');
    if (!num) return '';
    return (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  });

  const [objeto, setObjeto]         = useState('');
  const [loading, setLoading]             = useState(false);
  const [resultado, setResultado]         = useState<RecomendacaoCapital | null>(null);
  const [analise, setAnalise]             = useState<AnaliseInstituicoesResponse | null>(null);
  const [erro, setErro]                   = useState('');
  // Celcoin: resultado da consulta real à API (independente dos 3 simulados)
  const [celcoinRealData, setCelcoinReal] = useState<InstituicaoPreQualificacao | null>(null);
  const [celcoinLoading, setCelcoinLoad] = useState(false);

  // Formata CNPJ para exibição no select (XX.XXX.XXX/XXXX-XX)
  function exibirCnpj(raw: string) {
    const d = raw.replace(/\D/g, '');
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function formatCnpj(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function formatValor(v: string) {
    const num = v.replace(/\D/g, '');
    if (!num) return '';
    return (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseBrl(v: string): number {
    return Number(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  }

  async function buscar() {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const valor = parseBrl(valorEdital);

    if (cnpjLimpo.length !== 14) { setErro('Informe um CNPJ válido com 14 dígitos.'); return; }
    if (valor <= 0) { setErro('Informe o valor estimado do edital.'); return; }

    setErro('');
    setLoading(true);
    setResultado(null);
    setAnalise(null);
    setCelcoinReal(null);
    setCelcoinLoad(true);

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Lança a consulta real à Celcoin em paralelo, de forma independente.
    // Se falhar (sem credenciais, timeout), não bloqueia os outros resultados.
    fetch(`${API_URL}/api/celcoin/pre-qualificacao`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cnpj: cnpjLimpo, valor_solicitado: valor }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setCelcoinReal(_celcoinApiToInstituicao(data));
      })
      .catch(() => { /* silencioso — fallback mantém o card simulado */ })
      .finally(() => setCelcoinLoad(false));

    try {
      // Chama os dois endpoints em paralelo
      const [resRec, resQual] = await Promise.all([
        fetch(`${API_URL}/api/capital/recomendar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cnpj: cnpjLimpo, valor_edital: valor, objeto, uf: defaultUf }),
        }),
        fetch(`${API_URL}/api/capital/pre-qualificar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ cnpj: cnpjLimpo, valor_edital: valor }),
        }),
      ]);

      if (!resRec.ok) {
        const err = await resRec.json().catch(() => ({}));
        throw new Error(err.detail || `Erro ${resRec.status}`);
      }

      setResultado(await resRec.json());

      if (resQual.ok) {
        setAnalise(await resQual.json());
      }
      // pré-qualificação falhar não bloqueia o resultado principal
    } catch (e: any) {
      setErro(e.message || 'Erro ao buscar recomendações.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-100">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Fôlego financeiro da disputa</h1>
            <p className="text-xs text-slate-500">Estime capital necessário, risco de caixa e linhas possíveis antes de assumir o contrato</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4">
        <p className="text-sm font-bold text-slate-700">Informe os dados para medir capacidade de execução</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">CNPJ da Empresa</label>
              {/* Botão "Outro CNPJ" apenas em .bawzi.com */}
              {hasCompanies && isBawziDomain && (
                <button
                  type="button"
                  onClick={() => { setCustom(v => !v); if (useCustomCnpj) setCnpj(companies[0].cnpj); }}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
                >
                  {useCustomCnpj ? '← Usar empresa cadastrada' : 'Outro CNPJ...'}
                </button>
              )}
            </div>

            {/* SELECT — empresas cadastradas */}
            {hasCompanies && !useCustomCnpj ? (
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <select
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                  className="w-full pl-9 pr-8 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent appearance-none cursor-pointer text-slate-800 font-medium"
                >
                  {companies.map(c => (
                    <option key={c.cnpj} value={c.cnpj}>
                      {exibirCnpj(c.cnpj)}{c.razao_social ? ` — ${c.razao_social}` : c.nome ? ` — ${c.nome}` : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <ChevronDown size={14} className="text-slate-400" />
                </div>
              </div>
            ) : (
              /* INPUT livre — apenas em .bawzi.com ou quando não há empresas */
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={cnpj}
                  onChange={e => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
              </div>
            )}

            {/* Aviso quando não há empresas cadastradas */}
            {!hasCompanies && (
              <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                ⚠️ Nenhuma empresa cadastrada no perfil. <a href="/profile" className="underline font-bold">Adicionar empresa →</a>
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Valor Estimado do Edital</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
              <input
                type="text"
                value={valorEdital}
                onChange={e => setValor(formatValor(e.target.value))}
                placeholder="0,00"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">
            Objeto do Edital <span className="normal-case font-medium text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={objeto}
            onChange={e => setObjeto(e.target.value)}
            placeholder="Ex: Fornecimento de merenda escolar, Prestação de serviços de TI..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
          <p className="text-[11px] text-slate-400 mt-1">Quanto mais detalhado, mais precisa a recomendação</p>
        </div>

        {erro && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {erro}
          </div>
        )}

        <button
          onClick={buscar}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-md shadow-emerald-100 hover:shadow-lg hover:shadow-emerald-200 hover:scale-[1.01] transition-all duration-200 disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              A IA está analisando o perfil...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Analisar e Recomendar Crédito
            </>
          )}
        </button>
      </div>

      {/* ── Resultados ─────────────────────────────────────────────────────────── */}
      {resultado && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Sumário financeiro */}
          <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-black text-slate-900 text-base">{resultado.razao_social}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Porte: <span className="font-bold text-slate-700">{resultado.porte_estimado}</span>
                  {resultado.capital_social > 0 && (
                    <> · Capital Social: <span className="font-bold text-slate-700">{fmt(resultado.capital_social)}</span></>
                  )}
                </p>
              </div>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                Análise IA
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1">Valor do Contrato</p>
                <p className="text-lg font-black text-slate-900">{fmt(resultado.valor_edital)}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                <p className="text-[11px] text-emerald-600 font-medium uppercase tracking-wide mb-1">Capital Necessário est.</p>
                <p className="text-lg font-black text-emerald-700">{fmt(resultado.valor_necessario_estimado)}</p>
                <p className="text-[10px] text-emerald-500 mt-0.5">≈ {resultado.percentual_do_contrato}% do contrato</p>
              </div>
            </div>

            {/* Recomendação geral */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <Zap size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1">Estratégia Recomendada</p>
                  <p className="text-sm text-white/90 leading-relaxed">{resultado.recomendacao_geral}</p>
                </div>
              </div>
            </div>

            {resultado.alerta && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {resultado.alerta}
              </div>
            )}
          </div>

          {/* ── Bancos parceiros (pré-qualificação real) ────────────────────── */}
          {tier >= 4 ? (
            /* Tier 4+ — mostra pré-qualificação completa */
            analise && analise.instituicoes.length > 0 && (
              <div className="space-y-4">
                {/* Score + resumo */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-wide mb-1">Score de Crédito</p>
                      <ScoreBadge score={analise.score_geral} />
                    </div>
                    <div className="flex-1 text-right space-y-1">
                      <p className="text-xs text-slate-500">
                        Situação: <span className={`font-bold ${analise.situacao_cadastral === 'ATIVA' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {analise.situacao_cadastral}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Idade: <span className="font-bold text-slate-700">
                          {Math.floor(analise.idade_empresa_meses / 12)}a {analise.idade_empresa_meses % 12}m
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Porte: <span className="font-bold text-slate-700">{analise.porte}</span>
                      </p>
                      {analise.opcao_simples && (
                        <span className="inline-block text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                          Simples Nacional
                        </span>
                      )}
                    </div>
                  </div>

                  {analise.resumo_consultor && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Sparkles size={11} /> Parecer do consultor IA
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{analise.resumo_consultor}</p>
                    </div>
                  )}
                </div>

                {/* Cards de cada banco */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={15} className="text-slate-400" />
                    <p className="text-sm font-black text-slate-700">
                      Pré-qualificação em {analise.instituicoes.length} instituições parceiras
                    </p>
                  </div>
                  <div className="space-y-3">
                    {analise.instituicoes
                      .sort((a, b) => b.probabilidade_aprovacao - a.probabilidade_aprovacao)
                      .map((inst, i) => {
                        const isCelcoin = inst.nome === 'Celcoin Empresas';
                        // Celcoin: usa dado real se disponível, loading skeleton enquanto aguarda
                        if (isCelcoin) {
                          if (celcoinLoading) return <CardBanco key={i} inst={inst} isLoading={true} />;
                          if (celcoinRealData) return <CardBanco key={i} inst={celcoinRealData} isRealApi={true} />;
                        }
                        return <CardBanco key={i} inst={inst} />;
                      })}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Tier 3 — teaser: pré-qualificação disponível no Nível 4 */
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
              {/* Ícone de cadeado decorativo */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[13px] font-black text-slate-700">Pré-qualificação em 3 instituições parceiras</p>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                      Nível 4
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                    Score de crédito real · Parecer de consultor IA · Probabilidade de aprovação por banco — desbloqueado no plano <strong className="text-slate-700">Avançado</strong>.
                  </p>
                  {/* Blocos fantasma dos cards de banco */}
                  <div className="space-y-2 mb-4 opacity-30 pointer-events-none select-none">
                    {['BTG Pactual Empresas', 'Capital Empreendedor', 'Banco Inter PJ'].map((nome) => (
                      <div key={nome} className="h-14 bg-slate-200 rounded-xl flex items-center px-4 gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-300 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 bg-slate-300 rounded w-32" />
                          <div className="h-2 bg-slate-300 rounded w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('planos');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] shadow-sm"
                  >
                    Fazer Upgrade para Nível 4 ↗
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Linhas de crédito IA ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-slate-400" />
              <p className="text-sm font-black text-slate-700">
                {resultado.linhas_credito.length} linhas de crédito recomendadas pela IA
              </p>
            </div>
            <div className="space-y-3">
              {resultado.linhas_credito
                .sort((a, b) => {
                  const ord = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
                  return (ord[a.adequacao] ?? 1) - (ord[b.adequacao] ?? 1);
                })
                .map((linha, i) => (
                  <CardLinha key={i} linha={linha} index={i} />
                ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed pb-4">
            Análise gerada com base em dados públicos (BrasilAPI). Taxas e condições sujeitas a alteração pelas instituições. Consulte um especialista antes de contratar.
          </p>
        </div>
      )}
    </div>
  );
}
