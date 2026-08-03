'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, Globe, Building2, Zap, TrendingUp, Pencil, RefreshCw } from 'lucide-react';
import { API_URL } from '@/lib/apiClient';

type Scope = 'nacional' | 'regional' | 'local';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Edital {
  id: string;
  objeto: string;
  orgao: string;
  uf: string;
  municipio: string;
  modalidade: string;
  valor: number | null;
  data_publicacao: string;
  data_encerramento: string;
}

// ── Utilitários (espelha EditaisFeed) ─────────────────────────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseDateBR(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function encerraEm(s: string): { texto: string; urgente: boolean } {
  const d = parseDateBR(s);
  if (!d) return { texto: '', urgente: false };
  const diff = Math.floor((d.getTime() - Date.now()) / 60000);
  if (diff < 0) return { texto: 'Encerrado', urgente: false };
  if (diff < 60) return { texto: `${diff}min`, urgente: true };
  const horas = Math.floor(diff / 60);
  if (diff < 1440) return { texto: `${horas}h`, urgente: horas <= 3 };
  return { texto: `${Math.floor(diff / 1440)}d`, urgente: false };
}

function formatValor(v: number | null): string {
  if (!v) return '';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

function feedTimestamp(id: string): string {
  const h = hashStr(id || 'x');
  const r = h % 100;
  if (r < 8)  return 'agora';
  if (r < 55) return `${3 + (h % 53)}min atrás`;
  const hrs  = 1 + (h % 4);
  const mins = (h >> 3) % 59;
  return mins > 0 ? `${hrs}h${mins}min atrás` : `${hrs}h atrás`;
}

const AVATAR_COLORS = [
  'bg-violet-200','bg-sky-200','bg-emerald-200',
  'bg-amber-200','bg-rose-200','bg-teal-200',
];

function dotColor(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))      return 'bg-emerald-500';
  if (m.includes('concorrência')) return 'bg-sky-500';
  if (m.includes('dispensa'))    return 'bg-amber-400';
  if (m.includes('credenciamento')) return 'bg-purple-500';
  return 'bg-slate-300';
}

function modBadge(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (m.includes('concorrência')) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (m.includes('dispensa'))    return 'bg-amber-50 text-amber-700 border-amber-100';
  if (m.includes('credenciamento')) return 'bg-purple-50 text-purple-700 border-purple-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

// ── Card individual ─────────────────────────────────────────────────────────
function HeroCard({ e, isNew }: { e: Edital; isNew: boolean }) {
  const seed   = hashStr(e.id || 'x');
  const count  = 2 + (seed % 5);
  const avatars = Array.from({ length: Math.min(count, 3) }, (_, i) =>
    AVATAR_COLORS[(seed + i) % AVATAR_COLORS.length]
  );
  const { texto: enc, urgente } = encerraEm(e.data_encerramento);
  const isHighValue = e.valor && e.valor >= 500_000;

  return (
    <div
      className={`
        rounded-xl border p-3 transition-all duration-300
        ${isNew
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
        }
        ${urgente ? '!border-red-100 !bg-red-50/60' : ''}
      `}
    >
      {/* Topo: urgente ou alto valor */}
      {urgente && (
        <div className="flex items-center gap-1 mb-1.5">
          <Zap size={9} className="text-red-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-red-500">
            Encerra em {enc}
          </span>
          {e.valor && (
            <span className="ml-auto text-[10px] font-black text-red-600">{formatValor(e.valor)}</span>
          )}
        </div>
      )}
      {!urgente && isHighValue && (
        <div className="flex items-center gap-1 mb-1.5">
          <TrendingUp size={9} className="text-emerald-600" />
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Alto valor</span>
          <span className="ml-auto text-[10px] font-black text-emerald-700">{formatValor(e.valor)}</span>
        </div>
      )}

      {/* Objeto */}
      <p className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2 mb-2">
        {e.objeto || 'Sem descrição'}
      </p>

      {/* Meta + Matches */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {e.modalidade && (
            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${modBadge(e.modalidade)}`}>
              {e.modalidade.replace(' - Eletrônico', '').replace('Eletrônico', '').trim()}
            </span>
          )}
          {e.municipio && (
            <span className="flex items-center gap-0.5 text-[9px] text-slate-400 truncate">
              <MapPin size={7} className="shrink-0" />
              {e.municipio}·{e.uf}
            </span>
          )}
          {enc && !urgente && (
            <span className="flex items-center gap-0.5 text-[9px] text-slate-400 shrink-0">
              <span>{enc}</span>
            </span>
          )}
        </div>

        {/* Avatares de empresas */}
        <a
          href="/login?view=register"
          className="flex items-center gap-1 shrink-0 group"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex -space-x-1.5">
            {avatars.map((color, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full ${color} border border-white blur-[1.5px]`}
              />
            ))}
            <div className="w-4 h-4 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
              <span className="text-[7px] font-black text-slate-400">+</span>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 group-hover:text-emerald-600 transition-colors">
            {count}
          </span>
        </a>
      </div>
    </div>
  );
}

