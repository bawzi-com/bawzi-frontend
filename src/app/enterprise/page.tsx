// app/enterprise/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Lock, Zap, Shield, Code2, Key, ChevronRight,
  FileText, TrendingUp, Users, Globe, CheckCircle2, Terminal,
  Sparkles, ArrowRight, BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

// ─── Dados estáticos ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Análise Multi-LLM',
    desc: 'Envie qualquer edital e receba score Go/No-Go, riscos jurídicos e estratégia de precificação em segundos.',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Inteligência de Preços',
    desc: 'Acesse médias de mercado, deságio preditivo e shadow price calculados sobre a base do PNCP.',
    color: 'bg-sky-50 text-sky-600 border-sky-100',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Radar de Concorrentes',
    desc: 'Obtenha ranking de vencedores históricos por segmento, incluindo capital social e taxa de vitórias.',
    color: 'bg-violet-50 text-violet-600 border-violet-100',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Extração de Documentos',
    desc: 'Extraia texto completo de editais diretamente do PNCP por CNPJ/ano/sequencial sem scraping manual.',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: 'Feed PNCP em tempo real',
    desc: 'Busque editais abertos por termo, UF e município com deduplicação e filtragem semântica automática.',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Parecer Jurídico IA',
    desc: 'Gere minutas de impugnação e pareceres de conformidade com base na Lei 14.133/21 automaticamente.',
    color: 'bg-slate-50 text-slate-600 border-slate-200',
  },
];

const ENDPOINTS = [
  { method: 'POST', path: '/api/analyze', desc: 'Análise completa de edital (score, riscos, SWOT, deságio)' },
  { method: 'GET',  path: '/api/pncp/busca', desc: 'Busca de editais abertos no PNCP' },
  { method: 'GET',  path: '/api/pncp/media-precos', desc: 'Média de preços por segmento' },
  { method: 'GET',  path: '/api/competitor/ranking', desc: 'Top concorrentes por termo e UF' },
  { method: 'GET',  path: '/api/analyses/quota', desc: 'Consumo mensal e limite do plano' },
  { method: 'POST', path: '/api/auth/refresh', desc: 'Renovação de token de acesso' },
];

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-sky-100 text-sky-700',
  POST:   'bg-emerald-100 text-emerald-700',
  PUT:    'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

