'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapPin, Globe, Building2, RefreshCw, ExternalLink, Zap, Clock, TrendingUp, Users, Pencil } from 'lucide-react';
import { API_URL } from '@/lib/apiClient';

type Scope = 'nacional' | 'regional' | 'local';

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
  cnpj: string;
  ano: string | number;
  seq: string | number;
}

// ── Utilitários de data ────────────────────────────────────────────────────
function parseDateBR(s: string): Date | null {
  if (!s) return null;
  const FALLBACKS = ['verificaç', 'acesso via', 'a apurar', 'a definir', 'urgente', 'informado'];
  if (FALLBACKS.some(f => s.toLowerCase().includes(f))) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyy, hh = '00', min = '00'] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(s: string): string {
  const d = parseDateBR(s);
  if (!d) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min atrás`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
  return `${Math.floor(diff / 1440)}d atrás`;
}

/**
 * Timestamp de chegada no feed — usa a data real se for genuinamente histórica
 * (> 10min), caso contrário gera um timestamp escalonado pelo hash do ID.
 * Evita que todos os itens mostrem "agora" quando o PNCP publica em lote.
 */
function feedTimestamp(id: string, dataPub: string): string {
  const d = parseDateBR(dataPub);
  if (d) {
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff > 10) return timeAgo(dataPub); // data real confiável
  }
  // Escalonamento determinístico: cada edital tem sempre o mesmo tempo
  const h = Math.abs(hashStr(id || 'x'));
  const r = h % 100;
  if (r < 8)  return 'agora';
  if (r < 55) return `${3 + (h % 53)}min atrás`;
  const hrs  = 1 + (h % 4);
  const mins = (h >> 3) % 59;
  return mins > 0 ? `${hrs}h${mins}min atrás` : `${hrs}h atrás`;
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
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

// ── Hash determinístico para variar nº de matches por edital ─────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Tipo do post ──────────────────────────────────────────────────────────
type PostType = 'destaque' | 'urgente' | 'compacto' | 'padrao';

function tipoPost(e: Edital, idx: number): PostType {
  const { urgente } = encerraEm(e.data_encerramento);
  if (urgente) return 'urgente';
  if (e.valor && e.valor >= 500_000 && idx % 4 === 0) return 'destaque';
  if (idx % 5 === 3) return 'compacto';
  return 'padrao';
}

function dotStyle(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão')) return 'bg-emerald-500';
  if (m.includes('concorrência')) return 'bg-sky-500';
  if (m.includes('dispensa')) return 'bg-amber-400';
  if (m.includes('credenciamento')) return 'bg-purple-500';
  return 'bg-slate-300';
}

function badgeMod(mod: string): string {
  const m = mod?.toLowerCase() || '';
  if (m.includes('pregão')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (m.includes('concorrência')) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (m.includes('dispensa')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (m.includes('credenciamento')) return 'bg-purple-50 text-purple-700 border-purple-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
}

// ── Matches de empresas ───────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-200', 'bg-sky-200', 'bg-emerald-200',
  'bg-amber-200',  'bg-rose-200', 'bg-teal-200',
];

function MatchHint({ id }: { id: string }) {
  const seed = hashStr(id || 'x');
  const count = 2 + (seed % 5); // 2–6 empresas
  const avatars = Array.from({ length: Math.min(count, 3) }, (_, i) =>
    AVATAR_COLORS[(seed + i) % AVATAR_COLORS.length]
  );

  return (
    <a
      href="/login?view=register"
      onClick={e => e.stopPropagation()}
      className="flex items-center gap-1.5 group/match"
      title="Ver empresas com perfil para este edital"
    >
      {/* Avatares empilhados */}
      <div className="flex -space-x-1.5">
        {avatars.map((color, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full ${color} border-2 border-white blur-[1.5px] flex-shrink-0`}
          />
        ))}
        {/* Slot da empresa do visitante */}
        <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-black text-slate-400">+</span>
        </div>
      </div>
      <span className="text-[9px] text-slate-400 group-hover/match:text-emerald-600 transition-colors whitespace-nowrap">
        {count} empresas com perfil
      </span>
    </a>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────
type CardProps = { e: Edital };

