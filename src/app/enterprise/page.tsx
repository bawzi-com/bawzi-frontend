// app/enterprise/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Lock, Zap, Shield, Code2, Key, ChevronRight,
  FileText, TrendingUp, Users, Globe, CheckCircle2, Terminal,
  Sparkles, ArrowRight, BookOpen, Copy, Check, ChevronDown,
  BarChart3, Cpu, Layers, ExternalLink, Building2, Star,
  AlertCircle, Gauge, Webhook, Play,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

// ─── Dados ───────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Zap,        title: 'Análise Multi-LLM',        desc: 'Score GO/NO-GO, riscos jurídicos e estratégia de precificação em segundos.', color: 'emerald' },
  { icon: TrendingUp, title: 'Inteligência de Preços',    desc: 'Médias de mercado, deságio preditivo e shadow price sobre a base do PNCP.',  color: 'sky'     },
  { icon: Users,      title: 'Radar de Concorrentes',     desc: 'Ranking de vencedores históricos por segmento, capital social e taxa de vitórias.', color: 'violet' },
  { icon: FileText,   title: 'Extração de Documentos',    desc: 'Texto completo de editais via CNPJ/ano/sequencial sem scraping manual.',     color: 'amber'   },
  { icon: Globe,      title: 'Feed PNCP em Tempo Real',   desc: 'Editais abertos por termo, UF e município com deduplicação semântica.',       color: 'rose'    },
  { icon: Shield,     title: 'Parecer Jurídico IA',       desc: 'Minutas de impugnação e pareceres de conformidade com base na Lei 14.133/21.', color: 'slate'  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-400',     glow: 'shadow-sky-500/10'     },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400',  glow: 'shadow-violet-500/10'  },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   glow: 'shadow-amber-500/10'   },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    glow: 'shadow-rose-500/10'    },
  slate:   { bg: 'bg-slate-700/50',   border: 'border-slate-600/50',   text: 'text-slate-400',   glow: 'shadow-slate-500/10'   },
};

const ENDPOINTS = [
  { method: 'POST', path: '/api/analyze',           desc: 'Análise completa de edital',         tag: 'Análise' },
  { method: 'GET',  path: '/api/pncp/busca',         desc: 'Busca de editais abertos no PNCP',   tag: 'PNCP'    },
  { method: 'GET',  path: '/api/pncp/media-precos',  desc: 'Média de preços por segmento',       tag: 'Preços'  },
  { method: 'GET',  path: '/api/competitor/ranking', desc: 'Top concorrentes por termo e UF',    tag: 'Radar'   },
  { method: 'GET',  path: '/api/analyses/quota',     desc: 'Consumo mensal e limite do plano',   tag: 'Conta'   },
  { method: 'POST', path: '/api/auth/refresh',        desc: 'Renovação de token de acesso',       tag: 'Auth'    },
];

const METHOD_STYLE: Record<string, string> = {
  GET:    'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
  POST:   'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  PUT:    'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
};

const CODE_TABS = [
  {
    lang: 'cURL',
    code: `curl -X POST https://api.bawzi.com/api/analyze \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "raw_text": "PREGÃO ELETRÔNICO Nº 001/2025...",
    "tier": 4
  }'`,
  },
  {
    lang: 'Python',
    code: `import requests

resp = requests.post(
    "https://api.bawzi.com/api/analyze",
    headers={"Authorization": f"Bearer {token}"},
    json={"raw_text": edital_text, "tier": 4},
)
data = resp.json()
print(data["analysis"]["score"])   # 82
print(data["analysis"]["semaforo"]) # "GO"`,
  },
  {
    lang: 'JavaScript',
    code: `const res = await fetch("https://api.bawzi.com/api/analyze", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ raw_text: editalText, tier: 4 }),
});
const { analysis } = await res.json();
console.log(analysis.score);    // 82
console.log(analysis.semaforo); // "GO"`,
  },
];

const RESPONSE_EXAMPLE = `{
  "analysis": {
    "score": 82,
    "semaforo": "GO",
    "summary": "Edital viável. Margem estimada 18%.",
    "riscos_juridicos": [
      { "nivel": "MEDIO", "descricao": "Prazo de execução agressivo" }
    ],
    "pricing_intelligence": {
      "desagioPreditivoOrgao": 22.5,
      "nivelAmeaca": "MODERADO",
      "shadowPrice": 487500.00
    },
    "match_cnae": { "score": 91, "cnae_principal": "62.01-5-01" }
  }
}`;

const STATS = [
  { value: '400K+',  label: 'editais indexados' },
  { value: '< 8s',   label: 'por análise' },
  { value: '99.7%',  label: 'uptime SLA' },
  { value: '14.133', label: 'Lei base' },
];

