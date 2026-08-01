#!/usr/bin/env python3
"""
Botão de atualizar concorrentes: frontend.

O QUE MUDA
O estado vazio deixa de ser a frase única "Nenhum rival ativo mapeado" e passa a
dizer POR QUE está vazio, com o motivo que o backend agora devolve. E o botão de
retentar só aparece quando retentar pode mudar o resultado.

POR QUE O BOTÃO É CONDICIONAL
Um "Tentar novamente" pelado transfere para o usuário o trabalho de descobrir se
vale insistir. Se não existe contrato de azitromicina em GO, o botão vai falhar
todas as vezes — e um botão que falha sempre ensina o usuário a desconfiar dos
que funcionam. O backend já distingue os casos; a interface só precisa respeitar
a distinção.

Quando a lista TEM concorrentes, aparece um controle discreto de atualizar ao
lado das abas: o radar é a única seção da análise cujo dado envelhece, e
recalcular custa zero token.

Aborta sem escrever se qualquer âncora não bater exatamente uma vez.
"""
import os
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
COMP = os.path.join(BASE, "src", "components", "CompetitorWarRoom.tsx")
PAI = os.path.join(BASE, "src", "components", "AnalysisResults.tsx")
BKP_DIR = os.path.join(BASE, "_backup_pre_fix")

# ═══════════════════════════════════════════════════════════════════════════
# 1. Tipos + prop
# ═══════════════════════════════════════════════════════════════════════════
A1 = """interface CompetitorWarRoomProps {
  competitorsNacionais?: ConcorrenteData[];
  competitorsRegionais?: ConcorrenteData[];
  uf?: string;
  pricing?: PricingIntelligenceData;
  analysisId?: string;
  userTier?: number;
  fullResult?: FullResultData;
}"""

N1 = """/** Por que um lote do radar veio vazio. Vem do backend junto com a lista.
 *  `podeRetentar` é o campo que decide se o botão aparece: oferecer "tentar de
 *  novo" quando não há o que recuperar ensina o usuário que o botão não serve. */
export interface DiagnosticoLote {
  motivo?: string;
  pode_retentar?: boolean;
  mensagem?: string;
  detalhe?: {
    contratos_encontrados?: number;
    na_uf?: number;
    relevantes?: number;
    apurados?: number;
    com_fornecedor?: number;
  };
}

export interface DiagnosticoConcorrentes {
  nacional?: DiagnosticoLote;
  regional?: DiagnosticoLote;
  uf?: string;
  apurado_em?: string;
  duracao_s?: number;
}

interface CompetitorWarRoomProps {
  competitorsNacionais?: ConcorrenteData[];
  competitorsRegionais?: ConcorrenteData[];
  uf?: string;
  pricing?: PricingIntelligenceData;
  analysisId?: string;
  userTier?: number;
  fullResult?: FullResultData;
  diagnostico?: DiagnosticoConcorrentes;
  atualizadoEm?: string;
}"""

# ⚠️ Este arquivo tem espaço em branco no fim de várias linhas. A âncora precisa
# reproduzi-lo byte a byte, senão não casa — foi o que aconteceu na primeira
# tentativa. Os "\x20" abaixo são esses espaços, explícitos para não sumirem
# numa futura edição automática que apare o fim das linhas.
A2 = (
    "export default function CompetitorWarRoom({\x20\n"
    "  competitorsNacionais = [],\x20\n"
    "  competitorsRegionais = [],\x20\n"
    '  uf = "BR",\n'
    "  pricing = {},\x20\n"
    "  analysisId,\x20\n"
    "  userTier = 1,\n"
    "  fullResult = {}\n"
    "}: CompetitorWarRoomProps) {"
)

N2 = """export default function CompetitorWarRoom({
  competitorsNacionais = [],
  competitorsRegionais = [],
  uf = "BR",
  pricing = {},
  analysisId,
  userTier = 1,
  fullResult = {},
  diagnostico,
  atualizadoEm
}: CompetitorWarRoomProps) {"""