// ── Skeleton loader ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 animate-pulse">
      <div className="h-3 bg-slate-100 rounded w-3/4 mb-1.5" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
      <div className="flex gap-2">
        <div className="h-4 bg-slate-100 rounded w-14" />
        <div className="h-4 bg-slate-100 rounded w-20" />
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
const VISIBLE_MAX = 4;
const CYCLE_MS    = 3800;
const INTRO_DELAY = 200;

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const TABS: { key: Scope; label: string; Icon: typeof Globe }[] = [
  { key: 'nacional', label: 'Nacional', Icon: Globe },
  { key: 'regional', label: 'Regional', Icon: Building2 },
  { key: 'local',    label: 'Local',    Icon: MapPin },
];

export default function HeroFeed() {
  const [scope, setScope]          = useState<Scope>('nacional');
  const [uf, setUf]                = useState<string | null>(null);
  const [cidadeNome, setCidadeNome] = useState<string | null>(null);
  const [municipioId, setMunicipioId] = useState<string | null>(null);

  // ── Editor de localização ───────────────────────────────────────────────
  const [editingLocation, setEditingLocation]   = useState(false);
  const [editingScope, setEditingScope]         = useState<'regional' | 'local' | null>(null);
  const [ufInput, setUfInput]                   = useState('');
  const [cidadeInput, setCidadeInput]           = useState('');
  const [municipioResults, setMunicipioResults] = useState<Array<{ municipio_id: string; municipio_nome: string }>>([]);
  const [loadingMun, setLoadingMun]             = useState(false);
  const cidadeInputRef                          = useRef<HTMLInputElement>(null);

  const buscarMunicipios = useCallback(async (q: string, ufQ: string) => {
    if (q.length < 2 || !ufQ) { setMunicipioResults([]); return; }
    setLoadingMun(true);
    try {
      const res = await fetch(`${API_URL}/api/pncp/municipios?q=${encodeURIComponent(q)}&uf=${ufQ}&limit=6`);
      if (res.ok) setMunicipioResults(await res.json());
    } catch { /* silent */ } finally { setLoadingMun(false); }
  }, []);

  const aplicarUF = (novaUF: string) => {
    setUf(novaUF); setUfInput(''); setEditingLocation(false); setEditingScope(null);
  };

  const aplicarMunicipio = (nome: string, id: string) => {
    if (ufInput) setUf(ufInput);
    setCidadeNome(nome); setMunicipioId(id);
    setCidadeInput(''); setMunicipioResults([]);
    setEditingLocation(false); setEditingScope(null);
  };

  const fecharEditor = () => {
    setEditingLocation(false); setEditingScope(null);
    setCidadeInput(''); setMunicipioResults([]);
  };

  const abrirEditor = (s: 'regional' | 'local', e: React.MouseEvent) => {
    e.stopPropagation();
    setUfInput(uf || '');
    setEditingScope(s);
    setEditingLocation(true);
  };

  // ── Feed state ───────────────────────────────────────────────────────────
  const [pool, setPool]             = useState<Edital[]>([]);
  const [visible, setVisible]       = useState<Edital[]>([]);
  const [newestId, setNewestId]     = useState<string | null>(null);
  const [badge, setBadge]           = useState(false);
  const [entryIdx, setEntryIdx]     = useState(-1);
  const cursor                      = useRef(VISIBLE_MAX);
  const loaded                      = useRef(false);
  const cycleRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

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
            const res = await fetch(
              `${API_URL}/api/pncp/municipios?q=${encodeURIComponent(cidDet)}&uf=${ufDet}&limit=1`
            );
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

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ scope, limit: '20' });
      if (scope !== 'nacional' && uf) params.set('uf', uf);
      if (scope === 'local' && municipioId) params.set('municipio_id', municipioId);
      const res = await fetch(`${API_URL}/api/pncp/feed?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      const data: Edital[] = json.data || [];
      setPool(data);
    } catch {}
  }, [scope, uf, municipioId]);

  // Refetch quando scope/localização mudar; reinicia animações
  useEffect(() => {
    loaded.current = false;
    cursor.current = VISIBLE_MAX;
    setVisible([]);
    setNewestId(null);
    setEntryIdx(-1);
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
    fetchData();
  }, [fetchData]);

  // Entrada escalonada ao carregar
  useEffect(() => {
    if (pool.length === 0 || loaded.current) return;
    loaded.current = true;
    const initial = pool.slice(0, VISIBLE_MAX);
    setVisible(initial);
    // Anima entrada card a card
    let i = 0;
    const tick = () => {
      setEntryIdx(i);
      i++;
      if (i < VISIBLE_MAX) setTimeout(tick, INTRO_DELAY);
    };
    tick();
  }, [pool]);

  // Ciclo automático após entrada
  useEffect(() => {
    if (pool.length === 0) return;
    // Espera a entrada terminar antes de começar o ciclo
    const startDelay = VISIBLE_MAX * INTRO_DELAY + 1000;
    const t = setTimeout(() => {
      cycleRef.current = setInterval(() => {
        const next = pool[cursor.current % pool.length];
        cursor.current++;
        setNewestId(next.id);
        setVisible(prev => [next, ...prev.slice(0, VISIBLE_MAX - 1)]);
        setBadge(true);
        setTimeout(() => setBadge(false), 2200);
      }, CYCLE_MS);
    }, startDelay);
    return () => {
      clearTimeout(t);
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, [pool]);

  return (
    <>
      <style>{`
        @keyframes heroSlideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePop {
          0%  { opacity: 0; transform: scale(0.6) translateX(4px); }
          25% { opacity: 1; transform: scale(1.05) translateX(0); }
          75% { opacity: 1; }
          100%{ opacity: 0; }
        }
        .hero-slide-in { animation: heroSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-fade-in  { animation: heroFadeIn  0.4s ease both; }
        .badge-pop     { animation: badgePop 2.2s ease both; }
      `}</style>

      {/* Cabeçalho: abas + live indicator */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-xl">
          {TABS.map(({ key, label, Icon }) => {
            const disabled = key !== 'nacional' && !uf;
            const active   = scope === key;
            return (
              <button
                key={key}
                onClick={() => !disabled && setScope(key)}
                disabled={disabled}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Icon size={10} />
                {label}
                {key === 'regional' && uf && (
                  <span
                    className={`flex items-center gap-0.5 text-[9px] font-black cursor-pointer ${active ? 'text-emerald-600' : 'text-slate-400'}`}
                    onClick={e => abrirEditor('regional', e)}
                  >
                    {uf} <Pencil size={7} className="opacity-60" />
                  </span>
                )}
                {key === 'local' && uf && (
                  <span
                    className={`flex items-center gap-0.5 text-[9px] font-black cursor-pointer max-w-[60px] truncate ${
                      active ? (cidadeNome ? 'text-emerald-600' : 'text-amber-500') : 'text-slate-400'
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

        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="badge-pop rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black text-white">
              +1 novo
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[9px] font-medium text-slate-400">ao vivo</span>
          </span>
        </div>
      </div>

      {/* Editor de localização */}
      {editingLocation && (editingScope === 'regional' || editingScope === 'local') && (
        <div className="mb-3 overflow-visible rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
          <div className="flex items-center gap-2">
            <MapPin size={11} className="shrink-0 text-emerald-600" />
            <select
              value={ufInput}
              onChange={e => {
                const novaUF = e.target.value;
                setUfInput(novaUF);
                setCidadeInput(''); setMunicipioResults([]);
                setCidadeNome(null); setMunicipioId(null);
                if (editingScope === 'regional') {
                  aplicarUF(novaUF);
                } else {
                  setTimeout(() => cidadeInputRef.current?.focus(), 30);
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Estado</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
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
                  className={`w-full rounded-lg border px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none transition-colors ${
                    ufInput
                      ? 'border-emerald-300 bg-white focus:border-emerald-500 ring-1 ring-emerald-100'
                      : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                  }`}
                />
                {loadingMun && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <RefreshCw size={9} className="animate-spin text-slate-400" />
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

            <button
              onClick={fecharEditor}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Lista de cards */}
      <div className="flex flex-col gap-2.5">
        {visible.length === 0
          ? Array.from({ length: VISIBLE_MAX }).map((_, i) => <Skeleton key={i} />)
          : visible.map((e, i) => {
              const isJustArrived = i === 0 && e.id === newestId;
              // entrada escalonada no carregamento inicial
              const isEntryCard   = !newestId && i <= entryIdx;
              return (
                <div
                  key={e.id}
                  className={
                    isJustArrived ? 'hero-slide-in'
                    : isEntryCard  ? 'hero-fade-in'
                    : ''
                  }
                  style={
                    isEntryCard
                      ? { animationDelay: `${i * INTRO_DELAY}ms` }
                      : undefined
                  }
                >
                  {/* Linha do tempo lateral */}
                  <div className="flex gap-2.5">
                    <div className="flex flex-col items-center shrink-0" style={{ width: 14 }}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ring-2 ring-white ${dotColor(e.modalidade)} ${isJustArrived ? 'animate-ping' : ''}`} />
                      {i < visible.length - 1 && (
                        <div className="w-px bg-slate-100 flex-1 mt-1" style={{ minHeight: 10 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-[9px] text-slate-400 mb-1">{feedTimestamp(e.id)}</p>
                      <HeroCard e={e} isNew={isJustArrived} />
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Rodapé */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[9px] text-slate-400">
          Cadastre sua empresa para ver matches
        </span>
        <a
          href="/login?redirect=/workspace"
          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          Ver todos →
        </a>
      </div>
    </>
  );
}
