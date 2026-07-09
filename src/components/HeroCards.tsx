'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, Globe, Building2, Pencil, RefreshCw } from 'lucide-react';
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

function modShort(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))       return 'Pregão';
  if (m.includes('concorrência')) return 'Concorrência';
  if (m.includes('dispensa'))     return 'Dispensa';
  if (m.includes('credenciamento')) return 'Credenciamento';
  return mod.split(' ')[0] || 'Licitação';
}

function modColor(mod: string): { dot: string; text: string; accent: string } {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão'))         return { dot: 'bg-emerald-400', text: 'text-emerald-300', accent: 'border-emerald-400' };
  if (m.includes('concorrência'))   return { dot: 'bg-sky-400',     text: 'text-sky-300',      accent: 'border-sky-400' };
  if (m.includes('dispensa'))       return { dot: 'bg-amber-400',   text: 'text-amber-300',    accent: 'border-amber-400' };
  if (m.includes('credenciamento')) return { dot: 'bg-purple-400',  text: 'text-purple-300',   accent: 'border-purple-400' };
  return { dot: 'bg-slate-400', text: 'text-slate-300', accent: 'border-slate-500' };
}

// ── Análise simulada (determinística por ID) ──────────────────────────────
type Level = { label: string; color: string; bar: number };

function analise(id: string): { match: Level; risco: Level; competicao: Level; veredito: string } {
  const h = hashStr(id || 'x');
  const MATCH: Level[] = [
    { label: 'Muito alto', color: 'emerald', bar: 92 },
    { label: 'Alto',       color: 'emerald', bar: 74 },
    { label: 'Médio',      color: 'amber',   bar: 52 },
    { label: 'Baixo',      color: 'rose',    bar: 28 },
  ];
  const RISCO: Level[] = [
    { label: 'Baixo',  color: 'emerald', bar: 18 },
    { label: 'Médio',  color: 'amber',   bar: 52 },
    { label: 'Alto',   color: 'rose',    bar: 80 },
  ];
  const COMP: Level[] = [
    { label: 'Baixa',  color: 'emerald', bar: 22 },
    { label: 'Média',  color: 'amber',   bar: 55 },
    { label: 'Alta',   color: 'rose',    bar: 82 },
  ];
  const match     = MATCH[(h)     % 4];
  const risco     = RISCO[(h >>2) % 3];
  const competicao = COMP[(h >>4) % 3];
  const veredito  = match.bar >= 70 && risco.bar <= 52 ? 'Recomendado disputar' : match.bar >= 50 ? 'Vale analisar' : 'Baixa prioridade';
  return { match, risco, competicao, veredito };
}

function chipTone(color: string): string {
  if (color === 'emerald') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (color === 'amber')   return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
}

function veredictTone(v: string): string {
  if (v === 'Recomendado disputar') return 'bg-emerald-500/15 text-emerald-300';
  if (v === 'Vale analisar')        return 'bg-amber-500/15 text-amber-300';
  return 'bg-slate-500/15 text-slate-400';
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
  const anl     = current ? analise(current.id) : null;

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

  if (!current || !mod || !anl) {
    return (
      <div className="w-full">
        {tabBar}
        <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" style={{ minHeight: 220 }} />
      </div>
    );
  }

  const restantes = [next, further].filter((e): e is Edital => Boolean(e) && e.id !== current.id);

  return (
    <div className="w-full min-w-0">
      {tabBar}
      {editor}

      <div className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Item em destaque */}
        <div
          className={`min-w-0 border-l-[3px] ${mod.accent} p-4 sm:p-5 transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${mod.dot}`} />
            <span className={`shrink-0 text-[11px] font-bold ${mod.text}`}>{modShort(current.modalidade)}</span>
            {current.municipio && (
              <span className="ml-auto min-w-0 truncate text-[10px] text-slate-500">{current.municipio} · {current.uf}</span>
            )}
          </div>

          <p className="break-words text-sm font-semibold text-slate-100 leading-snug line-clamp-2 mb-1.5">
            {current.objeto || 'Sem descrição'}
          </p>

          <p className="truncate text-[11px] text-slate-500 mb-3">
            {current.orgao}
            {enc.texto && enc.texto !== 'Encerrado' ? ` · encerra em ${enc.texto}` : ''}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${chipTone(anl.match.color)}`}>
              CNAE {anl.match.label.toLowerCase()}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${chipTone(anl.risco.color)}`}>
              Jurídico {anl.risco.label.toLowerCase()}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${chipTone(anl.competicao.color)}`}>
              Concorrência {anl.competicao.label.toLowerCase()}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${veredictTone(anl.veredito)}`}>
              {anl.veredito}
            </span>
          </div>
        </div>

        {/* Próximos da fila, em formato compacto */}
        {restantes.map(item => {
          const m = modColor(item.modalidade);
          const t = encerraEm(item.data_encerramento).texto;
          return (
            <div key={item.id} className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 border-t border-white/5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.dot}`} />
              <span className="flex-1 min-w-0 truncate text-xs text-slate-400">{item.objeto || 'Sem descrição'}</span>
              {t && t !== 'Encerrado' && <span className="shrink-0 text-[10px] text-slate-600">{t}</span>}
            </div>
          );
        })}

        {/* Rodapé */}
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-t border-white/5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold text-slate-500">{pool.length} editais ativos agora</span>
          <div className="ml-auto flex items-center gap-1.5">
            {pool.slice(0, Math.min(pool.length, 6)).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === idx % Math.min(pool.length, 6) ? 'w-5 bg-emerald-500' : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