# ═══════════════════════════════════════════════════════════════════════════
# 2. Estado local + função de reapuração
# ═══════════════════════════════════════════════════════════════════════════
A3 = """  const listaNacional = useMemo(() => parseCompetitors(competitorsNacionais, 'nacional'), [competitorsNacionais]);
  const listaRegional = useMemo(() => parseCompetitors(competitorsRegionais, 'regional'), [competitorsRegionais]);
  const listaAtiva = abaConcorrentes === 'nacional' ? listaNacional : listaRegional;"""

N3 = """  // Resultado da reapuração sobrescreve as props. Enquanto for null, valem os
  // dados que vieram com a análise — assim o componente continua funcionando
  // igual para quem nunca clicar no botão.
  const [radarLocal, setRadarLocal] = useState<{
    nacionais: ConcorrenteData[];
    regionais: ConcorrenteData[];
    diagnostico?: DiagnosticoConcorrentes;
    atualizadoEm?: string;
  } | null>(null);
  const [reapurando, setReapurando] = useState(false);
  const [erroReapuracao, setErroReapuracao] = useState<string | null>(null);

  const fonteNacionais = radarLocal?.nacionais ?? competitorsNacionais;
  const fonteRegionais = radarLocal?.regionais ?? competitorsRegionais;
  const diagAtual = radarLocal?.diagnostico ?? diagnostico;
  const carimboAtualizacao = radarLocal?.atualizadoEm ?? atualizadoEm;

  const listaNacional = useMemo(() => parseCompetitors(fonteNacionais, 'nacional'), [fonteNacionais]);
  const listaRegional = useMemo(() => parseCompetitors(fonteRegionais, 'regional'), [fonteRegionais]);
  const listaAtiva = abaConcorrentes === 'nacional' ? listaNacional : listaRegional;

  const diagAtivo: DiagnosticoLote | undefined =
    abaConcorrentes === 'nacional' ? diagAtual?.nacional : diagAtual?.regional;

  const reapurarConcorrentes = async () => {
    if (!analysisId || reapurando) return;
    setReapurando(true);
    setErroReapuracao(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await apiFetch(
        `${baseUrl.replace(/\\/$/, '')}/api/analyses/${analysisId}/concorrentes`,
        { method: 'POST' }
      );
      if (!resp.ok) {
        // O backend manda o motivo em `detail.mensagem` — mostrar isso é melhor
        // do que um "erro ao atualizar" genérico, que não ajuda a decidir nada.
        let msg = 'Não foi possível atualizar agora.';
        try {
          const corpo = await resp.json();
          msg = corpo?.detail?.mensagem || corpo?.detail || msg;
        } catch { /* corpo não-JSON: fica a mensagem padrão */ }
        setErroReapuracao(typeof msg === 'string' ? msg : 'Não foi possível atualizar agora.');
        return;
      }
      const dados = await resp.json();
      setRadarLocal({
        nacionais: dados.concorrentes_provaveis || [],
        regionais: dados.concorrentes_regionais || [],
        diagnostico: dados.concorrentes_diagnostico,
        atualizadoEm: dados.concorrentes_atualizado_em,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      setErroReapuracao('Falha de conexão ao consultar o PNCP.');
    } finally {
      setReapurando(false);
    }
  };"""

# ═══════════════════════════════════════════════════════════════════════════
# 3. Controle discreto ao lado das abas
# ═══════════════════════════════════════════════════════════════════════════
A4 = """            <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex w-full md:max-w-sm">
              <button onClick={() => setAbaConcorrentes('nacional')}"""

N4 = """            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex w-full md:max-w-sm">
              <button onClick={() => setAbaConcorrentes('nacional')}"""

A5 = """              <button onClick={() => setAbaConcorrentes('regional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Regionais</button>
            </div>"""

