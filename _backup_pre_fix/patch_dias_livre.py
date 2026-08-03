#!/usr/bin/env python3
"""
Campo aberto de dias no filtro de período.

DECISÕES QUE VALE REGISTRAR

Aplica no Enter e no blur, NÃO a cada tecla. Digitar "120" produziria três
requisições — "1", "12", "120" — e as duas primeiras trariam recortes que o
usuário nunca pediu, cada uma repintando a tela inteira. Debounce resolveria
também, mas Enter/blur é mais previsível: o usuário sabe exatamente quando a
consulta sai.

Valor inválido não dispara nada e não some. Campo numérico que apaga o que você
digitou porque "estava errado" é hostil; aqui ele fica lá, marcado em vermelho,
até virar um número aceitável.

O campo e os presets são o MESMO filtro, não dois. Clicar num preset preenche o
campo; digitar um valor desmarca os presets. Se fossem estados separados, a tela
poderia mostrar "30 dias" selecionado com "120" escrito ao lado — e aí nenhum dos
dois seria confiável.

O teto de 730 dias espelha o `le=730` do backend. Deixar o campo aceitar mais do
que a API aceita só produziria um 422 sem explicação.
"""
import os
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ALVO = os.path.join(BASE, "src", "app", "admin", "page.tsx")
BACKUP = os.path.join(BASE, "_backup_pre_fix", "admin_page.tsx.bak-dias")

# ── 1. Estado do campo livre, ao lado do estado dos filtros ──────────────
A1 = """  const [analyticsFiltros, setAnalyticsFiltros] = useState<{"""
N1 = """  // Texto do campo aberto de dias. Separado de `analyticsFiltros.dias` porque
  // um é o que está DIGITADO e o outro é o que está APLICADO — enquanto o
  // usuário digita "12" a caminho de "120", o filtro ativo continua sendo o
  // anterior. Fundir os dois faria a tela recarregar a cada tecla.
  const [analyticsDiasTexto, setAnalyticsDiasTexto] = useState('');

  const [analyticsFiltros, setAnalyticsFiltros] = useState<{"""

# ── 2. Presets preenchem o campo; campo aplica no Enter/blur ─────────────
A2 = """                <div className="flex items-center gap-1 mr-1">
                  {[{ d: 0, r: 'Tudo' }, { d: 7, r: '7 dias' }, { d: 30, r: '30 dias' }, { d: 90, r: '90 dias' }]
                    .map(({ d, r }) => (
                    <button key={d} onClick={() => loadAnalytics({ dias: d })}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${f.dias === d ? sel : nao}`}>
                      {f.dias === d && <span className="mr-1">✓</span>}{r}
                    </button>
                  ))}
                </div>
"""

N2 = """                <div className="flex items-center gap-1 mr-1">
                  {[{ d: 0, r: 'Tudo' }, { d: 7, r: '7 dias' }, { d: 30, r: '30 dias' }, { d: 90, r: '90 dias' }]
                    .map(({ d, r }) => (
                    <button key={d}
                      onClick={() => { setAnalyticsDiasTexto(d ? String(d) : ''); loadAnalytics({ dias: d }); }}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${f.dias === d ? sel : nao}`}>
                      {f.dias === d && <span className="mr-1">✓</span>}{r}
                    </button>
                  ))}

                  {/* Campo aberto: mesmo filtro dos presets, outra forma de
                      informar. Aplica no Enter e no blur — a cada tecla, digitar
                      "120" dispararia três consultas ("1", "12", "120") e duas
                      delas mostrariam recortes que ninguém pediu. */}
                  {(() => {
                    const n = parseInt(analyticsDiasTexto, 10);
                    const preenchido = analyticsDiasTexto.trim() !== '';
                    const invalido = preenchido && (!Number.isFinite(n) || n < 1 || n > 730);
                    const aplicar = () => {
                      if (!preenchido || invalido || n === f.dias) return;
                      loadAnalytics({ dias: n });
                    };
                    const personalizado = f.dias > 0 && ![7, 30, 90].includes(f.dias);
                    return (
                      <div className="flex items-center gap-1.5 ml-1">
                        <input
                          type="number" min={1} max={730} inputMode="numeric"
                          value={analyticsDiasTexto}
                          onChange={(e) => setAnalyticsDiasTexto(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicar(); } }}
                          onBlur={aplicar}
                          placeholder="livre"
                          title="Número de dias (1 a 730). Enter para aplicar."
                          className={`w-[68px] px-2 py-1.5 rounded-lg border text-[11px] font-bold outline-none bg-slate-900 tabular-nums ${
                            invalido ? 'border-red-500/60 text-red-300'
                            : personalizado ? 'border-slate-700 text-white'
                            : 'border-slate-800 text-slate-400'}`}
                        />
                        <span className={`text-[11px] font-bold ${invalido ? 'text-red-400' : 'text-slate-600'}`}>
                          {invalido ? '1 a 730' : 'dias'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
"""

# ── 3. "Limpar" também zera o campo ──────────────────────────────────────
A3 = """                  <button onClick={() => loadAnalytics({ dias: 0, tier: null, userId: null, modelo: null })}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                    Limpar
                  </button>"""
N3 = """                  <button onClick={() => { setAnalyticsDiasTexto(''); loadAnalytics({ dias: 0, tier: null, userId: null, modelo: null }); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                    Limpar
                  </button>"""

src = open(ALVO, encoding="utf-8").read()
for i, (v, n) in enumerate(((A1, N1), (A2, N2), (A3, N3)), 1):
    c = src.count(v)
    if c != 1:
        print(f"❌ ABORTADO: âncora {i} apareceu {c}x. Nada escrito.")
        sys.exit(1)
    src = src.replace(v, n, 1)
    print(f"  ✅ âncora {i}")

os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
shutil.copy2(ALVO, BACKUP)
open(ALVO, "w", encoding="utf-8").write(src)
print(f"\n✅ Gravado. Backup em {BACKUP}\n")

f = open(ALVO, encoding="utf-8").read()
for nome, cond in [
    ("estado do texto separado do aplicado", "const [analyticsDiasTexto, setAnalyticsDiasTexto]" in f),
    ("aplica no Enter", "e.key === 'Enter'" in f),
    ("aplica no blur", "onBlur={aplicar}" in f),
    ("não aplica valor inválido", "if (!preenchido || invalido || n === f.dias) return;" in f),
    ("teto espelha o do backend (730)", "n > 730" in f and "max={730}" in f),
    ("preset preenche o campo", "setAnalyticsDiasTexto(d ? String(d) : '')" in f),
    ("limpar zera o campo", "setAnalyticsDiasTexto(''); loadAnalytics({ dias: 0" in f),
    ("valor personalizado é destacado", "personalizado = f.dias > 0 && ![7, 30, 90]" in f),
]:
    print(f"  {'PASS' if cond else 'FAIL'}  {nome}")
