'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  SlidersHorizontal, Sparkles, Plus, Trash2, ChevronDown,
  CheckCircle2, Circle, Save, RotateCcw, AlertTriangle,
  HardHat, Laptop, HeartPulse, Wrench, BarChart3,
  Package, DraftingCompass, Truck, UtensilsCrossed, GraduationCap, Radio, Megaphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/apiClient';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Parametro {
  id: string;
  nome: string;
  ativo: boolean;
  peso: 'alto' | 'medio' | 'baixo';
}

interface ParametrosData {
  setor: string | null;
  parametros: Parametro[];
}

interface SetorSugerido {
  setor: string;
  motivo: string;
  origem: 'codigo' | 'texto';
}

// ⚠️ AQUI FICA SÓ A APRESENTAÇÃO DO SETOR — RÓTULO, ÍCONE, COR.
// Os ~60 critérios de cada template moravam neste arquivo, em
// `TEMPLATES_LOCAIS`, e OUTRA cópia idêntica morava em
// `router_parametros.py`. A rota `GET /api/parametros/templates` existia e
// nunca era chamada: a cópia do backend era código morto e a do front era a
// viva, então qualquer correção feita no lugar "certo" não chegaria à tela.
// Agora o conteúdo vem da rota; o que sobra aqui é o que é genuinamente de
// interface e não tem por que existir no servidor.
// ⚠️ A ORDEM É DE FREQUÊNCIA NO PNCP, NÃO ALFABÉTICA. Fornecimento de bens vem
// primeiro porque pregão de aquisição é o que mais aparece; publicidade vem por
// último porque é o mais raro. Com doze opções, ordenar por nome faria a pessoa
// varrer a lista inteira para achar o caso comum.
// ⚠️ E `key` TEM DE BATER COM `TEMPLATES` no backend: quem escolhe aqui pede a
// lista de critérios de lá pela chave. `test_setor_por_cnae.py` trava o
// contrato do lado do servidor.
const SETORES: { key: string; label: string; icon: LucideIcon; iconBg: string; iconColor: string }[] = [
  { key: 'fornecimento', label: 'Fornecimento de Bens',      icon: Package,          iconBg: 'bg-teal-100',    iconColor: 'text-teal-700' },
  { key: 'servicos',     label: 'Serviços Gerais',           icon: Wrench,           iconBg: 'bg-slate-200',   iconColor: 'text-slate-700' },
  { key: 'construcao',   label: 'Construção & Obras',        icon: HardHat,          iconBg: 'bg-amber-100',   iconColor: 'text-amber-700' },
  { key: 'ti',           label: 'Tecnologia da Informação',  icon: Laptop,           iconBg: 'bg-sky-100',     iconColor: 'text-sky-700' },
  { key: 'saude',        label: 'Saúde & Farmácia',          icon: HeartPulse,       iconBg: 'bg-rose-100',    iconColor: 'text-rose-700' },
  { key: 'engenharia',   label: 'Engenharia & Arquitetura',  icon: DraftingCompass,  iconBg: 'bg-orange-100',  iconColor: 'text-orange-700' },
  { key: 'transporte',   label: 'Transporte & Logística',    icon: Truck,            iconBg: 'bg-cyan-100',    iconColor: 'text-cyan-700' },
  { key: 'alimentacao',  label: 'Alimentação & Nutrição',    icon: UtensilsCrossed,  iconBg: 'bg-lime-100',    iconColor: 'text-lime-700' },
  { key: 'educacao',     label: 'Educação & Treinamento',    icon: GraduationCap,    iconBg: 'bg-violet-100',  iconColor: 'text-violet-700' },
  { key: 'telecom',      label: 'Telecom & Conectividade',   icon: Radio,            iconBg: 'bg-blue-100',    iconColor: 'text-blue-700' },
  { key: 'consultoria',  label: 'Consultoria',               icon: BarChart3,        iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-700' },
  { key: 'publicidade',  label: 'Publicidade & Comunicação', icon: Megaphone,        iconBg: 'bg-fuchsia-100', iconColor: 'text-fuchsia-700' },
];

type Peso = 'alto' | 'medio' | 'baixo';
const PESO_CONFIG = {
  alto:  { label: 'Crítico',    color: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-400' },
  medio: { label: 'Importante', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  baixo: { label: 'Desejável',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ParametrizacaoPanel() {
  const [data, setData]           = useState<ParametrosData>({ setor: null, parametros: [] });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [novoNome, setNovoNome]   = useState('');
  const [novoPeso, setNovoPeso]   = useState<Peso>('medio');
  const [setorOpen, setSetorOpen] = useState(false);
  const [templates, setTemplates] = useState<Record<string, Parametro[]> | null>(null);
  const [sugestao, setSugestao]   = useState<SetorSugerido | null>(null);
  const [erro, setErro]           = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── Carrega parâmetros salvos + templates + sugestão de setor ─────────
  useEffect(() => {
    Promise.all([
      apiFetch(`${API_URL}/api/parametros`).then(r => r.json()).catch(() => null),
      apiFetch(`${API_URL}/api/parametros/templates`)
        .then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([params, cat]) => {
      setData(params && params.parametros ? params : { setor: null, parametros: [] });
      if (cat?.templates) {
        setTemplates(cat.templates);
        setSugestao(cat.setor_sugerido || null);
      } else {
        // ⚠️ SEM CÓPIA LOCAL DE RESERVA, DE PROPÓSITO. Um fallback embutido
        // aqui recriaria a duplicação que acabamos de remover, e a cópia de
        // reserva envelheceria justamente por só ser usada quando ninguém
        // está olhando. Falhar visível é melhor que servir template velho.
        setErro('Não foi possível carregar os templates de setor.');
      }
      setLoading(false);
    });
  }, []);

  // ── Aplica template de setor ──────────────────────────────────────────
  const aplicarTemplate = useCallback((setorKey: string) => {
    const tmpl = templates?.[setorKey] || [];
    if (!tmpl.length) {
      setErro('Template indisponível. Recarregue a página.');
      return;
    }
    setData({
      setor: setorKey,
      parametros: tmpl.map(p => ({ ...p, id: p.id || uuid(), ativo: true })),
    });
    setSetorOpen(false);
    setSaved(false);
    setErro(null);
  }, [templates]);

  // ── Toggle ativo/inativo ──────────────────────────────────────────────
  const toggleAtivo = (id: string) => {
    setData(prev => ({
      ...prev,
      parametros: prev.parametros.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p),
    }));
    setSaved(false);
  };

  // ── Mudar peso ────────────────────────────────────────────────────────
  const mudarPeso = (id: string, peso: 'alto' | 'medio' | 'baixo') => {
    setData(prev => ({
      ...prev,
      parametros: prev.parametros.map(p => p.id === id ? { ...p, peso } : p),
    }));
    setSaved(false);
  };

  // ── Remover ───────────────────────────────────────────────────────────
  const remover = (id: string) => {
    setData(prev => ({ ...prev, parametros: prev.parametros.filter(p => p.id !== id) }));
    setSaved(false);
  };

  // ── Adicionar novo ────────────────────────────────────────────────────
  const adicionarNovo = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setData(prev => ({
      ...prev,
      parametros: [...prev.parametros, { id: uuid(), nome, ativo: true, peso: novoPeso }],
    }));
    setNovoNome('');
    setSaved(false);
    addInputRef.current?.focus();
  };

  // ── Salvar ────────────────────────────────────────────────────────────
  const salvar = async () => {
    setSaving(true);
    setErro(null);
    try {
      const res = await apiFetch(`${API_URL}/api/parametros`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      // ⚠️ `fetch` NÃO REJEITA EM 4xx/5xx — E ESTA LINHA FALTAVA.
      // O `try/catch` só pegava queda de rede. Um 401, um 404 de usuário ou um
      // 500 caíam no caminho de sucesso: `setSaved(true)`, "Critérios salvos"
      // na tela, e nada gravado no banco.
      //
      // Não é hipótese. `analise_parametros` deste usuário está `{}` no Mongo
      // enquanto a tela exibia "Template aplicado · 6 critérios · 6 ativos".
      // Salvamento que mente é pior que salvamento que falha: a pessoa fecha a
      // aba confiante, e a próxima análise roda sem critério nenhum — em
      // silêncio, porque nada mais volta a avisar.
      if (!res.ok) {
        const detalhe = await res.json().catch(() => null);
        throw new Error(detalhe?.detail || `Erro ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaved(false);
      setErro(e instanceof Error ? e.message : 'Erro ao salvar critérios.');
    } finally {
      setSaving(false);
    }
  };

  const setor = SETORES.find(s => s.key === data.setor);
  const ativos   = data.parametros.filter(p => p.ativo).length;
  const inativos = data.parametros.filter(p => !p.ativo).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-sm">Carregando parâmetros...</div>
      </div>
    );
  }

  return (
    /* ⚠️ TINHA `max-w-2xl mx-auto` — 672px, centralizado. Mesmo travamento do
       Radar PNCP e do feed de Sugestões: o bloco centralizava e não acompanhava
       a coluna. Esta tela não foi citada no relato, mas tinha exatamente o
       mesmo defeito das outras duas — deixar só ela travada recriaria a
       inconsistência que o ajuste veio remover. */
    <div className="w-full p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={20} className="text-emerald-600" />
            <h2 className="text-xl font-black text-slate-900">Critérios de Avaliação</h2>
          </div>
          <p className="text-sm text-slate-500">
            Configure o que a IA deve avaliar em cada edital. Ative, desative ou ajuste o peso de cada critério.
          </p>
        </div>

        {/* ⚠️ AQUI FICAVA "IA VAI SUGERIR AJUSTES", QUE NÃO EXISTIA.
            Um `grep` por qualquer mecanismo de sugestão de critério no backend
            devolvia nada: era um selo verde com ícone de brilho prometendo uma
            funcionalidade que ninguém tinha escrito. Selo decorativo que promete
            comportamento é pior que nenhum selo — cria a expectativa de que os
            pesos vão se ajustar sozinhos, e a pessoa não mexe neles esperando
            uma correção que nunca chega.
            No lugar dele, o número real de critérios ativos. */}
        {data.parametros.length > 0 && (
          <div className="flex-shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-wider">
            {ativos} ativo{ativos === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {/* ⚠️ ERRO VISÍVEL, NÃO `alert()` NEM SILÊNCIO. O salvamento antes dizia
          "salvo" mesmo quando o servidor recusava — ver o comentário em
          `salvar()`. Se algo falhar, tem de ficar na tela. */}
      {erro && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm font-semibold text-red-800">{erro}</p>
        </div>
      )}

      {/* Sugestão de setor a partir do CNAE já cadastrado */}
      {/* ⚠️ SUGERE E EXPLICA — NÃO APLICA SOZINHO. A empresa pode ter CNAE de
          uma coisa e disputar licitação de outra, o que é comum e legítimo. E
          aplicar template automaticamente sobrescreveria critérios já
          configurados: destruir trabalho alheio para economizar um clique. */}
      {sugestao && data.setor !== sugestao.setor && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <Sparkles size={15} className="shrink-0 text-emerald-600" />
          <p className="flex-1 min-w-[200px] text-sm text-emerald-900">
            <strong className="font-black">
              {SETORES.find(s => s.key === sugestao.setor)?.label || sugestao.setor}
            </strong>{' '}
            <span className="text-emerald-700">{sugestao.motivo}</span>
          </p>
          <button
            onClick={() => aplicarTemplate(sugestao.setor)}
            className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-emerald-700"
          >
            {data.parametros.length ? 'Substituir pelo template' : 'Usar este template'}
          </button>
        </div>
      )}

      {/* Seletor de setor / template */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Carregar template por setor
        </p>
        <div className="relative">
          <button
            onClick={() => setSetorOpen(p => !p)}
            className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300 transition-colors"
          >
            {setor ? (
              <span className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${setor.iconBg}`}>
                  <setor.icon size={14} className={setor.iconColor} strokeWidth={2.2} />
                </span>
                {setor.label}
              </span>
            ) : (
              <span className="text-slate-400">Escolher setor...</span>
            )}
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${setorOpen ? 'rotate-180' : ''}`} />
          </button>
          {setorOpen && (
            /* ⚠️ ROLAGEM VIROU OBRIGATÓRIA AO PASSAR DE 5 PARA 12 OPÇÕES.
               Com `overflow-hidden` e sem teto, a lista fica com ~550px: em
               notebook ela passava do fim da janela e os últimos setores —
               justamente os novos — ficavam inalcançáveis, sem barra e sem
               indício de que existiam. */
            <div className="absolute z-20 mt-1 max-h-[min(60vh,20rem)] w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-lg">
              {SETORES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => aplicarTemplate(s.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-emerald-50 transition-colors text-left ${data.setor === s.key ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.iconBg}`}>
                      <Icon size={14} className={s.iconColor} strokeWidth={2.2} />
                    </span>
                    {s.label}
                    {data.setor === s.key && <CheckCircle2 size={14} className="ml-auto text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {data.setor && (
          <p className="mt-2 text-[11px] text-slate-400">
            Template aplicado. Personalize os critérios abaixo.
          </p>
        )}
      </div>

      {/* Contador */}
      {data.parametros.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-bold text-slate-800">{data.parametros.length} critérios</span>
          <span className="text-emerald-600 font-semibold">· {ativos} ativos</span>
          {inativos > 0 && <span className="text-slate-400">· {inativos} inativos</span>}
        </div>
      )}

      {/* Lista de parâmetros */}
      {data.parametros.length > 0 ? (
        <div className="space-y-2">
          {data.parametros.map(p => {
            const cfg = PESO_CONFIG[p.peso];
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-all ${
                  p.ativo ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-50'
                }`}
              >
                {/* Toggle */}
                <button onClick={() => toggleAtivo(p.id)} className="flex-shrink-0">
                  {p.ativo
                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                    : <Circle size={18} className="text-slate-300" />
                  }
                </button>

                {/* Nome */}
                <span className={`flex-1 text-sm ${p.ativo ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}`}>
                  {p.nome}
                </span>

                {/* Seletor de peso */}
                <div className="flex gap-1">
                  {(Object.keys(PESO_CONFIG) as ('alto' | 'medio' | 'baixo')[]).map(k => (
                    <button
                      key={k}
                      onClick={() => mudarPeso(p.id, k)}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md border transition-all ${
                        p.peso === k ? PESO_CONFIG[k].color : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {PESO_CONFIG[k].label}
                    </button>
                  ))}
                </div>

                {/* Remover */}
                <button
                  onClick={() => remover(p.id)}
                  className="flex-shrink-0 p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
          Nenhum critério configurado. Carregue um template ou adicione manualmente.
        </div>
      )}

      {/* Adicionar novo critério */}
      <div className="flex gap-2">
        <input
          ref={addInputRef}
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionarNovo()}
          placeholder="Adicionar critério personalizado..."
          className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder:text-slate-400"
        />
        {/* Peso do novo */}
        <select
          value={novoPeso}
          onChange={e => setNovoPeso(e.target.value as 'alto' | 'medio' | 'baixo')}
          className="text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 text-slate-600 bg-white"
        >
          <option value="alto">Crítico</option>
          <option value="medio">Importante</option>
          <option value="baixo">Desejável</option>
        </select>
        <button
          onClick={adicionarNovo}
          disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          Adicionar
        </button>
      </div>

      {/* Salvar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Os critérios ativos serão usados automaticamente nas próximas análises.
        </p>
        <button
          onClick={salvar}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            saved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
          }`}
        >
          {saved ? (
            <><CheckCircle2 size={14} /> Salvo!</>
          ) : saving ? (
            <><RotateCcw size={14} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={14} /> Salvar critérios</>
          )}
        </button>
      </div>

    </div>
  );
}