N5 = """              <button onClick={() => setAbaConcorrentes('regional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Regionais</button>
            </div>

              {/* Atualizar: discreto quando já há dados, porque aqui é sobre
                  frescor e não sobre falha. O radar é a única seção da análise
                  cujo dado envelhece — concorrentes mudam, exigências não — e
                  recalcular não gasta token nenhum. */}
              {analysisId && listaAtiva.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  {carimboAtualizacao && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Apurado em {new Date(carimboAtualizacao).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                  <button
                    onClick={reapurarConcorrentes}
                    disabled={reapurando}
                    title="Consulta o PNCP de novo. Não consome créditos de análise."
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-700 bg-white border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    <RefreshCw size={12} className={reapurando ? 'animate-spin' : ''} />
                    {reapurando ? 'Consultando…' : 'Atualizar'}
                  </button>
                </div>
              )}
            </div>"""

# ═══════════════════════════════════════════════════════════════════════════
# 4. O estado vazio que se explica
# ═══════════════════════════════════════════════════════════════════════════
A6 = """            {listaAtiva.length === 0 && (
              <div className="py-20 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem]">
                <p className="font-bold text-sm">Nenhum rival ativo mapeado.</p>
              </div>
            )}"""

N6 = """            {listaAtiva.length === 0 && (() => {
              // "Nenhum rival ativo mapeado" era a mesma frase para situações que
              // pedem reações opostas: não existe concorrente (resignar-se) e a
              // consulta falhou (clicar). Agora o motivo vem do backend e o botão
              // só aparece quando insistir pode mudar o resultado.
              const podeRetentar = Boolean(analysisId && diagAtivo?.pode_retentar);
              const ehFalha = diagAtivo?.motivo === 'sem_fornecedor'
                || diagAtivo?.motivo === 'tempo_esgotado'
                || diagAtivo?.motivo === 'sem_resultado';
              const titulo =
                diagAtivo?.motivo === 'sem_contratos' ? 'Nenhum contrato recente deste objeto'
                : diagAtivo?.motivo === 'fora_da_uf' ? `Nenhum contrato de órgão ${uf}`
                : diagAtivo?.motivo === 'sem_relevancia' ? 'Nenhum contrato compatível com o objeto'
                : diagAtivo?.motivo === 'sem_uf' ? 'UF do edital não identificada'
                : ehFalha ? 'A consulta ao PNCP não se completou'
                : 'Nenhum rival ativo mapeado.';
              const d = diagAtivo?.detalhe;
              return (
                <div className={`py-12 px-6 text-center border-2 border-dashed rounded-[1.5rem] ${
                  ehFalha ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  {ehFalha
                    ? <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-3" strokeWidth={1.5} />
                    : <SearchX className="w-8 h-8 mx-auto text-slate-300 mb-3" strokeWidth={1.5} />}
                  <p className={`font-bold text-sm ${ehFalha ? 'text-amber-800' : 'text-slate-600'}`}>
                    {titulo}
                  </p>
                  {diagAtivo?.mensagem && (
                    <p className="text-xs text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
                      {diagAtivo.mensagem}
                    </p>
                  )}
                  {d && (d.contratos_encontrados ?? 0) > 0 && (
                    <p className="text-[10px] text-slate-400 mt-3 font-medium tabular-nums">
                      {d.contratos_encontrados} encontrados · {d.relevantes ?? 0} compatíveis ·{' '}
                      {d.apurados ?? 0} apurados · {d.com_fornecedor ?? 0} com empresa identificada
                    </p>
                  )}
                  {erroReapuracao && (
                    <p className="text-xs text-red-600 mt-3 font-semibold">{erroReapuracao}</p>
                  )}
                  {podeRetentar && (
                    <button
                      onClick={reapurarConcorrentes}
                      disabled={reapurando}
                      className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-indigo-700 px-5 py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <RefreshCw size={13} className={reapurando ? 'animate-spin' : ''} />
                      {reapurando ? 'Consultando o PNCP…' : 'Tentar novamente'}
                    </button>
                  )}
                  {podeRetentar && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      Não consome créditos de análise.
                    </p>
                  )}
                </div>
              );
            })()}"""

