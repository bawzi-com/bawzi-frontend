// app/enterprise/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Lock, Zap, Shield, Code2, Key, ChevronRight,
  FileText, TrendingUp, Users, Globe, CheckCircle2,
  Sparkles, ArrowRight, BookOpen, Copy, Check, ChevronDown,
  Cpu, Layers, ExternalLink, Building2, AlertCircle, Gauge, Play,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

// ─── Dados ───────────────────────────────────────────────────────────────────

const FEATURES = [
  // "em segundos" descrevia a análise COMPLETA (jurídico + precificação), que
  // roda os agentes de mercado e leva de 1 a 2 minutos. A promessa era
  // desmentida pela primeira execução.
  { icon: Zap,        title: 'Análise Multi-LLM',       desc: 'Score GO/NO-GO, riscos jurídicos e estratégia de precificação em poucos minutos.', color: 'emerald' },
  { icon: TrendingUp, title: 'Inteligência de Preços',   desc: 'Mediana de mercado, deságio preditivo e shadow price sobre a base do PNCP.',  color: 'sky'     },
  // "taxa de vitórias" não existe: o PNCP publica resultado, não participação —
  // não há denominador. O que o radar mostra é contagem de contratos vencidos.
  { icon: Users,      title: 'Radar de Concorrentes',    desc: 'Ranking de vencedores históricos por segmento, com capital social e contratos vencidos localizados.', color: 'teal'  },
  { icon: FileText,   title: 'Extração de Documentos',   desc: 'Texto completo de editais via CNPJ/ano/sequencial sem scraping manual.',     color: 'amber'   },
  { icon: Globe,      title: 'Feed PNCP em Tempo Real',  desc: 'Editais abertos por termo, UF e município com deduplicação semântica.',       color: 'sky'     },
  { icon: Shield,     title: 'Parecer Jurídico IA',      desc: 'Minutas de impugnação e pareceres de conformidade com base na Lei 14.133/21.', color: 'emerald' },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'bg-emerald-50',  border: 'border-emerald-100', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  sky:     { bg: 'bg-sky-50',      border: 'border-sky-100',     text: 'text-sky-700',     iconBg: 'bg-sky-100'     },
  teal:    { bg: 'bg-teal-50',     border: 'border-teal-100',    text: 'text-teal-700',    iconBg: 'bg-teal-100'    },
  amber:   { bg: 'bg-amber-50',    border: 'border-amber-100',   text: 'text-amber-700',   iconBg: 'bg-amber-100'   },
};

// ⚠️ CADA LINHA AQUI É UMA ROTA QUE O CLIENTE VAI CHAMAR. Duas estavam erradas
// e devolviam 404 na primeira tentativa de integração:
//   · `/api/pncp/busca` — a rota real é `/buscar` (router_pncp.py:178);
//   · `/api/competitor/ranking` — não existe rota nenhuma com esse nome. O
//     router de concorrentes tem UMA rota, `POST /offensive-intel`.
// Ao mexer em rota no backend, confira esta lista.
const ENDPOINTS = [
  { method: 'POST', path: '/api/analyze',                    desc: 'Análise de edital (multipart/form-data)', tag: 'Análise' },
  { method: 'GET',  path: '/api/pncp/buscar',                desc: 'Busca de editais abertos no PNCP',        tag: 'PNCP'    },
  { method: 'GET',  path: '/api/pncp/media-precos',          desc: 'Média de preços por segmento',            tag: 'Preços'  },
  { method: 'POST', path: '/api/competitor/offensive-intel', desc: 'Inteligência sobre um concorrente',       tag: 'Radar'   },
  { method: 'GET',  path: '/api/analyses/quota',             desc: 'Consumo mensal e limite do plano',        tag: 'Conta'   },
  { method: 'POST', path: '/api/auth/refresh',               desc: 'Renovação de token de acesso',            tag: 'Auth'    },
];

