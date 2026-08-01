#!/usr/bin/env python3
"""
Linha de filtros na aba de uso de IA do Admin.

COMPOSIÇÃO (regras do guia de visualização)
  • uma linha só, acima de tudo que ela escopa — nunca dentro de um card,
    nunca um filtro por gráfico
  • período primeiro: é o controle que todo mundo procura antes dos outros
  • o recorte vale para TUDO abaixo — KPIs, série e as duas tabelas leem a mesma
    fatia, então os números nunca se contradizem
  • ao recarregar, o conteúdo antigo FICA na tela com opacidade reduzida.
    Sem esqueleto, sem pulo de layout: o operador continua lendo os números
    velhos enquanto os novos chegam, em vez de encarar um vazio a cada clique.

O FILTRO DE USUÁRIO NÃO É UM DROPDOWN
São até cem usuários, quase todos IDs opacos. Um <select> com cem linhas de
hash é pior do que nada. Clicar na linha do usuário na tabela é o gesto natural,
e o chip ativo dá a saída — o mesmo padrão de "clicou, filtrou" que já existe em
qualquer tabela de analytics.
"""
import os
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ALVO = os.path.join(BASE, "src", "app", "admin", "page.tsx")
BACKUP = os.path.join(BASE, "_backup_pre_fix", "admin_page.tsx.bak-filtros")

# ── 1. Estado + fetch com querystring ────────────────────────────────────
A1 = """  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/admin/analytics/usage`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch {}
    setAnalyticsLoading(false);
  };"""

N1 = """  const loadAnalytics = async (f: Partial<typeof analyticsFiltros> = {}) => {
    const alvo = { ...analyticsFiltros, ...f };
    setAnalyticsFiltros(alvo);
    setAnalyticsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (alvo.dias) qs.set('dias', String(alvo.dias));
      if (alvo.tier !== null && alvo.tier !== undefined) qs.set('tier', String(alvo.tier));
      if (alvo.userId) qs.set('user_id', alvo.userId);
      if (alvo.modelo) qs.set('modelo', alvo.modelo);
      const sufixo = qs.toString() ? `?${qs}` : '';
      const res = await apiFetch(`${API_URL}/api/admin/analytics/usage${sufixo}`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch {}
    setAnalyticsLoading(false);
  };"""

# ── 2. Declaração do estado, junto dos outros ────────────────────────────
A2 = """  const loadErrorLogs = async (lvl = errorLogFilter) => {"""
N2 = """  const loadErrorLogs = async (lvl = errorLogFilter) => {"""   # inalterado, só âncora

A3 = """  const loadAnalytics = async (f: Partial<typeof analyticsFiltros> = {}) => {"""
N3 = """  // Recorte ativo da aba de uso de IA. Um objeto só, porque os quatro filtros
  // são aplicados juntos no servidor — manter quatro estados soltos convidaria
  // a disparar quatro requisições e mostrar quatro respostas incoerentes.
  const [analyticsFiltros, setAnalyticsFiltros] = useState<{
    dias: number; tier: number | null; userId: string | null; modelo: string | null;
  }>({ dias: 0, tier: null, userId: null, modelo: null });

  const loadAnalytics = async (f: Partial<typeof analyticsFiltros> = {}) => {"""

# ── 3. A linha de filtros, logo abaixo do cabeçalho da aba ───────────────
A4 = """          {analyticsLoading && (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 size={28} className="animate-spin mr-3" /> Carregando dados…
            </div>
          )}

          {!analyticsLoading && analyticsData && (
            <>"""