const FAQ = [
  {
    q: 'Como obtenho minha API key?',
    a: 'Após o upgrade para o plano Avançado, acesse Perfil → API → Gerar nova chave. A chave é gerada instantaneamente e pode ser rotacionada a qualquer momento.',
  },
  {
    q: 'Existe SDK oficial?',
    a: 'Ainda não, mas a API é REST pura com JSON — qualquer linguagem que faz HTTP requests funciona. Exemplos em cURL, Python e JavaScript estão disponíveis aqui.',
  },
  {
    q: 'O que acontece quando atinjo o rate limit?',
    a: 'A API retorna HTTP 429 com o header Retry-After indicando quantos segundos aguardar. O limite padrão é 60 req/min, expansível sob demanda comercial.',
  },
  {
    q: 'Os dados de edital são armazenados após a análise?',
    a: 'Sim, o texto enviado fica associado à sua conta por 90 dias para histórico. Você pode solicitar exclusão via DELETE /api/analyses/{id} a qualquer momento.',
  },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          {lang && <span className="text-[10px] font-mono text-slate-500 ml-1">{lang}</span>}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="text-[12px] text-slate-300 font-mono leading-relaxed p-5 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-900/40 transition-colors"
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        <ChevronDown size={16} className={`text-slate-500 shrink-0 ml-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Versão BLOQUEADA (lead gen) ──────────────────────────────────────────────

function LockedView() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">

      {/* Glow de fundo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full bg-emerald-600/6 blur-[100px]" />
        <div className="absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full bg-sky-600/5 blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-16">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium mb-16 transition-colors">
          <ArrowLeft size={15} /> Voltar ao Workspace
        </Link>

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-widest mb-8">
            <Lock size={11} /> Plano Avançado — Nível 4
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-6 leading-tight">
            Integre a IA de licitações
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              no seu produto
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            A Bawzi API Enterprise expõe todo o motor de inteligência de editais —
            análise Multi-LLM, preços históricos e radar de concorrentes — via
            REST API pronta para integrar ao seu ERP, CRM ou plataforma de compras.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/25 text-sm"
            >
              <Sparkles size={15} /> Fazer upgrade para Avançado
            </Link>
            <a
              href="mailto:enterprise@bawzi.com"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-semibold text-sm transition-colors border border-slate-700 hover:border-slate-600 px-5 py-3.5 rounded-xl"
            >
              <Building2 size={14} /> Falar com vendas
            </a>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          {STATS.map((s) => (
            <div key={s.label} className="text-center py-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-white mb-1">{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Features ────────────────────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black mb-2">O que você desbloqueia</h2>
            <p className="text-slate-500 text-sm">Seis capacidades de IA prontas para consumir via API</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const c = COLOR_MAP[f.color];
              return (
                <div key={f.title} className={`group bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all hover:shadow-xl ${c.glow}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3.5 ${c.bg} ${c.border}`}>
                    <f.icon size={18} className={c.text} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Code preview (bloqueado) ──────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-2">Simples de integrar</h2>
            <p className="text-slate-500 text-sm">REST API com Bearer Auth — funciona em qualquer linguagem</p>
          </div>
          <div className="relative">
            <CodeBlock lang="cURL" code={CODE_TABS[0].code} />
            {/* Overlay de lock na resposta */}
            <div className="mt-3 relative">
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] font-mono text-slate-500">response.json</span>
                </div>
                <pre className="text-[12px] font-mono leading-relaxed p-5 overflow-hidden blur-[3px] select-none text-slate-300 h-32 whitespace-pre">
{`{
  "analysis": {
    "score": 82,
    "semaforo": "GO",
    "pricing_intelligence": {
      "desagioPreditivoOrgao": 22.5`}
                </pre>
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 shadow-2xl">
                  <Lock size={14} className="text-violet-400" />
                  <span className="text-sm font-semibold text-white">Resposta disponível no plano Avançado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Endpoints preview ────────────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-2">Endpoints disponíveis</h2>
            <p className="text-slate-500 text-sm">Documentação interativa completa desbloqueada após o upgrade</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {ENDPOINTS.map((e, i) => (
              <div key={e.path} className={`flex items-center gap-4 px-5 py-3.5 ${i < ENDPOINTS.length - 1 ? 'border-b border-slate-800/70' : ''}`}>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 font-mono ${METHOD_STYLE[e.method]}`}>{e.method}</span>
                <code className="text-sm text-violet-300 font-mono flex-1">{e.path}</code>
                <span className="text-xs text-slate-500 hidden sm:block">{e.desc}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 hidden md:block">{e.tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-2">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3 max-w-2xl mx-auto">
            {FAQ.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>

        {/* ── Final CTA ────────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-fuchsia-600/5 to-transparent p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Cpu size={26} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-black mb-3">Pronto para integrar?</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-7 leading-relaxed">
            Faça upgrade para o plano Avançado e tenha acesso imediato à API, à documentação Swagger completa e ao suporte prioritário.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/25 text-sm"
            >
              <Sparkles size={15} /> Fazer upgrade agora
            </Link>
            <a
              href="mailto:enterprise@bawzi.com"
              className="text-sm text-slate-400 hover:text-white transition-colors font-medium flex items-center gap-1.5"
            >
              enterprise@bawzi.com <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Versão AUTORIZADA (developer portal) ────────────────────────────────────

function AuthorizedView({ spec }: { spec: unknown }) {
  const [codeTab, setCodeTab] = useState(0);
  const [showSwagger, setShowSwagger] = useState(false);

  const NAV_SECTIONS = ['Autenticação', 'Capacidades', 'Referência', 'Endpoints', 'Limites & SLA', 'Swagger'];

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/workspace" className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm transition-colors shrink-0">
              <ArrowLeft size={14} /> Workspace
            </Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-bold text-white">API Enterprise</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Nível 4
            </span>
          </div>

          {/* Nav rápida — desktop */}
          <nav className="hidden lg:flex items-center gap-5">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => scrollTo(s.toLowerCase().replace(/\s|&/g, '-').replace(/-+/g, '-'))}
                className="text-xs font-medium text-slate-500 hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </nav>

          <a
            href="mailto:enterprise@bawzi.com"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-white transition-colors"
          >
            Suporte <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900/40 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
                Bawzi API{' '}
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Enterprise
                </span>
              </h1>
              <p className="text-slate-400 text-base max-w-xl leading-relaxed">
                REST API · Bearer JWT · JSON · Base URL <code className="text-violet-300 bg-slate-800/60 px-1.5 py-0.5 rounded text-sm">https://api.bawzi.com</code>
              </p>
            </div>
            {/* Stat pills */}
            <div className="flex flex-wrap gap-2.5 shrink-0">
              {STATS.map((s) => (
                <div key={s.label} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                  <span className="font-black text-white">{s.value}</span>
                  <span className="text-slate-500 text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-14 space-y-20">

        {/* ── Autenticação ─────────────────────────────────────────────────────── */}
        <section id="autenticação">
          <SectionHeader icon={Key} color="amber" title="Autenticação" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Bearer Token</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Todas as requisições devem incluir o header{' '}
                <code className="text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;token&gt;</code>.
                Obtenha o token via{' '}
                <code className="text-violet-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">POST /api/auth/login</code>.
              </p>
              <div className="space-y-0 divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
                {[
                  { label: 'Expiração',  value: '60 min (access token)' },
                  { label: 'Renovação',  value: 'POST /api/auth/refresh' },
                  { label: 'Algoritmo', value: 'JWT RS256' },
                  { label: 'Cookie',    value: 'bawzi_refresh (HttpOnly)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs px-4 py-3 bg-slate-900">
                    <span className="text-slate-500 font-medium">{label}</span>
                    <code className="text-slate-300">{value}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Play size={13} className="text-emerald-400" /> Exemplo rápido
              </h3>
              <CodeBlock code={`# 1. Login
curl -X POST https://api.bawzi.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"seu@email.com","password":"***"}'

# 2. Usar o token retornado
curl -H "Authorization: Bearer eyJ..." \\
  https://api.bawzi.com/api/analyses/quota`} />
            </div>
          </div>
        </section>

        {/* ── Capacidades ─────────────────────────────────────────────────────── */}
        <section id="capacidades">
          <SectionHeader icon={Sparkles} color="violet" title="Capacidades" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const c = COLOR_MAP[f.color];
              return (
                <div key={f.title} className={`group bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3.5 ${c.bg} ${c.border}`}>
                    <f.icon size={18} className={c.text} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Referência de código ─────────────────────────────────────────────── */}
        <section id="referência">
          <SectionHeader icon={Code2} color="emerald" title="Análise de Edital — POST /api/analyze" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Request */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Requisição</p>
              {/* Tabs de linguagem */}
              <div className="flex gap-1 mb-3">
                {CODE_TABS.map((t, i) => (
                  <button
                    key={t.lang}
                    onClick={() => setCodeTab(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      codeTab === i
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-500 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {t.lang}
                  </button>
                ))}
              </div>
              <CodeBlock code={CODE_TABS[codeTab].code} lang={CODE_TABS[codeTab].lang} />
            </div>
            {/* Response */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Resposta (200 OK)</p>
              <CodeBlock code={RESPONSE_EXAMPLE} lang="JSON" />
            </div>
          </div>
        </section>

        {/* ── Endpoints ────────────────────────────────────────────────────────── */}
        <section id="endpoints">
          <SectionHeader icon={Layers} color="sky" title="Endpoints principais" />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            {ENDPOINTS.map((e, i) => (
              <div key={e.path} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-800/30 transition-colors ${i < ENDPOINTS.length - 1 ? 'border-b border-slate-800/70' : ''}`}>
                <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg shrink-0 font-mono ${METHOD_STYLE[e.method]}`}>{e.method}</span>
                <code className="text-sm text-violet-300 font-mono flex-1">{e.path}</code>
                <span className="text-xs text-slate-500 hidden sm:block">{e.desc}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 hidden md:block shrink-0">{e.tag}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3 text-center">
            Documentação completa com todos os parâmetros disponível na referência Swagger abaixo.
          </p>
        </section>

        {/* ── Limites & SLA ─────────────────────────────────────────────────────── */}
        <section id="limites---sla">
          <SectionHeader icon={Gauge} color="rose" title="Limites & SLA" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Análises / mês', value: '∞',         sub: 'Ilimitado',     color: 'text-emerald-400' },
              { label: 'Chars / edital', value: '400K',       sub: 'por chamada',   color: 'text-sky-400'     },
              { label: 'Tamanho máx.',   value: '100 MB',     sub: 'por arquivo',   color: 'text-violet-400'  },
              { label: 'Rate limit',     value: '60/min',     sub: 'expansível',    color: 'text-amber-400'   },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                <p className={`text-3xl font-black mb-0.5 ${color}`}>{value}</p>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: CheckCircle2, color: 'text-emerald-400', title: 'Uptime 99.7%',         desc: 'SLA contratual com créditos por indisponibilidade acima do limite.' },
              { icon: AlertCircle,  color: 'text-amber-400',   title: 'HTTP 429 + Retry-After', desc: 'Ao atingir o rate limit, aguarde o valor do header Retry-After (em segundos).' },
              { icon: Shield,       color: 'text-violet-400',  title: 'TLS 1.3 obrigatório',   desc: 'Toda a comunicação é criptografada. Requisições HTTP são redirecionadas para HTTPS.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <Icon size={16} className={`shrink-0 mt-0.5 ${color}`} />
                <div>
                  <p className="text-xs font-bold text-white mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Swagger ──────────────────────────────────────────────────────────── */}
        <section id="swagger">
          <div className="flex items-center justify-between mb-6">
            <SectionHeader icon={BookOpen} color="violet" title="Referência completa (Swagger)" noMargin />
            {!showSwagger && (
              <button
                onClick={() => setShowSwagger(true)}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
              >
                <Code2 size={14} /> Abrir Swagger UI
              </button>
            )}
          </div>

          {showSwagger ? (
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-700">
              {spec ? (
                <SwaggerUI spec={spec} />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
                  <p className="text-sm text-slate-500">Carregando especificação…</p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSwagger(true)}
              className="w-full flex flex-col items-center justify-center gap-3 border border-dashed border-slate-700 rounded-2xl p-16 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
            >
              <Code2 size={32} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
              <p className="text-slate-500 text-sm font-medium group-hover:text-slate-300 transition-colors">
                Clique para abrir a documentação interativa
              </p>
            </button>
          )}
        </section>

      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© Bawzi · API Enterprise · Nível 4</span>
          <div className="flex items-center gap-6">
            <a href="mailto:enterprise@bawzi.com" className="hover:text-slate-400 transition-colors">enterprise@bawzi.com</a>
            <Link href="/docs" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <BookOpen size={11} /> Documentação
            </Link>
            <Link href="/workspace" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <ArrowLeft size={11} /> Workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon, color, title, noMargin,
}: {
  icon: React.ElementType; color: string; title: string; noMargin?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate;
  return (
    <div className={`flex items-center gap-3 ${noMargin ? '' : 'mb-6'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.bg} ${c.border}`}>
        <Icon size={16} className={c.text} />
      </div>
      <h2 className="text-xl font-black">{title}</h2>
    </div>
  );
}

// ─── Componente raiz ──────────────────────────────────────────────────────────

export default function EnterpriseApiPage() {
  const [spec, setSpec] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const tier = Number(localStorage.getItem('bawzi_tier') || '1');
    if (tier >= 4) {
      setIsAuthorized(true);
      apiFetch('/api/swagger')
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((data) => setSpec(data))
        .catch((err) => { if (!(err instanceof SessionExpiredError)) console.error(err); });
    } else {
      setIsAuthorized(false);
    }
  }, []);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  return isAuthorized ? <AuthorizedView spec={spec} /> : <LockedView />;
}
