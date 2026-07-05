'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, Clock, TrendingUp, Zap, CheckCircle2, AlertTriangle, Globe, Building2, Pencil, RefreshCw, BadgeCheck, Scale, UsersRound, CornerDownRight } from 'lucide-react';
import { API_URL } from '@/lib/apiClient';

interface Edital {
  id: string;
  objeto: string;
  orgao: string;
  uf: string;
  municipio: string;
  modalidade: string;
  valor: number | null;
  data_encerramento: string;
}

// ── Utilitários ───────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseDateBR(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) { const [, dd, mm, yyyy] = m; const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`); return isNaN(d.getTime()) ? null : d; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function encerraEm(s: string): { texto: string; urgente: boolean } {
  const d = parseDateBR(s);
  if (!d) return { texto: '', urgente: false };
  const diff = Math.floor((d.getTime() - Date.now()) / 60000);
  if (diff < 0)    return { texto: 'Encerrado', urgente: false };
  if (diff < 60)   return { texto: `${diff}min`, urgente: true };
  if (diff < 1440) { const horas = Math.floor(diff / 60); return { texto: `${horas}h`, urgente: horas <= 3 }; }
  return { texto: `${Math.floor(diff / 1440)}d`, urgente: false };
}

function formatValor(v: number | null): string {
  if (!v) return '';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

function modShort(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))       return 'Pregão';
  if (m.includes('concorrência')) return 'Concorrência';
  if (m.includes('dispensa'))     return 'Dispensa';
  if (m.includes('credenciamento')) return 'Credenciamento';
  return mod.split(' ')[0] || 'Licitação';
}