# ═══════════════════════════════════════════════════════════════════════════
# 5. Ícone + passagem da prop no pai
# ═══════════════════════════════════════════════════════════════════════════
A7 = "import { Target, FileSearch, Award, SearchX, ArrowLeft, Crosshair, AlertTriangle, ListFilter, Clipboard, Eye, Building2, ExternalLink, ShieldAlert, ShieldCheck, Activity, Scale, Lightbulb, Map, Bot, CalendarDays, DollarSign, Shield, ClipboardList, Zap } from 'lucide-react';"
N7 = "import { Target, FileSearch, Award, SearchX, ArrowLeft, Crosshair, AlertTriangle, ListFilter, Clipboard, Eye, Building2, ExternalLink, ShieldAlert, ShieldCheck, Activity, Scale, Lightbulb, Map, Bot, CalendarDays, DollarSign, Shield, ClipboardList, Zap, RefreshCw } from 'lucide-react';"

A8 = """                  analysisId={analysisId || ''}
                  userTier={userTier}
                  fullResult={liveResult as import('./CompetitorWarRoom').FullResultData}
                />"""
N8 = """                  analysisId={analysisId || ''}
                  userTier={userTier}
                  fullResult={liveResult as import('./CompetitorWarRoom').FullResultData}
                  diagnostico={(liveResult as { concorrentes_diagnostico?: import('./CompetitorWarRoom').DiagnosticoConcorrentes }).concorrentes_diagnostico}
                  atualizadoEm={(liveResult as { concorrentes_atualizado_em?: string }).concorrentes_atualizado_em}
                />"""


def aplicar(caminho, pares, rotulo):
    src = open(caminho, encoding="utf-8").read()
    for i, (velho, novo) in enumerate(pares, 1):
        n = src.count(velho)
        if n != 1:
            print(f"❌ ABORTADO [{rotulo}]: âncora {i} apareceu {n}x, esperava 1.")
            return None
        src = src.replace(velho, novo, 1)
        print(f"  ✅ [{rotulo}] âncora {i}")
    return src


novo_comp = aplicar(COMP, [(A7, N7), (A1, N1), (A2, N2), (A3, N3),
                           (A4, N4), (A5, N5), (A6, N6)], "CompetitorWarRoom")
novo_pai = aplicar(PAI, [(A8, N8)], "AnalysisResults")

if novo_comp is None or novo_pai is None:
    print("\n❌ Nada foi escrito — os dois arquivos precisam passar juntos.")
    sys.exit(1)

os.makedirs(BKP_DIR, exist_ok=True)
shutil.copy2(COMP, os.path.join(BKP_DIR, "CompetitorWarRoom.tsx.bak-refresh"))
shutil.copy2(PAI, os.path.join(BKP_DIR, "AnalysisResults.tsx.bak-refresh"))
open(COMP, "w", encoding="utf-8").write(novo_comp)
open(PAI, "w", encoding="utf-8").write(novo_pai)

print(f"\n✅ Gravado. Backups em {BKP_DIR}\n")

c = open(COMP, encoding="utf-8").read()
p = open(PAI, encoding="utf-8").read()
checagens = [
    ("tipo DiagnosticoConcorrentes exportado", "export interface DiagnosticoConcorrentes" in c),
    ("props novas recebidas", "diagnostico,\n  atualizadoEm" in c),
    ("função de reapuração existe", "const reapurarConcorrentes = async ()" in c),
    ("botão condicional ao pode_retentar", "diagAtivo?.pode_retentar" in c),
    ("estado vazio usa a mensagem do backend", "diagAtivo.mensagem" in c),
    ("controle 'Atualizar' quando há dados", "listaAtiva.length > 0 && (" in c),
    ("ícone RefreshCw importado", "Zap, RefreshCw }" in c),
    ("sessão expirada tratada", "err instanceof SessionExpiredError" in c),
    ("prop passada pelo pai", "concorrentes_diagnostico}" in p),
    ("chaves balanceadas no componente", c.count("{") == c.count("}")),
    ("parênteses balanceados no componente", c.count("(") == c.count(")")),
]
for nome, cond in checagens:
    print(f"  {'PASS' if cond else 'FAIL'}  {nome}")
sys.exit(0 if all(x for _, x in checagens) else 1)