const CODE_EXAMPLE = `curl -X POST https://api.bawzi.com/api/analyze \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: multipart/form-data" \\
  -F "raw_text=PREGÃO ELETRÔNICO Nº 001/2025..." \\
  -F "tier=4"

# Resposta
{
  "analysis": {
    "score": 82,
    "semaforo": "GO",
    "summary": "Edital viável. Margem estimada de 18%...",
    "riscos_juridicos": [...],
    "pricing_intelligence": {
      "desagioPreditivoOrgao": 22.5,
      "nivelAmeaca": "MODERADO"
    }
  }
}`;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EnterpriseApiPage() {
  const [spec, setSpec]               = useState(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [showSwagger, setShowSwagger] = useState(false);

  useEffect(() => {
    const tier  = Number(localStorage.getItem('bawzi_tier') || '1');

    if (tier >= 4) {
      setIsAuthorized(true);
      apiFetch('/api/swagger')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => setSpec(data))
        .catch(err => {
          if (err instanceof SessionExpiredError) return;
          console.error('Erro ao carregar spec:', err);
        });
    } else {
      setIsAuthorized(false);
    }
  }, []);

  if (isAuthorized === null) return <div className="min-h-screen bg-slate-950" />;

  // ── Tela de upgrade (não-tier-4) ────────────────────────────────────────────
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <Link href="/workspace" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold mb-12 transition-colors">
            <ArrowLeft size={16} /> Voltar ao Workspace
          </Link>

          {/* Hero restrito */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-widest mb-6">
              <Lock size={12} /> Plano Avançado - Nível 4
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-4">
              Bawzi API <span className="text-violet-400">Enterprise</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Integre o motor Multi-LLM de análise de licitações diretamente no seu ERP, CRM ou plataforma de compras.
            </p>
            <div className="flex items-center justify-center gap-4 mt-8">
              <Link href="/plans" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-6 py-3 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
                <Sparkles size={16} /> Fazer upgrade para Avançado
              </Link>
              <a href="mailto:enterprise@bawzi.com" className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-bold text-sm transition-colors">
                Falar com vendas <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Features preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-black text-white mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Endpoints preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Code2 size={14} className="text-violet-400" /> Endpoints disponíveis
            </h2>
            <div className="space-y-2">
              {ENDPOINTS.map((e) => (
                <div key={e.path} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${METHOD_COLORS[e.method] || 'bg-slate-700 text-slate-300'}`}>
                    {e.method}
                  </span>
                  <code className="text-xs text-violet-300 font-mono">{e.path}</code>
                  <span className="text-xs text-slate-500 ml-auto hidden sm:block">{e.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-600">
            Documentação interativa completa (Swagger UI) disponível exclusivamente para clientes Avançado.
          </p>
        </div>
      </div>
    );
  }

  // ── Página completa para tier 4 ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <Link href="/workspace" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold mb-8 transition-colors">
            <ArrowLeft size={16} /> Voltar ao Workspace
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Enterprise — Nível 4
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
                Bawzi API <span className="text-violet-400">Enterprise</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
                Integre o motor Multi-LLM de análise de licitações directamente no seu software. REST API · JSON · Bearer Auth.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => { setShowSwagger(true); document.getElementById('swagger-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                <BookOpen size={15} /> Referência completa
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ── Autenticação ─────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Key size={15} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-black">Autenticação</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-black text-white mb-2">Bearer Token</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Todas as requisições devem incluir o header <code className="text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;token&gt;</code>. Obtenha o token via <code className="text-violet-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">POST /api/auth/login</code>.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Expiração', value: '30 minutos (access token)' },
                  { label: 'Renovação', value: 'POST /api/auth/refresh (cookie HttpOnly)' },
                  { label: 'Formato',   value: 'JWT RS256' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                    <span className="text-slate-500 font-bold">{label}</span>
                    <code className="text-slate-300">{value}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                <Terminal size={14} className="text-emerald-400" /> Exemplo rápido
              </h3>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
{`# 1. Login
curl -X POST https://api.bawzi.com/api/auth/login \\
  -d '{"email":"seu@email.com","password":"***"}'

# 2. Usar o token retornado
curl -H "Authorization: Bearer eyJ..." \\
  https://api.bawzi.com/api/analyses/quota`}
              </pre>
            </div>
          </div>
        </section>

        {/* ── Capacidades ──────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkles size={15} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-black">Capacidades</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-black text-white mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Exemplo de chamada ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Code2 size={15} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-black">Exemplo — Análise de Edital</h2>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800 bg-slate-950">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-amber-500/60" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="text-[10px] text-slate-500 font-mono ml-2">terminal</span>
            </div>
            <pre className="text-xs text-slate-300 font-mono leading-relaxed p-6 overflow-x-auto">
              {CODE_EXAMPLE}
            </pre>
          </div>
        </section>

        {/* ── Endpoints ────────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <FileText size={15} className="text-sky-400" />
              </div>
              <h2 className="text-xl font-black">Endpoints principais</h2>
            </div>
            <button
              onClick={() => { setShowSwagger(true); setTimeout(() => document.getElementById('swagger-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
              className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 transition-colors"
            >
              Ver todos <ChevronRight size={13} />
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/40 transition-colors">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 ${METHOD_COLORS[e.method] || ''}`}>
                  {e.method}
                </span>
                <code className="text-sm text-violet-300 font-mono">{e.path}</code>
                <span className="text-xs text-slate-500 ml-auto hidden sm:block">{e.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Limites do plano ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Shield size={15} className="text-rose-400" />
            </div>
            <h2 className="text-xl font-black">Limites & SLA</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Análises/mês', value: 'Ilimitado', color: 'text-emerald-400' },
              { label: 'Máx. chars/edital', value: '400 000', color: 'text-sky-400' },
              { label: 'Máx. arquivo', value: '100 MB', color: 'text-violet-400' },
              { label: 'Rate limit', value: '60 req/min', color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                <p className={`text-2xl font-black mb-1 ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Referência Swagger ────────────────────────────────────────────────── */}
        <section id="swagger-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <BookOpen size={15} className="text-violet-400" />
              </div>
              <h2 className="text-xl font-black">Referência completa</h2>
            </div>
            {!showSwagger && (
              <button
                onClick={() => setShowSwagger(true)}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Code2 size={14} /> Expandir Swagger UI
              </button>
            )}
          </div>

          {showSwagger ? (
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-800">
              {spec ? (
                <SwaggerUI spec={spec} />
              ) : (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => setShowSwagger(true)}
              className="border border-dashed border-slate-700 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
            >
              <Code2 size={32} className="text-slate-600 group-hover:text-violet-400 mx-auto mb-3 transition-colors" />
              <p className="text-slate-500 text-sm font-medium group-hover:text-slate-300 transition-colors">
                Clique para abrir a documentação interativa (Swagger UI)
              </p>
            </div>
          )}
        </section>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© Bawzi · API Enterprise · Nível 4</span>
          <div className="flex items-center gap-4">
            <a href="mailto:enterprise@bawzi.com" className="hover:text-slate-400 transition-colors">enterprise@bawzi.com</a>
            <Link href="/workspace" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <ArrowLeft size={11} /> Workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
