'use client';

/**
 * RadarAlertas.tsx
 * ─────────────────────────────────────────────────────────────────
 * Gerenciamento de alertas proativos do Radar PNCP.
 * O usuário configura: termo + UF + e recebe e-mail quando aparecem
 * novos editais correspondentes (processado pelo job às 07:00 BRT).
 */

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, MapPin, Search } from 'lucide-react';

interface Alerta {
  id: string;
  termo: string;
  uf: string | null;
  ativo: boolean;
  criado_em: string;
  ultimo_envio: string | null;
}

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Props {
  token: string;
}

export default function RadarAlertas({ token }: Props) {
  const [alertas, setAlertas]     = useState<Alerta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [termo, setTermo]         = useState('');
  const [uf, setUf]               = useState('');
  const [saving, setSaving]       = useState(false);
  const [notice, setNotice]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/alertas`, { headers });
      if (res.ok) setAlertas(await res.json());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termo.trim() || termo.trim().length < 3) {
      showNotice('error', 'O termo deve ter pelo menos 3 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/alertas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ termo: termo.trim(), uf: uf || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlertas(prev => [data, ...prev]);
        setTermo('');
        setUf('');
        setShowForm(false);
        showNotice('success', `Alerta "${data.termo}" criado! Você receberá e-mails quando aparecerem novos editais.`);
      } else {
        showNotice('error', data.detail || 'Erro ao criar alerta.');
      }
    } catch {
      showNotice('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const remover = async (id: string, termoAlerta: string) => {
    if (!confirm(`Remover alerta "${termoAlerta}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/alertas/${id}`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setAlertas(prev => prev.filter(a => a.id !== id));
        showNotice('success', 'Alerta removido.');
      }
    } catch { showNotice('error', 'Erro ao remover.'); }
  };

  const toggle = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/alertas/${id}/toggle`, { method: 'PATCH', headers });
      if (res.ok) {
        const updated: Alerta = await res.json();
        setAlertas(prev => prev.map(a => a.id === id ? updated : a));
      }
    } catch { showNotice('error', 'Erro ao atualizar.'); }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      {/* Toast */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {notice.msg}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-gradient-to-br from-white to-amber-50/40 border-b border-slate-100 p-5 md:p-6 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-amber-700 shadow-sm mb-2">
            <Bell className="h-3.5 w-3.5" />
            Monitor inteligente
          </div>
          <h2 className="text-lg font-black text-slate-900">Sinais críticos do PNCP</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Configure termos para receber oportunidades novas antes que elas virem urgência operacional.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition-colors shadow-sm"
        >
          <Plus size={14} />
          Novo Alerta
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <form onSubmit={criar} className="border-b border-slate-100 p-5 bg-amber-50/30">
          <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">Configurar novo alerta</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Termo */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={termo}
                onChange={e => setTermo(e.target.value)}
                placeholder="Ex: limpeza, vigilância, TI..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                required
                minLength={3}
              />
            </div>

            {/* UF */}
            <div className="relative sm:w-36">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={uf}
                onChange={e => setUf(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all appearance-none"
              >
                <option value="">Brasil (todos)</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Criar Alerta'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Você receberá um e-mail diário às 07h com os editais novos encontrados.</p>
        </form>
      )}

      {/* Lista de alertas */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-14 bg-slate-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Bell size={20} className="text-amber-400" />
            </div>
            <p className="text-sm font-black text-slate-700">Nenhum alerta configurado</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Crie um alerta para receber notificações de novos editais.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.map(a => (
              <div key={a.id} className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${a.ativo ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100 bg-slate-50/60 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-900 text-sm">"{a.termo}"</span>
                    {a.uf && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                        <MapPin size={9} /> {a.uf}
                      </span>
                    )}
                    {!a.uf && (
                      <span className="text-[10px] font-bold text-slate-400">Brasil inteiro</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Criado em {a.criado_em}
                    {a.ultimo_envio && ` · Último envio: ${a.ultimo_envio}`}
                    {!a.ultimo_envio && ' · Aguardando primeira execução'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggle(a.id)}
                    title={a.ativo ? 'Desativar' : 'Ativar'}
                    className="text-slate-400 hover:text-amber-600 transition-colors"
                  >
                    {a.ativo ? <ToggleRight size={22} className="text-amber-500" /> : <ToggleLeft size={22} />}
                  </button>
                  <button
                    onClick={() => remover(a.id, a.termo)}
                    title="Remover alerta"
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {alertas.length > 0 && (
          <p className="mt-4 text-[11px] text-slate-400 text-center">
            {alertas.length}/10 alertas · E-mails enviados diariamente às 07h00 BRT
          </p>
        )}
      </div>
    </div>
  );
}
