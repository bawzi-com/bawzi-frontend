'use client';

/**
 * RadarAlertas.tsx
 * ─────────────────────────────────────────────────────────────────
 * A tela de Alertas: TODOS os sinais que o sistema emite, cada um com
 * um interruptor, e o cadastro de palavras-chave dentro do sinal a que
 * ele pertence.
 *
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️ ANTES: UM TIPO NA TELA, DEZ NO SINO
 * ═══════════════════════════════════════════════════════════════════
 * Esta tela mostrava só "editais por palavra-chave" e chamava a si mesma
 * de "Alertas". O sistema emite dez tipos de aviso (ver
 * `backend/app/services/catalogo_alertas.py`) — disputas que vão abrir,
 * contratos vencendo, resultado homologado, edital que mudou. Nenhum
 * aparecia aqui.
 *
 * Isso quebrava dos dois lados. Quem achava o sino ruidoso não tinha
 * onde calar. E quem precisava de um sinal específico não descobria que
 * ele já existia — o produto fazia o trabalho e não recebia o crédito.
 *
 * ⚠️ O CADASTRO DE TERMOS NÃO VIROU OUTRA TELA. Ele mora DENTRO do card
 * do tipo "Editais por palavra-chave", porque é a configuração daquele
 * sinal e de nenhum outro. Separar em duas telas obrigaria a pessoa a
 * entender que "o alerta" e "os termos do alerta" são coisas distintas
 * em lugares distintos — e ninguém entende isso na primeira vez.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, MapPin, Search,
  AlertTriangle, Clock, Loader2, Info,
} from 'lucide-react';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

interface Alerta {
  id: string;
  termo: string;
  uf: string | null;
  ativo: boolean;
  criado_em: string;
  ultimo_envio: string | null;
  ultima_verificacao?: string | null;
  ultimo_resultado?: number | null;
  ultimo_erro?: string | null;
  redundante_com?: string | null;
}

interface TipoAlerta {
  tipo: string;
  nome: string;
  descricao: string;
  porque: string;
  quando: string;
  origem: string;
  grupo: string;
  configuravel?: boolean;
  ativo: boolean;
}

interface GrupoAlerta {
  id: string;
  nome: string;
  subtitulo: string;
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
  const [alertas, setAlertas]   = useState<Alerta[]>([]);
  const [tipos, setTipos]       = useState<TipoAlerta[]>([]);
  const [grupos, setGrupos]     = useState<GrupoAlerta[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [termo, setTermo]       = useState('');
  const [uf, setUf]             = useState('');
  const [saving, setSaving]     = useState(false);
  const [salvandoTipo, setSalvandoTipo] = useState<string | null>(null);
  const [notice, setNotice]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [rAlertas, rCatalogo] = await Promise.all([
        apiFetch(`${API_URL}/api/alertas`),
        apiFetch(`${API_URL}/api/alertas/catalogo`),
      ]);
      if (rAlertas.ok) setAlertas(await rAlertas.json());
      if (rCatalogo.ok) {
        const c = await rCatalogo.json();
        setTipos(c.tipos || []);
        setGrupos(c.grupos || []);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * ⚠️ SALVA NA HORA, E VOLTA ATRÁS SE FALHAR.
   * Sem o rollback, uma requisição que falha deixa o interruptor
   * desligado na tela e o aviso ligado no servidor — a pessoa acha que
   * silenciou, continua recebendo, e conclui que a tela não funciona.
   * Um botão "Salvar" resolveria também, mas custa um passo em algo que
   * é uma escolha por vez.
   */
  const alternarTipo = async (t: TipoAlerta) => {
    const anterior = tipos;
    const novos = tipos.map(x => x.tipo === t.tipo ? { ...x, ativo: !x.ativo } : x);
    setTipos(novos);
    setSalvandoTipo(t.tipo);
    try {
      const res = await apiFetch(`${API_URL}/api/alertas/preferencias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Mapa COMPLETO — o backend não aceita delta (ausência = ligado).
        body: JSON.stringify({
          tipos: Object.fromEntries(novos.map(x => [x.tipo, x.ativo])),
        }),
      });
      if (!res.ok) throw new Error('falhou');
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setTipos(anterior);
      showNotice('error', 'Não deu para salvar. Nada mudou.');
    } finally {
      setSalvandoTipo(null);
    }
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termo.trim() || termo.trim().length < 3) {
      showNotice('error', 'O termo deve ter pelo menos 3 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/api/alertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termo: termo.trim(), uf: uf || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlertas(prev => [data, ...prev]);
        setTermo('');
        setUf('');
        setShowForm(false);
        showNotice('success', `Termo "${data.termo}" adicionado ao radar.`);
      } else {
        showNotice('error', data.detail || 'Erro ao criar alerta.');
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      showNotice('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const remover = async (id: string, termoAlerta: string) => {
    if (!confirm(`Remover o termo "${termoAlerta}"?`)) return;
    try {
      const res = await apiFetch(`${API_URL}/api/alertas/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setAlertas(prev => prev.filter(a => a.id !== id));
        showNotice('success', 'Termo removido.');
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      showNotice('error', 'Erro ao remover.');
    }
  };

  const toggle = async (id: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/alertas/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated: Alerta = await res.json();
        setAlertas(prev => prev.map(a => a.id === id ? updated : a));
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      showNotice('error', 'Erro ao atualizar.');
    }
  };

  const ligados = tipos.filter(t => t.ativo).length;

  // ── Cadastro de termos: vive dentro do card do tipo configurável ──────────
  const radarLigado = tipos.find(t => t.tipo === 'radar_alerta')?.ativo ?? true;

  /**
   * ⚠️ DESLIGADO, O CADASTRO SOME — MAS NÃO EM SILÊNCIO.
   * Mostrar a lista de termos embaixo de um interruptor desligado é oferecer
   * um formulário que não produz nada: a pessoa cadastra "vigilância" e espera
   * avisos que ninguém vai mandar. Então o painel inteiro (botão, formulário,
   * lista) sai da tela.
   *
   * O que NÃO pode sair é a informação de que os termos continuam lá. Sumir com
   * dois termos cadastrados sem dizer nada faz o desligamento parecer exclusão,
   * e ninguém desliga um recurso achando que vai perder o que cadastrou. Fica
   * uma linha com a contagem — o suficiente para o gesto ser reversível na
   * cabeça de quem clica.
   */
  const cadastroDeTermos = !radarLigado ? (
    alertas.length === 0 ? null : (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
          <Info size={13} className="mt-px shrink-0 text-slate-400" />
          {alertas.length === 1
            ? '1 termo continua salvo e pausado.'
            : `${alertas.length} termos continuam salvos e pausados.`}
          {' '}Ligue o aviso para ver e editar.
        </p>
      </div>
    )
  ) : (
    <div className="mt-4 pt-4 border-t border-amber-100/70">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
          Seus termos ({alertas.length}/10)
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-[11px] transition-colors"
        >
          <Plus size={12} />
          Novo termo
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={termo}
                onChange={e => setTermo(e.target.value)}
                placeholder="Ex: limpeza, vigilância, TI..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                required
                minLength={3}
              />
            </div>
            <div className="relative sm:w-32">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={uf}
                onChange={e => setUf(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all appearance-none"
              >
                <option value="">Brasil</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-[11px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg text-[11px] hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Um termo sem UF cobre o Brasil inteiro — e torna desnecessário o
            mesmo termo por estado.
          </p>
        </form>
      )}

      {alertas.length === 0 ? (
        <p className="py-4 text-center text-xs font-semibold text-slate-400">
          Nenhum termo cadastrado. Sem termos, este sinal não tem o que procurar.
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map(a => (
            <div
              key={a.id}
              className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all ${
                a.ativo
                  ? 'border-amber-100 bg-white'
                  : 'border-slate-100 bg-slate-50/70 opacity-70'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-slate-900 text-sm">&ldquo;{a.termo}&rdquo;</span>
                  {a.uf ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                      <MapPin size={9} /> {a.uf}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">Brasil inteiro</span>
                  )}
                </div>

                {/* ⚠️ "ÚLTIMA VERIFICAÇÃO" ANTES DE "ÚLTIMO ENVIO".
                    A tela mostrava só o envio, que só avança quando um e-mail
                    SAI. Parado há semanas, ele tinha duas leituras opostas —
                    nada novo apareceu, ou o envio está quebrado — e nenhuma
                    informação distinguia. A verificação é o que prova que o
                    sistema olhou. */}
                {/* ⚠️ "AINDA NÃO VERIFICADO" EM CIMA DE "ÚLTIMO E-MAIL: 02/07"
                    ERA UMA CONTRADIÇÃO A DUAS LINHAS DE DISTÂNCIA.
                    O alerta foi verificado, sim — e chegou a mandar e-mail. O
                    que não existe é o REGISTRO, porque o campo
                    `ultima_verificacao` nasceu depois desses alertas e só
                    passa a ser gravado na próxima execução do job. Dizer "não
                    verificado" transformava um campo novo em acusação de
                    sistema parado. */}
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {a.ultima_verificacao
                    ? <>Verificado em {a.ultima_verificacao}
                        {typeof a.ultimo_resultado === 'number' &&
                          ` · ${a.ultimo_resultado} edital(is) na última busca`}</>
                    : 'Sem registro de verificação — passa a ser gravado na próxima execução, 07h00'}
                </p>
                {a.ultimo_envio && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    Último e-mail: {a.ultimo_envio}
                  </p>
                )}

                {a.ultimo_erro && (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    {a.ultimo_erro}
                  </p>
                )}

                {a.redundante_com && (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-slate-500">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    Já coberto por {a.redundante_com} — este não traz nada novo.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggle(a.id)}
                  title={a.ativo ? 'Pausar este termo' : 'Retomar este termo'}
                  className="text-slate-400 hover:text-amber-600 transition-colors"
                >
                  {a.ativo ? <ToggleRight size={20} className="text-amber-500" /> : <ToggleLeft size={20} />}
                </button>
                <button
                  onClick={() => remover(a.id, a.termo)}
                  title="Remover termo"
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * ⚠️ UMA FUNÇÃO, NÃO DOIS BLOCOS IGUAIS. O card configurável sobe para o topo
   * e os demais ficam agrupados embaixo — são dois lugares de render para a
   * mesma coisa. Copiar as ~35 linhas faria a segunda cópia envelhecer sozinha,
   * que é exatamente como um botão para de responder em metade da tela.
   */
  const cardDeTipo = (t: TipoAlerta) => (
    <div
      key={t.tipo}
      className={`rounded-2xl border p-4 transition-all ${
        t.ativo ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm ${t.ativo ? 'text-slate-900' : 'text-slate-500'}`}>
            {t.nome}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{t.descricao}</p>
          {t.porque && (
            <p className="text-[11px] text-slate-400 font-medium mt-1 italic">{t.porque}</p>
          )}
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
            <Clock size={10} /> {t.quando}
          </p>
        </div>
        <button
          onClick={() => alternarTipo(t)}
          disabled={salvandoTipo === t.tipo}
          title={t.ativo ? 'Desligar este aviso' : 'Ligar este aviso'}
          className="shrink-0 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-40"
        >
          {salvandoTipo === t.tipo
            ? <Loader2 size={22} className="animate-spin text-amber-500" />
            : t.ativo
              ? <ToggleRight size={22} className="text-amber-500" />
              : <ToggleLeft size={22} />}
        </button>
      </div>

      {t.configuravel && cadastroDeTermos}
    </div>
  );

  // O tipo que a pessoa configura sobe; os que ela só liga/desliga descem.
  const configuravel = tipos.find(t => t.configuravel);
  const demais = tipos.filter(t => !t.configuravel);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {notice.msg}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="bg-gradient-to-br from-white to-amber-50/40 border-b border-slate-100 p-5 md:p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-amber-700 shadow-sm mb-2">
          <Bell className="h-3.5 w-3.5" />
          Alertas
        </div>
        <h2 className="text-lg font-black text-slate-900">Tudo o que a Bawzi te avisa</h2>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Estes são todos os sinais que o sistema emite. Deixe ligado o que
          importa para você e desligue o resto — a mudança vale para o sino, o
          push e o e-mail.
        </p>
        {!loading && tipos.length > 0 && (
          <p className="text-[11px] font-black text-slate-400 mt-2">
            {ligados} de {tipos.length} sinais ligados
          </p>
        )}
      </div>

      {/* Lista por grupo */}
      <div className="p-5 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-700">Não deu para carregar os sinais</p>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Recarregue a página. Nada foi alterado.
            </p>
          </div>
        ) : (
          <>
            {/* ⚠️ O QUE A PESSOA CONFIGURA VEM PRIMEIRO. Os outros nove sinais
                são um interruptor cada; este é o único com trabalho dentro —
                cadastrar, pausar e remover termos. Enterrado no meio da
                segunda seção, o cadastro que a pessoa vem usar exigia rolar
                por cinco cards que ela não precisa tocar. */}
            {configuravel && (
              <section>{cardDeTipo(configuravel)}</section>
            )}

            {demais.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Os demais avisos
                </span>
                <span className="h-px flex-1 bg-slate-100" />
              </div>
            )}

            {grupos.map(g => {
              const doGrupo = demais.filter(t => t.grupo === g.id);
              if (doGrupo.length === 0) return null;
              return (
                <section key={g.id}>
                  <div className="mb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">{g.nome}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{g.subtitulo}</p>
                  </div>
                  <div className="space-y-3">
                    {doGrupo.map(cardDeTipo)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