function modColor(mod: string): { dot: string; badge: string; bar: string } {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))         return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'from-emerald-500 to-emerald-300' };
  if (m.includes('concorrência'))   return { dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700 border-sky-100',             bar: 'from-sky-500 to-sky-300' };
  if (m.includes('dispensa'))       return { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-100',       bar: 'from-amber-500 to-amber-300' };
  if (m.includes('credenciamento')) return { dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 border-purple-100',    bar: 'from-purple-500 to-purple-300' };
  return { dot: 'bg-slate-300', badge: 'bg-slate-50 text-slate-600 border-slate-100', bar: 'from-slate-300 to-slate-200' };
}

const AVATAR_COLORS = ['bg-violet-200','bg-sky-200','bg-emerald-200','bg-amber-200','bg-rose-200','bg-teal-200'];

// ── Análise simulada (determinística por ID) ──────────────────────────────
type Level = { label: string; color: string; bar: number };

function analise(id: string): { match: Level; risco: Level; competicao: Level; veredito: string } {
  const h = hashStr(id || 'x');
  const MATCH: Level[] = [
    { label: 'Muito alto', color: 'text-emerald-600', bar: 92 },
    { label: 'Alto',       color: 'text-emerald-500', bar: 74 },
    { label: 'Médio',      color: 'text-amber-500',   bar: 52 },
    { label: 'Baixo',      color: 'text-rose-500',    bar: 28 },
  ];
  const RISCO: Level[] = [
    { label: 'Baixo',  color: 'text-emerald-500', bar: 18 },
    { label: 'Médio',  color: 'text-amber-500',   bar: 52 },
    { label: 'Alto',   color: 'text-rose-500',    bar: 80 },
  ];
  const COMP: Level[] = [
    { label: 'Baixa',  color: 'text-emerald-500', bar: 22 },
    { label: 'Média',  color: 'text-amber-500',   bar: 55 },
    { label: 'Alta',   color: 'text-rose-500',    bar: 82 },
  ];
  const match     = MATCH[(h)     % 4];
  const risco     = RISCO[(h >>2) % 3];
  const competicao = COMP[(h >>4) % 3];
  const veredito  = match.bar >= 70 && risco.bar <= 52 ? 'Recomendado disputar' : match.bar >= 50 ? 'Vale analisar' : 'Baixa prioridade';
  return { match, risco, competicao, veredito };
}

// ── Mini barra de nível ───────────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  const bg = color.includes('emerald') ? 'bg-emerald-500'
           : color.includes('amber')   ? 'bg-amber-400'
           : 'bg-rose-500';
  return (
    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${bg} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Painel de análise ─────────────────────────────────────────────────────
function AnalysisPanel({ edital }: { edital: Edital }) {
  const { match, risco, competicao, veredito } = analise(edital.id);
  const isGo   = veredito === 'Recomendado disputar';
  const isWarn = veredito === 'Vale analisar';
  const tone = isGo
    ? { shell: 'border-emerald-100 bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2 }
    : isWarn
      ? { shell: 'border-amber-100 bg-amber-50', text: 'text-amber-700', Icon: AlertTriangle }
      : { shell: 'border-slate-200 bg-slate-50', text: 'text-slate-500', Icon: AlertTriangle };
  const ToneIcon = tone.Icon;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] p-4 w-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <Zap size={12} className="text-white" />
        </div>
        <div className="min-w-0 leading-none">
          <p className="text-[11px] font-black text-slate-900">Análise Bawzi</p>
          <p className="mt-1 text-[9px] font-medium text-slate-400">gerada em segundos</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {[
          { label: 'Match CNAE',     level: match,     Icon: BadgeCheck },
          { label: 'Risco jurídico', level: risco,     Icon: Scale },
          { label: 'Concorrência',   level: competicao, Icon: UsersRound },
        ].map(({ label, level, Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={11} className="shrink-0 text-slate-300" />
            <span className="w-[70px] shrink-0 text-[10px] font-semibold text-slate-500">{label}</span>
            <Bar pct={level.bar} color={level.color} />
            <span className={`w-14 text-right text-[10px] font-black shrink-0 ${level.color}`}>{level.label}</span>
          </div>
        ))}
      </div>

      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone.shell}`}>
        <ToneIcon size={13} className={`shrink-0 ${tone.text}`} />
        <span className={`text-[11px] font-black ${tone.text}`}>{veredito}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-50 pt-2.5">
        <span className="h-1 w-1 rounded-full bg-emerald-500" />
        <span className="text-[9px] font-semibold text-slate-400">Fonte: PNCP oficial</span>
      </div>
    </div>
  );
}

// ── Card individual ───────────────────────────────────────────────────────
function EditalCard({ edital, depth }: { edital: Edital; depth: 0 | 1 | 2 }) {
  const enc   = encerraEm(edital.data_encerramento).texto;
  const val   = formatValor(edital.valor);
  const mod   = modColor(edital.modalidade);
  const seed  = hashStr(edital.id || 'x');
  const count = 2 + (seed % 5);
  const avatars = Array.from({ length: Math.min(count, 3) }, (_, i) => AVATAR_COLORS[(seed + i) % AVATAR_COLORS.length]);

  const depthStyles: Record<0 | 1 | 2, React.CSSProperties> = {
    0: {},
    1: { transform: 'translate(14px, -14px)', opacity: 0.55, pointerEvents: 'none' },
    2: { transform: 'translate(28px, -28px)', opacity: 0.25, pointerEvents: 'none' },
  };
  const shadowClass = depth === 0
    ? 'shadow-[0_24px_60px_-16px_rgba(15,23,42,0.22)]'
    : 'shadow-md';

  return (
    <div
      className={`absolute inset-0 rounded-2xl border border-slate-100 bg-white ${shadowClass}`}
      style={{ zIndex: 3 - depth, ...depthStyles[depth] }}
    >
      {depth === 0 && (
        <div className="p-5 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${mod.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${mod.dot}`} />
              {modShort(edital.modalidade)}
            </span>
            {edital.municipio && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <MapPin size={9} />
                {edital.municipio} · {edital.uf}
              </span>
            )}
          </div>

          {/* Objeto */}
          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-3 flex-1 mb-3">
            {edital.objeto || 'Sem descrição'}
          </p>

          {/* Org */}
          <p className="text-[10px] text-slate-400 truncate mb-3">{edital.orgao}</p>

          {/* Meta row */}
          <div className="flex items-center gap-3 mb-3">
            {val && (
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-emerald-600" />
                <span className="text-xs font-black text-emerald-700">{val}</span>
              </div>
            )}
            {enc && enc !== 'Encerrado' && (
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">{enc}</span>
              </div>
            )}
          </div>

          {/* Matches */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
            <div className="flex -space-x-1.5">
              {avatars.map((color, i) => (
                <div key={i} className={`w-5 h-5 rounded-full ${color} border-2 border-white blur-[1.5px]`} />
              ))}
              <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                <span className="text-[8px] font-black text-slate-400">+</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">
              <span className="font-bold text-slate-600">{count}</span> empresas com perfil
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type Scope = 'nacional' | 'regional' | 'local';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const TABS: { key: Scope; label: string; Icon: typeof Globe }[] = [
  { key: 'nacional', label: 'Nacional', Icon: Globe },
  { key: 'regional', label: 'Regional', Icon: Building2 },
  { key: 'local',    label: 'Local',    Icon: MapPin },
];

// ── Componente principal ──────────────────────────────────────────────────
const CYCLE_MS = 4500;

export default function HeroCards() {
  const [scope, setScope]           = useState<Scope>('nacional');
  const [uf, setUf]                 = useState<string | null>(null);
  const [cidadeNome, setCidadeNome]  = useState<string | null>(null);
  const [municipioId, setMunicipioId] = useState<string | null>(null);

  // editor
  const [editingScope, setEditingScope]         = useState<'regional' | 'local' | null>(null);
  const [ufInput, setUfInput]                   = useState('');
  const [cidadeInput, setCidadeInput]           = useState('');
  const [municipioResults, setMunicipioResults] = useState<Array<{ municipio_id: string; municipio_nome: string }>>([]);
  const [loadingMun, setLoadingMun]             = useState(false);
  const cidadeInputRef                          = useRef<HTMLInputElement>(null);

  const [pool, setPool]             = useState<Edital[]>([]);
  const [idx, setIdx]               = useState(0);
  const [animating, setAnimating]   = useState(false);
  const cursor                      = useRef(1);

  // Auto-detect location
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(async d => {
        const ufDet  = d.region_code as string | undefined;
        const cidDet = d.city        as string | undefined;
        if (ufDet) setUf(ufDet);
        if (ufDet && cidDet) {
          try {
            const res = await fetch(`${API_URL}/api/pncp/municipios?q=${encodeURIComponent(cidDet)}&uf=${ufDet}&limit=1`);
            if (res.ok) {
              const lista = await res.json();
              if (lista?.[0]?.municipio_id) {
                setCidadeNome(lista[0].municipio_nome ?? cidDet);
                setMunicipioId(String(lista[0].municipio_id));
              }
            }
          } catch { /* silencioso */ }
        }
      })
      .catch(() => {});
  }, []);

  const buscarMunicipios = useCallback(async (q: string, ufQ: string) => {
    if (q.length < 2 || !ufQ) { setMunicipioResults([]); return; }
    setLoadingMun(true);
    try {
      const res = await fetch(`${API_URL}/api/pncp/municipios?q=${encodeURIComponent(q)}&uf=${ufQ}&limit=6`);
      if (res.ok) setMunicipioResults(await res.json());
    } catch { /* silent */ } finally { setLoadingMun(false); }
  }, []);

  const aplicarUF = (novaUF: string) => {
    setUf(novaUF); setUfInput(''); setEditingScope(null);
    setCidadeNome(null); setMunicipioId(null);
    setScope('regional');
  };

  const aplicarMunicipio = (nome: string, id: string) => {
    if (ufInput) setUf(ufInput);
    setCidadeNome(nome); setMunicipioId(id);
    setCidadeInput(''); setMunicipioResults([]); setEditingScope(null);
    setScope('local');
  };

  const fecharEditor = () => { setEditingScope(null); setCidadeInput(''); setMunicipioResults([]); };

  const abrirEditor = (s: 'regional' | 'local', e: React.MouseEvent) => {
    e.stopPropagation(); setUfInput(uf || ''); setEditingScope(s);
  };

  const fetchPool = useCallback(async () => {
    const params = new URLSearchParams({ scope, limit: '20' });
    if (scope !== 'nacional' && uf) params.set('uf', uf);
    if (scope === 'local' && municipioId) params.set('municipio_id', municipioId);
    try {
      const r = await fetch(`${API_URL}/api/pncp/feed?${params}`);
      const j = await r.json();
      setPool(j.data || []);
      setIdx(0); cursor.current = 1;
    } catch {}
  }, [scope, uf, municipioId]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIdx(cursor.current % pool.length);
        cursor.current++;
        setAnimating(false);
      }, 350);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [pool]);

  const current = pool[idx];
  const next    = pool[(idx + 1) % pool.length];
  const further = pool[(idx + 2) % pool.length];
  const mod     = current ? modColor(current.modalidade) : null;
  const enc     = current ? encerraEm(current.data_encerramento) : { texto: '', urgente: false };

  const handleTabClick = (key: Scope) => {
    if (key === 'nacional') { setScope('nacional'); return; }
    if (!uf) { setUfInput(''); setEditingScope(key); return; }
    if (key === 'local' && !cidadeNome) { setUfInput(uf); setEditingScope('local'); return; }
    setScope(key);
  };

  const tabBar = (
    <div className="flex items-center gap-0.5 p-0.5 bg-white/[0.08] rounded-xl mb-4 self-start">
      {TABS.map(({ key, label, Icon }) => {
        const active = scope === key;
        return (
          <button
            key={key}
            onClick={() => handleTabClick(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Icon size={10} />
            {label}
            {key === 'regional' && (
              <span
                className={`flex items-center gap-0.5 text-[9px] font-black cursor-pointer ${active ? 'text-emerald-600' : 'text-white/40'}`}
                onClick={e => abrirEditor('regional', e)}
              >
                {uf ?? <span className="italic">definir</span>} <Pencil size={7} className="opacity-60" />
              </span>
            )}
            {key === 'local' && (
              <span
                className={`flex items-center gap-0.5 text-[9px] font-black cursor-pointer max-w-[64px] truncate ${
                  active ? (cidadeNome ? 'text-emerald-600' : 'text-amber-400') : 'text-white/40'
                }`}
                onClick={e => abrirEditor('local', e)}
              >
                {cidadeNome ?? <span className="italic">a definir</span>}
                <Pencil size={7} className="opacity-60 shrink-0" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const editor = editingScope && (
    <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2.5">
      <div className="flex items-center gap-2">
        <MapPin size={11} className="shrink-0 text-emerald-400" />
        <select
          value={ufInput}
          onChange={e => {
            const novaUF = e.target.value;
            setUfInput(novaUF);
            setCidadeInput(''); setMunicipioResults([]);
            setCidadeNome(null); setMunicipioId(null);
            if (editingScope === 'regional') aplicarUF(novaUF);
            else setTimeout(() => cidadeInputRef.current?.focus(), 30);
          }}
          className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
        >
          <option value="" className="text-slate-900">Estado</option>
          {UFS.map(u => <option key={u} value={u} className="text-slate-900">{u}</option>)}
        </select>
        {editingScope === 'local' && (
          <div className="relative flex-1">
            <input
              ref={cidadeInputRef}
              autoFocus={!ufInput}
              placeholder={ufInput ? `Cidade em ${ufInput}…` : 'Selecione o estado primeiro'}
              disabled={!ufInput}
              value={cidadeInput}
              onChange={e => { setCidadeInput(e.target.value); buscarMunicipios(e.target.value, ufInput); }}
              className={`w-full rounded-lg border px-2 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none bg-white/10 ${
                ufInput ? 'border-emerald-400/50 focus:border-emerald-400' : 'border-white/10 cursor-not-allowed opacity-50'
              }`}
            />
            {loadingMun && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                <RefreshCw size={9} className="animate-spin text-white/40" />
              </span>
            )}
            {municipioResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {municipioResults.map(m => (
                  <button
                    key={m.municipio_id}
                    onMouseDown={() => aplicarMunicipio(m.municipio_nome, m.municipio_id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50"
                  >
                    <MapPin size={9} className="shrink-0 text-slate-400" />
                    {m.municipio_nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={fecharEditor} className="shrink-0 rounded-lg p-1 text-white/40 hover:text-white/80">✕</button>
      </div>
    </div>
  );

  if (!current) {
    return (
      <div className="w-full">
        {tabBar}
        <div className="flex gap-5">
          <div className="flex-1 animate-pulse rounded-2xl bg-white/5 border border-white/10" style={{ minHeight: 280 }} />
          <div className="w-52 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes cardOut {
          to { opacity: 0; transform: translateY(-12px) scale(0.97); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .card-out { animation: cardOut 0.35s ease forwards; }
        .card-in  { animation: cardIn  0.35s ease both; }
      `}</style>

      <div className="w-full">
      {tabBar}
      {editor}
      <div className="flex items-start gap-5 w-full">

        {/* Stack de cartões */}
        <div className="flex-1 min-w-0">
          <div className="relative" style={{ paddingBottom: '28px', paddingRight: '28px' }}>
            {/* Profundidade: cartões de baixo */}
            {further && <div className="absolute inset-0 rounded-2xl border border-slate-100 bg-white" style={{ transform: 'translate(28px,-28px)', opacity: 0.22, zIndex: 1 }} />}
            {next    && <div className="absolute inset-0 rounded-2xl border border-slate-100 bg-white shadow-md" style={{ transform: 'translate(14px,-14px)', opacity: 0.55, zIndex: 2 }} />}

            {/* Cartão ativo */}
            <div
              className={`relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_24px_60px_-16px_rgba(15,23,42,0.22)] ${animating ? 'card-out' : 'card-in'}`}
              style={{ zIndex: 3 }}
            >
              {mod && <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${mod.bar}`} />}
              <div className="p-5 pt-[22px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  {mod && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${mod.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${mod.dot}`} />
                      {modShort(current.modalidade)}
                    </span>
                  )}
                  {current.municipio && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin size={9} />{current.municipio} · {current.uf}
                    </span>
                  )}
                </div>

                {/* Objeto */}
                <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-3 mb-2.5">
                  {current.objeto || 'Sem descrição'}
                </p>

                {/* Org */}
                <p className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-3">
                  <Building2 size={9} className="shrink-0 text-slate-300" />
                  <span className="truncate">{current.orgao}</span>
                </p>

                {/* Meta */}
                <div className="flex items-center gap-2 mb-3">
                  {current.valor && (
                    <div className="flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-600" />
                      <span className="text-xs font-black text-emerald-700">{formatValor(current.valor)}</span>
                    </div>
                  )}
                  {enc.texto && enc.texto !== 'Encerrado' && (
                    <div className={`flex items-center gap-1 ${enc.urgente ? 'rounded-full bg-red-50 px-2 py-0.5' : ''}`}>
                      <Clock size={10} className={enc.urgente ? 'text-red-500' : 'text-slate-400'} />
                      <span className={`text-xs font-medium ${enc.urgente ? 'font-black text-red-600' : 'text-slate-500'}`}>
                        {enc.urgente ? `Encerra em ${enc.texto}` : enc.texto}
                      </span>
                    </div>
                  )}
                </div>

                {/* Matches */}
                {(() => {
                  const seed = hashStr(current.id || 'x');
                  const count = 2 + (seed % 5);
                  const avatars = Array.from({ length: Math.min(count, 3) }, (_, i) => AVATAR_COLORS[(seed + i) % AVATAR_COLORS.length]);
                  return (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                      <div className="flex -space-x-1.5">
                        {avatars.map((c, i) => <div key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-white blur-[1.5px]`} />)}
                        <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                          <span className="text-[8px] font-black text-slate-400">+</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        <span className="font-bold text-slate-600">{count}</span> empresas com perfil
                      </span>
                      <span className="ml-auto rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                        match automático
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Indicador de paginação */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1.5">
              {pool.slice(0, Math.min(pool.length, 6)).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === idx % Math.min(pool.length, 6)
                      ? 'w-5 bg-emerald-500'
                      : 'w-1.5 bg-white/15'
                  }`}
                />
              ))}
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[9px] font-semibold text-white/35">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {pool.length} editais ativos
            </span>
          </div>
        </div>

        {/* Painel de análise */}
        <div
          className={`w-52 shrink-0 transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}
          style={{ paddingBottom: '28px' }}
        >
          <div className="mb-2 flex items-center gap-1.5 pl-1">
            <CornerDownRight size={11} className="text-white/30" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Gerada automaticamente</span>
          </div>
          <AnalysisPanel edital={current} />
        </div>

      </div>
      </div>
    </>
  );
}