function CardDestaque({ e }: CardProps) {
  const { texto: enc } = encerraEm(e.data_encerramento);
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl p-3.5 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp size={11} className="text-emerald-600" />
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Alto valor</span>
        {e.valor && (
          <span className="ml-auto text-xs font-black text-emerald-700">{formatValor(e.valor)}</span>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-3 mb-2.5">
        {e.objeto || 'Sem descrição'}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-slate-500 truncate">{e.orgao}</span>
          {e.municipio && <span className="text-[9px] text-slate-400 whitespace-nowrap">{e.municipio}·{e.uf}</span>}
          {enc && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Clock size={8} />{enc}</span>}
        </div>
        <MatchHint id={e.id} />
      </div>
    </div>
  );
}

function CardUrgente({ e }: CardProps) {
  const { texto: enc } = encerraEm(e.data_encerramento);
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-3 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Zap size={10} className="text-red-500" />
        <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Encerra em {enc}</span>
        {e.valor && <span className="ml-auto text-[10px] font-black text-red-600">{formatValor(e.valor)}</span>}
      </div>
      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-2">
        {e.objeto || 'Sem descrição'}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeMod(e.modalidade)}`}>
          {e.modalidade || 'Licitação'}
        </span>
        <span className="text-[9px] text-slate-400 truncate flex-1">{e.orgao}</span>
        <MatchHint id={e.id} />
      </div>
    </div>
  );
}

function CardPadrao({ e }: CardProps) {
  const { texto: enc, urgente } = encerraEm(e.data_encerramento);
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 flex-1">
          {e.objeto || 'Sem descrição'}
        </p>
        {e.valor && (
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">
            {formatValor(e.valor)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeMod(e.modalidade)}`}>
          {e.modalidade || 'Licitação'}
        </span>
        {e.municipio && (
          <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
            <MapPin size={8} />{e.municipio}·{e.uf}
          </span>
        )}
        <span className="text-[9px] text-slate-400 truncate flex-1">{e.orgao}</span>
        {enc && (
          <span className={`text-[9px] flex items-center gap-0.5 ${urgente ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
            <Clock size={8} />{enc}
          </span>
        )}
      </div>
      {/* Match row separado para dar destaque */}
      <div className="mt-2 pt-2 border-t border-slate-50">
        <MatchHint id={e.id} />
      </div>
    </div>
  );
}

function CardCompacto({ e }: CardProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 hover:border-slate-200 transition-all cursor-pointer">
      <div className="flex items-center gap-2.5">
        <div className={`w-1.5 h-9 rounded-full flex-shrink-0 ${dotStyle(e.modalidade)}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-1">{e.objeto || 'Sem descrição'}</p>
          <p className="text-[9px] text-slate-400 truncate mt-0.5">{e.orgao}{e.municipio ? ` · ${e.municipio}` : ''}</p>
        </div>
        {e.valor && (
          <span className="text-[10px] font-black text-slate-600 flex-shrink-0">{formatValor(e.valor)}</span>
        )}
      </div>
      <div className="mt-2 pl-4">
        <MatchHint id={e.id} />
      </div>
    </div>
  );
}

// ── UFs do Brasil ─────────────────────────────────────────────────────────
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

// ── Tabs ───────────────────────────────────────────────────────────────────
const TABS: { key: Scope; label: string; Icon: typeof Globe }[] = [
  { key: 'nacional', label: 'Nacional', Icon: Globe },
  { key: 'regional', label: 'Regional', Icon: Building2 },
  { key: 'local',    label: 'Local',    Icon: MapPin },
];

// ── Componente principal ──────────────────────────────────────────────────
export default function EditaisFeed() {
  const [scope, setScope]             = useState<Scope>('nacional');
  const [uf, setUf]                   = useState<string | null>(null);
  const [cidadeNome, setCidadeNome]   = useState<string | null>(null);
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [editais, setEditais]         = useState<Edital[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);

  // ── Editor de localização ─────────────────────────────────────────────
  const [editingLocation, setEditingLocation]     = useState(false);
  const [ufInput, setUfInput]                     = useState('');
  const [cidadeInput, setCidadeInput]             = useState('');
  const [municipioResults, setMunicipioResults]   = useState<Array<{ municipio_id: string; municipio_nome: string }>>([]);
  const [loadingMun, setLoadingMun]               = useState(false);
  const cidadeInputRef                            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(async d => {
        const ufDet  = d.region_code as string | undefined;
        const cidDet = d.city as string | undefined;
        if (ufDet) setUf(ufDet);
        if (ufDet && cidDet) {
          try {
            const res = await fetch(
              `${API_URL}/api/pncp/municipios?q=${encodeURIComponent(cidDet)}&uf=${ufDet}&limit=1`
            );
            if (res.ok) {
              const lista = await res.json();
              // Só aceita a cidade se o endpoint confirmar que ela existe na UF detectada
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

  const fetchEditais = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope, limit: '15' });
      if (scope !== 'nacional' && uf) params.set('uf', uf);
      if (scope === 'local' && municipioId) params.set('municipio_id', municipioId);
      const res = await fetch(`${API_URL}/api/pncp/feed?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEditais(json.data || []);
      setLastUpdate(new Date());
    } catch {
      setError('Não foi possível carregar os editais agora.');
    } finally {
      setLoading(false);
    }
  }, [scope, uf, municipioId]);

  useEffect(() => { fetchEditais(); }, [fetchEditais]);
  useEffect(() => {
    const t = setInterval(fetchEditais, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchEditais]);

  const buscarMunicipios = useCallback(async (q: string, ufQ: string) => {
    if (q.length < 2 || !ufQ) { setMunicipioResults([]); return; }
    setLoadingMun(true);
    try {
      const res = await fetch(`${API_URL}/api/pncp/municipios?q=${encodeURIComponent(q)}&uf=${ufQ}&limit=6`);
      if (res.ok) setMunicipioResults(await res.json());
    } catch { /* silent */ } finally { setLoadingMun(false); }
  }, []);

  const aplicarUF = (novaUF: string) => {
    setUf(novaUF);
    setUfInput('');
    setEditingLocation(false);
  };

  const aplicarMunicipio = (nome: string, id: string) => {
    if (ufInput) setUf(ufInput);   // sincroniza UF selecionada no editor
    setCidadeNome(nome);
    setMunicipioId(id);
    setCidadeInput('');
    setMunicipioResults([]);
    setEditingLocation(false);
  };

  const fecharEditor = () => {
    setEditingLocation(false);
    setCidadeInput('');
    setMunicipioResults([]);
  };

  return (
    <div className="flex flex-col h-full">

      {/* Tabs + refresh */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              disabled={key !== 'nacional' && !uf}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scope === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Icon size={11} />
              {label}
              {key === 'regional' && uf && (
                <span
                  className={`flex items-center gap-0.5 text-[9px] font-black cursor-pointer ${scope === key ? 'text-emerald-600' : 'text-slate-400'}`}
                  onClick={e => { e.stopPropagation(); setUfInput(uf); setEditingLocation(true); }}
                >
                  {uf} <Pencil size={7} className="opacity-60" />
                </span>
              )}
              {key === 'local' && uf && (
                <span
                  className={`flex shrink-0 items-center gap-0.5 text-[9px] font-black cursor-pointer max-w-[72px] ${
                    scope === key
                      ? cidadeNome ? 'text-emerald-600' : 'text-amber-500'
                      : 'text-slate-400'
                  }`}
                  onClick={e => { e.stopPropagation(); setUfInput(uf || ''); setEditingLocation(true); }}
                >
                  {cidadeNome
                    ? <span className="truncate">{cidadeNome}</span>
                    : <span className="italic">a definir</span>
                  }
                  <Pencil size={7} className="shrink-0 opacity-60" />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[9px] text-slate-400">
              {loading ? 'atualizando' : lastUpdate
                ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : 'ao vivo'}
            </span>
          </span>
          <button onClick={fetchEditais} disabled={loading} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Editor de localização ─────────────────────────────────────── */}
      {editingLocation && (scope === 'regional' || scope === 'local') && (
        <div className="mb-3 overflow-visible rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
          <div className="flex items-center gap-2">
            <MapPin size={11} className="shrink-0 text-emerald-600" />
            <select
              value={ufInput}
              onChange={e => {
                const novaUF = e.target.value;
                setUfInput(novaUF);
                setCidadeInput('');
                setMunicipioResults([]);
                // UF mudou → cidade anterior pode ser de outro estado, sempre invalida
                setCidadeNome(null);
                setMunicipioId(null);
                if (scope === 'regional') {
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

            {scope === 'local' && (
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

      {/* Linha do tempo */}
      <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 480 }}>
        {error && <p className="text-center py-10 text-sm text-slate-400">{error}</p>}

        {!error && loading && editais.length === 0 && (
          <div className="space-y-3">
            {[88, 60, 76, 60, 76].map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-1 flex-shrink-0" />
                  <div className="w-px bg-slate-100 flex-1 mt-1" />
                </div>
                <div className="flex-1 pb-3">
                  <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: h }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && editais.length === 0 && (
          <p className="text-center py-10 text-sm text-slate-400">Nenhum edital encontrado.</p>
        )}

        {editais.length > 0 && (
          <div className="space-y-0">
            {editais.map((e, i) => {
              const tipo  = tipoPost(e, i);
              const pub   = feedTimestamp(e.id, e.data_publicacao);
              const isLast = i === editais.length - 1;

              return (
                <div key={e.id || i} className="flex gap-3">
                  {/* Trilho */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 16 }}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-white ${dotStyle(e.modalidade)}`} />
                    {!isLast && <div className="w-px bg-slate-100 flex-1 mt-1" style={{ minHeight: 12 }} />}
                  </div>

                  {/* Card */}
                  <div className="flex-1 pb-3 min-w-0">
                    {pub && <p className="text-[9px] text-slate-400 mb-1">{pub}</p>}
                    {tipo === 'destaque' && <CardDestaque e={e} />}
                    {tipo === 'urgente'  && <CardUrgente  e={e} />}
                    {tipo === 'compacto' && <CardCompacto e={e} />}
                    {tipo === 'padrao'   && <CardPadrao   e={e} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[9px] text-slate-400">
          <Users size={10} />
          Cadastre sua empresa para aparecer nos matches
        </span>
        <a href="/login?redirect=/workspace" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
          Ver todos <ExternalLink size={11} />
        </a>
      </div>

    </div>
  );
}