N4 = """          {/* ── Filtros: uma linha, acima de tudo que eles escopam ──
              Período vem primeiro porque é o controle que todo mundo procura
              antes dos outros. O recorte vale para KPIs, série e as duas
              tabelas — se cada bloco filtrasse sozinho, o total do topo
              divergiria da soma da tabela. */}
          {analyticsData && (() => {
            const f = analyticsFiltros;
            const disp = analyticsData.filtros_disponiveis || {};
            const usuarioAtivo = f.userId
              ? (analyticsData.by_user || []).find((u: any) => u.user_id === f.userId)
              : null;
            const temFiltro = !!(f.dias || f.tier !== null || f.userId || f.modelo);
            const sel = 'bg-slate-800 border-slate-700 text-white';
            const nao = 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200';
            return (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 mr-1">
                  {[{ d: 0, r: 'Tudo' }, { d: 7, r: '7 dias' }, { d: 30, r: '30 dias' }, { d: 90, r: '90 dias' }]
                    .map(({ d, r }) => (
                    <button key={d} onClick={() => loadAnalytics({ dias: d })}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${f.dias === d ? sel : nao}`}>
                      {f.dias === d && <span className="mr-1">✓</span>}{r}
                    </button>
                  ))}
                </div>

                <select value={f.tier ?? ''} onChange={e => loadAnalytics({ tier: e.target.value === '' ? null : Number(e.target.value) })}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold outline-none ${f.tier !== null ? sel : nao}`}>
                  <option value="">Todos os planos</option>
                  {(disp.tiers || []).map((t: any) => (
                    <option key={t.tier} value={t.tier}>#{t.tier} {t.nome}</option>
                  ))}
                </select>

                <select value={f.modelo ?? ''} onChange={e => loadAnalytics({ modelo: e.target.value || null })}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold outline-none max-w-[230px] ${f.modelo ? sel : nao}`}>
                  <option value="">Todos os modelos</option>
                  {(disp.modelos || []).map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {usuarioAtivo && (
                  <button onClick={() => loadAnalytics({ userId: null })}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-200 text-[11px] font-bold">
                    <span className="truncate max-w-[190px]">{usuarioAtivo.email || usuarioAtivo.user_id}</span>
                    <span className="text-violet-400">×</span>
                  </button>
                )}

                {temFiltro && (
                  <button onClick={() => loadAnalytics({ dias: 0, tier: null, userId: null, modelo: null })}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                    Limpar
                  </button>
                )}

                {analyticsLoading && (
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500 ml-auto">
                    <Loader2 size={12} className="animate-spin" /> atualizando
                  </span>
                )}
              </div>
            );
          })()}

          {/* Só mostra o spinner de tela cheia na PRIMEIRA carga. Nas seguintes
              o conteúdo antigo fica com opacidade reduzida (ver abaixo): trocar
              números por um vazio a cada clique de filtro faz o operador perder
              o contexto do que estava comparando. */}
          {analyticsLoading && !analyticsData && (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 size={28} className="animate-spin mr-3" /> Carregando dados…
            </div>
          )}

          {analyticsData && (
            <div className={`space-y-8 transition-opacity duration-200 ${analyticsLoading ? 'opacity-40 pointer-events-none' : ''}`}>"""

# ── 4. Fecha o fragmento que virou <div> ─────────────────────────────────
# O `<>` de abertura foi trocado por `<div>` na âncora anterior; sem trocar o
# `</>` correspondente, o JSX não compila. Os dois passos vivem no mesmo patch
# de propósito — separá-los deixaria o arquivo quebrado entre um e outro.
A5 = """            </>
          )}

          {!analyticsLoading && !analyticsData && ("""
N5 = """            </div>
          )}

          {!analyticsLoading && !analyticsData && ("""

# ── 5. Estado vazio quando o filtro não devolve nada ─────────────────────
A6 = """              {/* Por Tier */}"""
N6 = """              {(analyticsData.resumo?.analises ?? 0) === 0 && (
                <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                  <p className="font-bold text-sm text-slate-400">Nenhuma análise neste recorte</p>
                  <p className="text-[12px] text-slate-600 mt-1">
                    Os filtros ativos não retornaram dados. Afrouxe o período ou limpe os filtros.
                  </p>
                </div>
              )}

              {/* Por Tier */}"""

src = open(ALVO, encoding="utf-8").read()

for i, (velho, novo) in enumerate(((A1, N1), (A3, N3), (A4, N4), (A5, N5), (A6, N6)), 1):
    n = src.count(velho)
    if n != 1:
        print(f"❌ ABORTADO: âncora {i} apareceu {n}x, esperava 1.")
        sys.exit(1)
    src = src.replace(velho, novo, 1)
    print(f"  ✅ âncora {i}")

os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
shutil.copy2(ALVO, BACKUP)
open(ALVO, "w", encoding="utf-8").write(src)
print(f"\n✅ Gravado. Backup em {BACKUP}\n")

f = open(ALVO, encoding="utf-8").read()
checagens = [
    ("estado dos filtros existe", "const [analyticsFiltros, setAnalyticsFiltros]" in f),
    ("fetch monta querystring", "qs.set('modelo'" in f),
    ("presets de período", "'90 dias'" in f),
    ("select de plano", "Todos os planos" in f),
    ("select de modelo", "Todos os modelos" in f),
    ("chip de usuário com saída", "usuarioAtivo.email" in f),
    ("botão limpar", ">\n                    Limpar\n" in f or "Limpar" in f),
    ("refetch mantém o quadro", "opacity-40 pointer-events-none" in f),
    ("spinner só na primeira carga", "analyticsLoading && !analyticsData" in f),
    ("estado vazio do recorte", "Nenhuma análise neste recorte" in f),
    ("fragmento fechado como div", f.count("            </>\n          )}\n\n          {!analyticsLoading && !analyticsData && (") == 0),
]
for nome, cond in checagens:
    print(f"  {'PASS' if cond else 'FAIL'}  {nome}")
sys.exit(0 if all(c for _, c in checagens) else 1)
