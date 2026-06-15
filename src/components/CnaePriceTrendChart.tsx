'use client';

/**
 * CnaePriceTrendChart.tsx
 * Gráfico de tendência de preço médio contratado por segmento CNAE.
 * Consome GET /api/pncp/preco-historico-cnae?cnae=...&uf=...&meses=12
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

// ─── tipos ────────────────────────────────────────────────────────────────────

interface PontoSerie {
  periodo: string;   // "2024-01"
  mediana: number;
  media: number;
  contratos: number;
}

interface RespostaAPI {
  cnae: string;
  termos_usados: string[];
  uf: string;
  meses: number;
  total_pontos: number;
  serie: PontoSerie[];
}

interface CnaePriceTrendChartProps {
  token: string | null;
  cnae: string;           // ex: "6201"
  uf?: string;            // ex: "SP" — omitir para nacional
  meses?: number;         // padrão 12
  labelSegmento?: string; // ex: "Desenvolvimento de Software"
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatarBRL(valor: number): string {
  if (valor >= 1_000_000)
    return `R$ ${(valor / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (valor >= 1_000)
    return `R$ ${(valor / 1_000).toFixed(0)}k`;
  return `R$ ${valor.toFixed(0)}`;
}

function formatarBRLCompleto(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarPeriodo(periodo: string): string {
  const [ano, mes] = periodo.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
}

function calcularTendencia(serie: PontoSerie[]): 'alta' | 'baixa' | 'estavel' {
  if (serie.length < 3) return 'estavel';
  const primeira = serie[0].mediana;
  const ultima = serie[serie.length - 1].mediana;
  const delta = (ultima - primeira) / primeira;
  if (delta > 0.05) return 'alta';
  if (delta < -0.05) return 'baixa';
  return 'estavel';
}

// ─── tooltip customizado ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as PontoSerie;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{formatarPeriodo(label)}</p>
      <p className="text-emerald-400">Mediana: {formatarBRLCompleto(d.mediana)}</p>
      <p className="text-sky-400">Média: {formatarBRLCompleto(d.media)}</p>
      <p className="text-gray-400">{d.contratos} contrato{d.contratos !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function CnaePriceTrendChart({
  token,
  cnae,
  uf,
  meses = 12,
  labelSegmento,
}: CnaePriceTrendChartProps) {
  const [dados, setDados] = useState<RespostaAPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [janelaAtiva, setJanelaAtiva] = useState<number>(meses);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const buscar = useCallback(async (janela: number) => {
    if (!token || !cnae) return;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ cnae, meses: String(janela) });
      if (uf) params.set('uf', uf);
      const res = await apiFetch(`${API_URL}/api/pncp/preco-historico-cnae?${params}`);
      if (!res.ok) {
        setErro('Não foi possível carregar os dados de tendência.');
        return;
      }
      const json: RespostaAPI = await res.json();
      setDados(json);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setErro('Erro de conexão ao buscar tendência de preços.');
    } finally {
      setLoading(false);
    }
  }, [token, cnae, uf, API_URL]);

  useEffect(() => {
    buscar(janelaAtiva);
  }, [buscar, janelaAtiva]);

  // ── estados vazios / erro ──────────────────────────────────────────────────

  if (!cnae) return null;

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-48 mb-3" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-gray-900/50 border border-red-900/40 rounded-xl p-4 flex items-center gap-3 text-sm text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {erro}
      </div>
    );
  }

  const serie = dados?.serie ?? [];
  const temDados = serie.length >= 2;

  if (!temDados && !loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 text-center text-sm text-gray-500">
        <TrendingUp className="w-6 h-6 mx-auto mb-2 opacity-30" />
        Dados históricos insuficientes para este CNAE
        {uf ? ` em ${uf}` : ''}.
        <br />
        <span className="text-xs">A base cresce à medida que contratos são ingeridos.</span>
      </div>
    );
  }

  // ── métricas de resumo ─────────────────────────────────────────────────────

  const tendencia = calcularTendencia(serie);
  const ultimoPonto = serie[serie.length - 1];
  const primeiroPonto = serie[0];
  const variacaoPct = primeiroPonto
    ? (((ultimoPonto?.mediana ?? 0) - primeiroPonto.mediana) / primeiroPonto.mediana) * 100
    : 0;
  const totalContratos = serie.reduce((acc, p) => acc + p.contratos, 0);
  const mediaGeral = serie.reduce((acc, p) => acc + p.mediana, 0) / serie.length;

  const TendenciaIcon =
    tendencia === 'alta' ? TrendingUp : tendencia === 'baixa' ? TrendingDown : Minus;
  const corTendencia =
    tendencia === 'alta' ? 'text-red-400' : tendencia === 'baixa' ? 'text-emerald-400' : 'text-gray-400';

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Tendência de Preço — {labelSegmento ?? `CNAE ${cnae}`}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {dados?.termos_usados?.join(', ')} · {uf ?? 'Brasil'} · {janelaAtiva} meses
          </p>
        </div>

        {/* seletor de janela */}
        <div className="flex items-center gap-1">
          {[6, 12, 24].map((j) => (
            <button
              key={j}
              onClick={() => setJanelaAtiva(j)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                janelaAtiva === j
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {j}m
            </button>
          ))}
          <button
            onClick={() => buscar(janelaAtiva)}
            className="ml-1 p-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Ticket mediano atual</p>
          <p className="text-base font-bold text-white">{formatarBRL(ultimoPonto?.mediana ?? 0)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Variação no período</p>
          <p className={`text-base font-bold flex items-center gap-1 ${corTendencia}`}>
            <TendenciaIcon className="w-4 h-4" />
            {variacaoPct >= 0 ? '+' : ''}{variacaoPct.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Contratos analisados</p>
          <p className="text-base font-bold text-white">{totalContratos.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* gráfico */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMediana" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMedia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="periodo"
              tickFormatter={formatarPeriodo}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatarBRL}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <Tooltip content={<TooltipCustom />} />
            {/* linha de referência = média geral do período */}
            <ReferenceLine
              y={mediaGeral}
              stroke="#374151"
              strokeDasharray="4 4"
              label={{ value: 'Média', fill: '#4b5563', fontSize: 9, position: 'insideTopRight' }}
            />
            <Area
              type="monotone"
              dataKey="media"
              stroke="#38bdf8"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="url(#gradMedia)"
              dot={false}
              name="Média"
            />
            <Area
              type="monotone"
              dataKey="mediana"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradMediana)"
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              name="Mediana"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-600">
        Fonte: PNCP · contratos com <code>data_assinatura</code> nos últimos {janelaAtiva} meses.
        Outliers extremos (5% sup/inf) removidos.
      </p>
    </div>
  );
}