const METHOD_STYLE: Record<string, string> = {
  GET:    'bg-sky-100 text-sky-700',
  POST:   'bg-emerald-100 text-emerald-700',
  PUT:    'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

// ⚠️ OS TRÊS EXEMPLOS ENVIAVAM JSON. `/api/analyze` recebe multipart/form-data
// (`Form(...)`/`File(...)` em router_analyses.py:3068) — copiar e colar o que
// estava aqui devolvia 422 na primeira chamada, com um erro de validação que
// não explicava a causa. Também mandavam `"tier": 4`: tier não é parâmetro,
// vem da conta do token. O que escolhe o modo é `provider`
// ("openai" = rápida, "claude" = auditoria profunda — ver core/modos.py).
const CODE_TABS = [
  {
    lang: 'cURL',
    code: `curl -X POST https://api.bawzi.com/api/analyze \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -F "raw_text=PREGÃO ELETRÔNICO Nº 001/2025..." \\
  -F "uf=SP" \\
  -F "provider=openai"

# PDF em vez de texto:
#   -F "files=@edital.pdf"
# Auditoria profunda (custa 4×):
#   -F "provider=claude"`,
  },
  {
    lang: 'Python',
    code: `import requests

resp = requests.post(
    "https://api.bawzi.com/api/analyze",
    headers={"Authorization": f"Bearer {token}"},
    data={"raw_text": edital_text, "uf": "SP", "provider": "openai"},
    # PDFs, se houver:
    # files=[("files", ("edital.pdf", open("edital.pdf", "rb"), "application/pdf"))],
    timeout=300,  # a análise completa leva de 1 a 2 minutos
)
data = resp.json()
print(data["analysis"]["score"])    # 82
print(data["analysis"]["semaforo"]) # "GO"`,
  },
  {
    lang: 'JavaScript',
    code: `const form = new FormData();
form.append("raw_text", editalText);
form.append("uf", "SP");
form.append("provider", "openai");
// form.append("files", pdfFile);

const res = await fetch("https://api.bawzi.com/api/analyze", {
  method: "POST",
  headers: { "Authorization": \`Bearer \${token}\` }, // sem Content-Type: o
  body: form,                                       // browser define o boundary
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

// ⚠️ NÚMERO EM VITRINE É PROMESSA. Os quatro anteriores eram:
//   · "400K+ editais indexados" — sem fonte no código; ninguém sabe medir;
//   · "< 8s por análise" — a própria página, 90 linhas acima, diz "em poucos
//     minutos", e o backend usa timeout de 15 min;
//   · "99.7% uptime SLA" — os Termos de Uso (§8) dizem o contrário, por
//     escrito: "não garante disponibilidade ininterrupta".
// Só ficou o que se verifica no código.
const STATS = [
  { value: 'REST',   label: 'JSON · Bearer JWT'   },
  { value: '1–2 min', label: 'por análise'         },
  { value: '10/min', label: 'rate limit'           },
  { value: 'PNCP',   label: 'fonte oficial'        },
];

const FAQ = [
  {
    // Não existe emissão de chave de API em lugar nenhum do backend (nem rota,
    // nem tela em Perfil). A resposta anterior mandava o cliente para
    // "Perfil → API → Gerar nova chave", um caminho que não existe.
    q: 'Como autentico minhas chamadas?',
    a: 'Com o mesmo token JWT da sua sessão: faça POST /api/auth/login e use o access_token no header Authorization: Bearer. Ainda não emitimos chave de API separada, de longa duração — o access token expira em 60 minutos e é renovado por POST /api/auth/refresh. Se você precisa de credencial de serviço para rodar sem um usuário logado, fale com development@bawzi.com.',
  },
  {
    q: 'Existe SDK oficial?',
    a: 'Ainda não. A API é REST com JSON na resposta — qualquer linguagem que faça HTTP funciona. Atenção a um detalhe: POST /api/analyze recebe multipart/form-data, não JSON. Os exemplos aqui já estão nesse formato.',
  },
  {
    q: 'O que acontece quando atinjo o rate limit?',
    a: 'A API retorna HTTP 429 com o header Retry-After indicando quantos segundos aguardar. O limite em /api/analyze é de 10 requisições por minuto, contadas por workspace (e por IP quando não há sessão). Se o seu caso de uso precisa de mais, fale com development@bawzi.com — não é liberado automaticamente.',
  },
  {
    q: 'Os dados de edital são armazenados após a análise?',
    a: 'Sim. O texto enviado e o laudo ficam associados à sua conta no histórico, sem prazo de expiração automático — você controla o que fica. Para apagar, use DELETE /api/analyses/{id} (um laudo) ou DELETE /api/analyses/history/all (todo o histórico).',
  },
];

// ─── Sub-componentes compartilhados ──────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          {lang && <span className="text-[10px] font-mono text-slate-400 ml-1">{lang}</span>}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="text-[12px] text-slate-300 font-mono leading-relaxed p-5 overflow-x-auto whitespace-pre bg-slate-900">
        {code}
      </pre>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        <ChevronDown size={15} className={`text-slate-400 shrink-0 ml-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
        <Icon size={17} className="text-white" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    </div>
  );
}

// ─── Versão BLOQUEADA ─────────────────────────────────────────────────────────

function LockedView() {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#059669,#047857)' }} className="px-6 py-14 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-emerald-200 text-sm mb-5">
            <Link href="/workspace" className="hover:text-white transition-colors flex items-center gap-1.5">
              <ArrowLeft size={14} /> Workspace
            </Link>
            <ChevronRight size={13} />
            <span>API Enterprise</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold mb-6">
            <Lock size={11} /> Plano Avançado — Nível 4
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 leading-tight">
            Integre a IA de licitações<br />no seu produto
          </h1>
          <p className="text-emerald-100 text-base max-w-xl leading-relaxed mb-8">
            A Bawzi API Enterprise expõe todo o motor de análise de editais — score Multi-LLM, preços históricos e radar de concorrentes — via REST API pronta para integrar ao seu ERP, CRM ou plataforma de compras.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 bg-white text-emerald-700 font-black px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors shadow-lg text-sm"
            >
              <Sparkles size={15} /> Fazer upgrade para Avançado
            </Link>
            <a
              href="mailto:development@bawzi.com"
              className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              <Building2 size={14} /> Falar com vendas
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12 space-y-14">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
              <p className="text-2xl font-black text-emerald-600 mb-1">{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">O que você desbloqueia</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const c = COLOR_MAP[f.color];
              return (
                <div key={f.title} className={`rounded-2xl border p-5 ${c.bg} ${c.border}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.iconBg}`}>
                    <f.icon size={17} className={c.text} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Code preview */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Simples de integrar</h2>
          <p className="text-sm text-slate-500 mb-5">REST API com Bearer Auth — funciona em qualquer linguagem</p>
          <CodeBlock lang="cURL" code={CODE_TABS[0].code} />
          {/* Resposta bloqueada */}
          <div className="relative mt-3">
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800">
                <span className="text-[10px] font-mono text-slate-400">response.json</span>
              </div>
              <pre className="text-[12px] font-mono p-5 overflow-hidden select-none text-slate-300 h-28 whitespace-pre bg-slate-900 blur-[3px]">
{`{
  "analysis": {
    "score": 82,
    "semaforo": "GO",
    "pricing_intelligence": {
      "desagioPreditivoOrgao": 22.5`}
              </pre>
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-t from-slate-900/80 via-slate-900/50 to-transparent">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-5 py-2.5 shadow-lg">
                <Lock size={13} className="text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">Disponível no plano Avançado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Endpoints disponíveis</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {ENDPOINTS.map((e, i) => (
              <div key={e.path} className={`flex items-center gap-4 px-5 py-3.5 ${i < ENDPOINTS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 font-mono ${METHOD_STYLE[e.method]}`}>{e.method}</span>
                <code className="text-sm text-emerald-700 font-mono flex-1">{e.path}</code>
                <span className="text-xs text-slate-400 hidden sm:block">{e.desc}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hidden md:block shrink-0">{e.tag}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">Swagger UI interativo disponível após o upgrade</p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Perguntas frequentes</h2>
          <div className="space-y-3 max-w-2xl">
            {FAQ.map((item) => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>

        {/* CTA final */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
            <Cpu size={26} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">Pronto para integrar?</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-7 leading-relaxed">
            Faça upgrade para o plano Avançado e tenha acesso imediato à API, documentação Swagger completa e suporte prioritário.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-white font-black px-7 py-3.5 rounded-xl transition-all shadow-lg text-sm"
              style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
            >
              <Sparkles size={15} /> Fazer upgrade agora
            </Link>
            <a
              href="mailto:development@bawzi.com"
              className="text-sm text-slate-500 hover:text-emerald-600 transition-colors font-medium flex items-center gap-1.5"
            >
              development@bawzi.com <ExternalLink size={12} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Limites do plano: vêm do backend, não do React ──────────────────────────
//
// ⚠️ ESTE BLOCO ANUNCIAVA "∞ · Ilimitado" PARA ANÁLISES/MÊS. O plano Avançado
// tem 650 créditos/mês (LIMIT_TIER_4) — nada de ilimitado. Também dizia "400K
// chars" (o real é 500.000) e "100 MB por arquivo" (o plano permite 100, mas
// `_MAX_FILE_SIZE` corta em 20 MB por requisição, então 100 nunca acontece).
//
// Agora os dois primeiros vêm de /api/tiers/limites-publicos — a MESMA fonte
// que a página de planos usa. Número escrito à mão em duas telas é número que
// diverge.
interface LimitePlano {
  monthly_limit: number;
  ilimitado: boolean;
  max_chars: number | null;
  max_mb: number | null;
}

// Teto TÉCNICO de upload por requisição, espelha `_MAX_FILE_SIZE` em
// router_analyses.py:236. Vale para todos os planos, inclusive o Avançado.
const TETO_UPLOAD_MB = 20;

function useLimiteAvancado() {
  const [limite, setLimite] = useState<LimitePlano | null>(null);
  useEffect(() => {
    apiFetch('/api/tiers/limites-publicos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tiers?.['4']) setLimite(d.tiers['4'] as LimitePlano); })
      .catch((err) => { if (!(err instanceof SessionExpiredError)) console.error(err); });
  }, []);
  return limite;
}

const fmtMilhar = (n: number) => n.toLocaleString('pt-BR');

// ─── Versão AUTORIZADA ────────────────────────────────────────────────────────

function AuthorizedView({ spec }: { spec: unknown }) {
  const [codeTab, setCodeTab] = useState(0);
  const [showSwagger, setShowSwagger] = useState(false);
  const limite = useLimiteAvancado();

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const NAV_ITEMS = [
    { label: 'Autenticação', id: 'autenticacao' },
    { label: 'Capacidades',  id: 'capacidades'  },
    { label: 'Referência',   id: 'referencia'   },
    { label: 'Endpoints',    id: 'endpoints'    },
    { label: 'Limites',      id: 'limites'      },
    { label: 'Swagger',      id: 'swagger'      },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar sticky */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/workspace" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm transition-colors shrink-0">
              <ArrowLeft size={14} /> Workspace
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-bold text-slate-800">API Enterprise</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Nível 4
            </span>
          </div>
          <nav className="hidden lg:flex items-center gap-5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-xs font-medium text-slate-500 hover:text-emerald-700 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <a href="mailto:development@bawzi.com" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-600 transition-colors">
            Suporte <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#059669,#047857)' }} className="px-6 py-12 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
                Bawzi API Enterprise
              </h1>
              <p className="text-emerald-100 text-base max-w-xl leading-relaxed">
                REST API · Bearer JWT · JSON · Base URL{' '}
                <code className="text-white bg-white/15 px-2 py-0.5 rounded text-sm">https://api.bawzi.com</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              {STATS.map((s) => (
                <div key={s.label} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm">
                  <span className="font-black text-white">{s.value}</span>
                  <span className="text-emerald-200 text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* Autenticação */}
        <section id="autenticacao">
          <SectionHeader icon={Key} title="Autenticação" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Bearer Token</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                Inclua o header{' '}
                <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;token&gt;</code>{' '}
                em todas as requisições.
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                {[
                  { label: 'Expiração',  value: '60 min (access token)'       },
                  { label: 'Renovação',  value: 'POST /api/auth/refresh'       },
                  // HS256, não RS256 (JWT_ALGORITHM em core/config.py:22). Quem
                  // fosse validar o token do lado dele iria procurar uma chave
                  // pública que não existe.
                  { label: 'Algoritmo', value: 'JWT HS256'                    },
                  { label: 'Cookie',    value: 'bawzi_refresh (HttpOnly)'     },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs px-4 py-3 bg-slate-50/50">
                    <span className="text-slate-500 font-medium">{label}</span>
                    <code className="text-slate-700">{value}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Play size={13} className="text-emerald-600" /> Exemplo rápido
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

        {/* Capacidades */}
        <section id="capacidades">
          <SectionHeader icon={Sparkles} title="Capacidades" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const c = COLOR_MAP[f.color];
              return (
                <div key={f.title} className={`rounded-2xl border p-5 ${c.bg} ${c.border}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.iconBg}`}>
                    <f.icon size={17} className={c.text} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">{f.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Referência de código */}
        <section id="referencia">
          <SectionHeader icon={Code2} title="Análise de Edital — POST /api/analyze" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Requisição</p>
              <div className="flex gap-1 mb-3">
                {CODE_TABS.map((t, i) => (
                  <button
                    key={t.lang}
                    onClick={() => setCodeTab(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      codeTab === i
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.lang}
                  </button>
                ))}
              </div>
              <CodeBlock code={CODE_TABS[codeTab].code} lang={CODE_TABS[codeTab].lang} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Resposta (200 OK)</p>
              <CodeBlock code={RESPONSE_EXAMPLE} lang="JSON" />
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints">
          <SectionHeader icon={Layers} title="Endpoints principais" />
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {ENDPOINTS.map((e, i) => (
              <div key={e.path} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i < ENDPOINTS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg shrink-0 font-mono ${METHOD_STYLE[e.method]}`}>{e.method}</span>
                <code className="text-sm text-emerald-700 font-mono flex-1">{e.path}</code>
                <span className="text-xs text-slate-400 hidden sm:block">{e.desc}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hidden md:block shrink-0">{e.tag}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Limites & SLA */}
        <section id="limites">
          <SectionHeader icon={Gauge} title="Limites & SLA" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              {
                label: 'Créditos / mês',
                value: limite ? (limite.ilimitado ? '∞' : fmtMilhar(limite.monthly_limit)) : '—',
                sub: 'cota do Avançado',
                color: 'text-emerald-600',
              },
              {
                label: 'Chars / edital',
                value: limite?.max_chars ? fmtMilhar(limite.max_chars) : '—',
                sub: 'acima disso, lê em recorte',
                color: 'text-sky-600',
              },
              { label: 'Upload',     value: `${TETO_UPLOAD_MB} MB`, sub: 'teto por requisição', color: 'text-amber-600' },
              { label: 'Rate limit', value: '10/min',               sub: 'por workspace',       color: 'text-teal-600'  },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
                <p className={`text-3xl font-black mb-0.5 ${color}`}>{value}</p>
                <p className="text-xs text-slate-600 font-medium">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              // ⚠️ AQUI DIZIA "SLA contratual com créditos por indisponibilidade".
              // Os Termos de Uso §8, que o cliente assina, dizem o oposto:
              // "não garante disponibilidade ininterrupta". Uma página de
              // vendas não pode prometer o que o contrato nega — se um dia
              // houver SLA, ele nasce nos Termos, não aqui.
              { icon: CheckCircle2, title: 'Sem SLA contratual',     desc: 'Operamos em melhor esforço, sem garantia de disponibilidade ininterrupta (Termos de Uso, §8).', color: 'text-slate-500'   },
              { icon: AlertCircle,  title: 'HTTP 429 + Retry-After', desc: 'Ao atingir o rate limit, aguarde o valor do header Retry-After (em segundos).',   color: 'text-amber-600'   },
              { icon: Shield,       title: 'TLS 1.3 obrigatório',    desc: 'Toda comunicação é criptografada. Requisições HTTP são redirecionadas para HTTPS.', color: 'text-sky-600'     },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <Icon size={16} className={`shrink-0 mt-0.5 ${color}`} />
                <div>
                  <p className="text-xs font-bold text-slate-800 mb-1">{title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Swagger */}
        <section id="swagger">
          <div className="flex items-center justify-between mb-6">
            <SectionHeader icon={BookOpen} title="Referência completa (Swagger)" />
            {!showSwagger && (
              <button
                onClick={() => setShowSwagger(true)}
                className="inline-flex items-center gap-2 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm"
                style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
              >
                <Code2 size={14} /> Abrir Swagger UI
              </button>
            )}
          </div>
          {showSwagger ? (
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              {spec ? (
                <SwaggerUI spec={spec} />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                  <p className="text-sm text-slate-400">Carregando especificação…</p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSwagger(true)}
              className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-14 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group bg-white"
            >
              <Code2 size={30} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              <p className="text-slate-400 text-sm font-medium group-hover:text-emerald-600 transition-colors">
                Clique para abrir a documentação interativa
              </p>
            </button>
          )}
        </section>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 mt-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© Bawzi · API Enterprise · Nível 4</span>
          <div className="flex items-center gap-6">
            <a href="mailto:development@bawzi.com" className="hover:text-emerald-600 transition-colors">development@bawzi.com</a>
            <Link href="/docs" className="hover:text-emerald-600 transition-colors flex items-center gap-1"><BookOpen size={11} /> Documentação</Link>
            <Link href="/workspace" className="hover:text-emerald-600 transition-colors flex items-center gap-1"><ArrowLeft size={11} /> Workspace</Link>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function EnterpriseApiPage() {
  const [spec, setSpec] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const tier = Number(localStorage.getItem('bawzi_tier') || '1');
    if (tier >= 4) {
      setIsAuthorized(true);
      apiFetch('/api/swagger')
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setSpec)
        .catch((err) => { if (!(err instanceof SessionExpiredError)) console.error(err); });
    } else {
      setIsAuthorized(false);
    }
  }, []);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return isAuthorized ? <AuthorizedView spec={spec} /> : <LockedView />;
}
