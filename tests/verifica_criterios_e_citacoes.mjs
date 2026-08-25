/**
 * Omissão não é aprovação: critérios da empresa e citações do edital.
 *
 *     node tests/verifica_criterios_e_citacoes.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AS DUAS FRASES QUE ESTE ARQUIVO IMPEDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. "Todos os critérios configurados são atendidos."
 *
 *    Saía do `else` final de um ternário, e o painel de escopo contava por
 *    subtração: `params.length - bloqueios - alertas` era o número de
 *    "atende(m)". Nada normalizava o campo — um `status` faltando, `""` ou
 *    `"n/a"` não é bloqueio nem alerta, então sobrava do "menos" e virava
 *    critério atendido, em verde. São os critérios que o PRÓPRIO CLIENTE
 *    cadastrou: a parte que ele mais confere e a que menos consegue auditar.
 *
 *    O segundo furo é mais fino: o prompt autoriza `trecho_citado: ""` quando
 *    a IA não encontra menção, e não proíbe combinar isso com `status: "ok"`.
 *    "Atende ✅" sobre um critério que o edital não menciona ficava pixel a
 *    pixel idêntico a um confirmado com citação literal — a aspa vazia
 *    simplesmente não era renderizada.
 *
 * 2. A citação exibida com aspas e borda, como se tivesse sido conferida.
 *
 *    `conferir_citacoes` (auditoria.py) tem TRÊS desfechos e a tela pintava os
 *    três igual: conferida caractere a caractere; curta demais (< 25 chars
 *    normalizados — devolvida COMO VEIO, sem nenhuma busca no documento); e
 *    removida (não existe no edital). `citacao_conferida: false` era gravado
 *    pelo backend e lido por ninguém. O comentário no render chegava a
 *    afirmar que "a citação vem da auditoria e já foi conferida caractere a
 *    caractere" — verdade em um caso de três.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
let ok = true;

function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

// ── Transpila os dois módulos com o tsc do projeto ───────────────────────────
// ⚠️ NÃO retire tipos com regex. A primeira versão deste arquivo fazia isso e
// morria em `texto?: string;` dentro do union multilinha de `ItemExigencia` —
// gastando o tempo do teste em parsing de TypeScript em vez de na regra sob
// julgamento. O `tsc` do projeto já está ali; ele transpila as duas em <2s.
// Ambos os módulos são puros: nenhum importa React ou runtime.
const dir = mkdtempSync(join(tmpdir(), 'crit-'));
execSync(
  `node node_modules/.bin/tsc src/lib/criteriosDaEmpresa.ts src/components/analysis-types.ts`
  + ` --outDir ${dir} --module esnext --target es2022 --moduleResolution bundler`
  + ` --skipLibCheck --types --noEmitOnError false`,
  { cwd: RAIZ, stdio: 'pipe' },
);
// tsc emite .js; o import ESM precisa da extensão que o Node reconheça como módulo.
for (const nome of ['lib/criteriosDaEmpresa', 'components/analysis-types']) {
  writeFileSync(join(dir, `${nome.split('/')[1]}.mjs`), readFileSync(join(dir, `${nome}.js`), 'utf-8'));
}
const C = await import(join(dir, 'criteriosDaEmpresa.mjs'));
const T = await import(join(dir, 'analysis-types.mjs'));

// ═══════════════════════════════════════════════════════════════════════════
// 1. A SUBTRAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
const CRITERIOS = [
  { nome: 'Prazo de entrega', status: 'ok', trecho_citado: 'entrega em 45 dias', comprovado: true },
  { nome: 'Margem mínima', status: 'bloqueio', trecho_citado: 'desconto de 40%', comprovado: true },
  { nome: 'Atestado técnico', status: '', trecho_citado: '', comprovado: false },
  { nome: 'Índice de liquidez', status: 'ok', trecho_citado: '', comprovado: false },
  { nome: 'Local de execução', status: 'alerta', trecho_citado: 'capital', comprovado: true },
];
const c = C.contarCriterios(CRITERIOS);

// ⚠️ A CONTA ANTIGA, RECONSTRUÍDA. 5 - 1 bloqueio - 1 alerta = 3 "atende(m)".
const _contaAntiga = CRITERIOS.length
  - CRITERIOS.filter((p) => p.status === 'bloqueio').length
  - CRITERIOS.filter((p) => p.status === 'alerta').length;
checa('   (a subtração antiga dizia 3 atendem)', _contaAntiga, 3);
checa('🎯 na verdade só 2 têm status "ok"', c.atende.length, 2);
checa('🎯 e um deles nem tem status legível', c.semStatus.map((p) => p.nome), ['Atestado técnico']);
checa('   os bloqueios continuam sendo contados', c.bloqueios.map((p) => p.nome), ['Margem mínima']);
checa('   e os alertas também', c.alertas.map((p) => p.nome), ['Local de execução']);

// ⚠️ O SEGUNDO FURO: "atende" sem uma linha do edital.
checa('🎯 "atende" sem trecho é separado dos comprovados',
  c.semTrecho.map((p) => p.nome), ['Índice de liquidez']);
checa('   e o veredito da IA NÃO é rebaixado (só deixa de parecer conferido)',
  c.atende.map((p) => p.nome), ['Prazo de entrega', 'Índice de liquidez']);

// A frase de tudo-certo só quando não sobra nenhuma ressalva.
checa('🎯 com ressalva, a tela não pode dizer "todos atendidos"',
  C.todosOsCriteriosAtendidos(c), false);
checa('🎯 com tudo ok e comprovado, pode', C.todosOsCriteriosAtendidos(C.contarCriterios([
  { nome: 'A', status: 'ok', trecho_citado: 't', comprovado: true },
  { nome: 'B', status: 'ok', trecho_citado: 'u', comprovado: true },
])), true);
checa('   lista vazia não é "todos atendidos"', C.todosOsCriteriosAtendidos(C.contarCriterios([])), false);

// Laudo antigo não tem `comprovado`: derivamos do trecho, senão a tela
// acusaria "sem trecho" em todo critério já gravado.
const antigo = C.contarCriterios([{ nome: 'A', status: 'ok', trecho_citado: 'cláusula 4.2' }]);
checa('🎯 laudo antigo (sem `comprovado`) deriva do trecho', antigo.semTrecho.length, 0);
const antigoSemTrecho = C.contarCriterios([{ nome: 'A', status: 'ok' }]);
checa('   e sem trecho nenhum, acusa', antigoSemTrecho.semTrecho.length, 1);

// Entrada suja não derruba nem inventa.
checa('null vira lista vazia', C.contarCriterios(null).atende.length, 0);
checa('status inventado pela IA cai em semStatus',
  C.contarCriterios([{ nome: 'X', status: 'PARCIALMENTE_ATENDIDO' }]).semStatus.length, 1);

// ═══════════════════════════════════════════════════════════════════════════
// 2. OS TRÊS DESFECHOS DA CONFERÊNCIA
// ═══════════════════════════════════════════════════════════════════════════
checa('🎯 citação localizada no documento → conferida',
  T.estadoDaCitacao({ exigencia: 'CND', trecho: 'certidão negativa de débitos', citacao_conferida: true }),
  'conferida');
// ⚠️ ESTE ERA RENDERIZADO IGUAL AO DE CIMA: mesma aspa, mesma borda cinza.
checa('🎯 trecho curto demais → não conferida (era exibida como conferida)',
  T.estadoDaCitacao({ exigencia: 'CND', trecho: 'art. 68', citacao_conferida: false }),
  'nao_conferida');
checa('🎯 citação que não existe no edital → removida',
  T.estadoDaCitacao({ exigencia: 'CND', trecho: '', trecho_nao_conferido: 'o edital exige ISO 9001' }),
  'removida');
checa('sem citação nenhuma → sem_citacao', T.estadoDaCitacao({ exigencia: 'CND' }), 'sem_citacao');
checa('item em texto puro → sem_citacao', T.estadoDaCitacao('CND federal'), 'sem_citacao');
checa('null não estoura', T.estadoDaCitacao(null), 'sem_citacao');
// ⚠️ Laudo anterior à conferência não tem o campo. Não afirmamos nem negamos:
// marcar tudo como "não conferida" encheria de amarelo laudos íntegros.
checa('🎯 laudo antigo (campo ausente) não é acusado de não conferido',
  T.estadoDaCitacao({ exigencia: 'CND', trecho: 'certidão negativa de débitos' }), 'conferida');

// ═══════════════════════════════════════════════════════════════════════════
// 3. A TELA USA ESSAS FUNÇÕES — não reimplementa a conta
// ═══════════════════════════════════════════════════════════════════════════
const soCodigo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const TELA = soCodigo(readFileSync(join(RAIZ, 'src/components/AnalysisResults.tsx'), 'utf-8'));

// A subtração não pode voltar em NENHUMA das duas telas que a faziam.
checa('🎯 a subtração `length - bloqueios - alertas` não existe mais',
  /\.length\s*-\s*bloqueios\s*-\s*alertas/.test(TELA), false);
checa('🎯 a tela importa a contagem em vez de refazê-la',
  TELA.includes("from '@/lib/criteriosDaEmpresa'"), true);
checa('🎯 e a frase de tudo-certo passa pelo guarda',
  TELA.includes('todosOsCriteriosAtendidos(contagem)'), true);
checa('🎯 o estado da citação é lido no render', TELA.includes('estadoDaCitacao(e)'), true);
checa('🎯 e o estado `nao_verificado` tem cor própria',
  TELA.includes('nao_verificado:') && TELA.includes("label: 'Não verificado'"), true);
// O aviso de QA existia no backend e não era montado por componente nenhum.
checa('🎯 o banner de QA-falhou está montado', TELA.includes('<QaFalhouBanner'), true);
checa('   e só dispara em `false`, não em ausente',
  TELA.includes('qa.qa_executado !== false'), true);

rmSync(dir, { recursive: true, force: true });
console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
