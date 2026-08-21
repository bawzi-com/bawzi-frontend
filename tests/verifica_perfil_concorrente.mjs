/**
 * O perfil do concorrente: só o que dá para observar.
 *
 *   node tests/verifica_perfil_concorrente.mjs
 *
 * ⚠️ ESTE TESTE COMPILA O `.ts` E EXECUTA A FUNÇÃO DE VERDADE. Asserção sobre
 * texto de arquivo não serviria: o valor aqui está nas decisões de borda —
 * quando devolver `null` em vez de zero, quando a mediana difere da média,
 * quando a data ainda é "recente". Nenhuma delas aparece lendo o código.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O QUE ESTA FUNÇÃO SUBSTITUI
 * ═══════════════════════════════════════════════════════════════════════════
 * A tela dizia "~25% de ameaça competitiva". O número saía de
 * `18 + 7 × vitórias`, rebaldado em 1/2/3 e dividido por 60 (denominador
 * arbitrário: o máximo real da fórmula é 59). Não era probabilidade de nada —
 * era a contagem de vitórias com outra roupa, e um licitante que lesse "25%"
 * e relaxasse teria sido induzido ao erro por um número que só sabia contar.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let ok = true;
function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

const saida = mkdtempSync(join(tmpdir(), 'perfil-'));
// ⚠️ `"types": []` É NECESSÁRIO, NÃO ZELO. Compilar UM arquivo fora do
// `tsconfig` do projeto faz o tsc puxar `@types/node` inteiro como tipo
// ambiente, e ele quebra sozinho em `undici-types`. Este módulo não usa nada de
// Node — só `Date`, `Intl` e `Array` —, então excluir os tipos ambientes é a
// compilação correta, além da que funciona. Vai por arquivo porque a flag
// `--types` na linha de comando exige argumento e não aceita lista vazia.
const cfg = join(saida, 'tsconfig.json');
writeFileSync(cfg, JSON.stringify({
  compilerOptions: {
    outDir: saida, module: 'es2022', target: 'es2022',
    moduleResolution: 'bundler', types: [], skipLibCheck: true,
  },
  files: [join(process.cwd(), 'src/lib/perfilConcorrente.ts')],
}));
execSync(`npx tsc -p ${cfg}`, { stdio: 'pipe' });
const { perfilDoConcorrente, evidenciasDoPerfil, chaveDeOrgao, paraData,
        linkExternoValido, acaoSugerida } =
  await import(join(saida, 'perfilConcorrente.js'));

const HOJE = new Date(2026, 7, 21);   // 21/08/2026 — fixo, senão o teste muda de resposta sozinho

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sem contrato não se afirma nada
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ A DIFERENÇA ENTRE `null` E `0` É O CORAÇÃO DESTE ARQUIVO. "0 vitórias" é
// uma afirmação sobre a empresa; o que se sabe é bem menos — não há contrato
// dela NA BASE. A tela precisa poder dizer "não sei", e para isso a função
// precisa devolver algo diferente de zero.
const vazio = perfilDoConcorrente([], { hoje: HOJE });
checa('🎯 sem contratos, a lista de evidências vem VAZIA (a tela diz que não sabe)',
  evidenciasDoPerfil(vazio).length, 0);
checa('e nada é afirmado sobre o órgão', vazio.vitoriasNoOrgao, null);
checa('nem sobre piso', vazio.pisoUnitario, null);
checa('nem sobre deságio', vazio.desagio, null);
checa('entrada nula não quebra', perfilDoConcorrente(null, { hoje: HOJE }).vitorias, 0);
checa('entrada indefinida não quebra', perfilDoConcorrente(undefined, { hoje: HOJE }).vitorias, 0);

// ═══════════════════════════════════════════════════════════════════════════
// 2. Órgão: casar é afirmar, não casar é calar
// ═══════════════════════════════════════════════════════════════════════════
const CONTRATOS = [
  { orgao: 'PREFEITURA MUNICIPAL DE VITÓRIA DA CONQUISTA', data: '10/03/2026', valorUnitario: 42.5, desagio: 12 },
  { orgao: 'Município de Vitória da Conquista', data: '02/11/2025', valorUnitario: 38.0, desagio: 21 },
  { orgao: 'SECRETARIA DE SAÚDE DO ESTADO DA BAHIA', data: '15/06/2024', valorUnitario: 55.0, desagio: 9 },
];

const comAlvo = perfilDoConcorrente(CONTRATOS, {
  orgaoAlvo: 'Prefeitura Municipal de Vitória da Conquista', hoje: HOJE });
// ⚠️ "PREFEITURA MUNICIPAL DE X" e "MUNICÍPIO DE X" são a mesma casa escrita de
// dois jeitos. Sem normalizar acento e palavra vazia, uma das duas vitórias
// desaparece — e some justamente a evidência que mais pesa numa decisão.
checa('🎯 casa grafias diferentes do mesmo órgão', comAlvo.vitoriasNoOrgao, 2);
checa('e conta os órgãos distintos', comAlvo.orgaosDistintos, 2);

const semCasar = perfilDoConcorrente(CONTRATOS, { orgaoAlvo: 'INSTITUTO FEDERAL DO PARÁ', hoje: HOJE });
// ⚠️ AQUI ESTÁ A DECISÃO QUE MAIS IMPORTA. Nome de órgão é texto livre; se a
// normalização não casar, dizer "0 vitórias neste órgão" para quem venceu lá
// três vezes é falso — e é o erro que faria o licitante baixar a guarda.
// Ausência de prova não é prova de ausência: devolve `null` e a tela cala.
checa('🎯 sem casar, devolve null e NÃO zero', semCasar.vitoriasNoOrgao, null);
checa('e a linha do órgão some das evidências',
  evidenciasDoPerfil(semCasar).some((e) => e.rotulo === 'Neste órgão'), false);
checa('sem órgão alvo informado, também cala',
  perfilDoConcorrente(CONTRATOS, { hoje: HOJE }).vitoriasNoOrgao, null);

checa('normalização derruba acento e palavra vazia',
  chaveDeOrgao('Prefeitura Municipal de Vitória da Conquista'), 'VITORIA CONQUISTA');
// ⚠️ ABREVIAÇÃO CONTA. O PNCP publica "PREF MINEIROS" ao lado de "MUNICÍPIO DE
// MINEIROS" — sem tratar `PREF`, as duas viram órgãos distintos e a evidência
// mais forte da tela ("já venceu aqui") simplesmente desaparece.
checa('🎯 "PREF X" e "MUNICÍPIO DE X" são o mesmo órgão',
  chaveDeOrgao('PREF MINEIROS'), chaveDeOrgao('Município de Mineiros'));
checa('   e o mesmo vale para a forma por extenso',
  chaveDeOrgao('PREFEITURA MUNICIPAL DE MINEIROS'), chaveDeOrgao('PREF MINEIROS'));

// ═══════════════════════════════════════════════════════════════════════════
// 3. Datas: dd/mm/aaaa e ISO
// ═══════════════════════════════════════════════════════════════════════════
checa('lê data brasileira', paraData('10/03/2026')?.getFullYear(), 2026);
checa('lê ISO', paraData('2026-03-10')?.getMonth(), 2);
checa('texto solto vira null', paraData('não informada'), null);
checa('vazio vira null', paraData(''), null);
checa('🎯 a última vitória é a MAIS RECENTE, não a primeira da lista',
  comAlvo.ultimaVitoria.iso, '2026-03-10');
checa('e vem com rótulo legível', comAlvo.ultimaVitoria.rotulo, 'há 5 meses');

// ⚠️ UM CONCORRENTE PARADO HÁ DOIS ANOS NÃO É O MESMO RISCO DE UM QUE VENCEU
// MÊS PASSADO, mesmo com a mesma contagem. A contagem sozinha esconde isso.
const antigo = perfilDoConcorrente(
  [{ orgao: 'X', data: '01/01/2023', valorUnitario: 10 }], { hoje: HOJE });
checa('🎯 vitória antiga é sinalizada como possível saída do segmento',
  evidenciasDoPerfil(antigo).find((e) => e.rotulo === 'Última vitória')?.detalhe,
  'pode ter saído do segmento');
const recente = perfilDoConcorrente(
  [{ orgao: 'X', data: '10/07/2026', valorUnitario: 10 }], { hoje: HOJE });
checa('e vitória recente não recebe o aviso',
  evidenciasDoPerfil(recente).find((e) => e.rotulo === 'Última vitória')?.detalhe, undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Piso unitário — o número que decide o lance
// ═══════════════════════════════════════════════════════════════════════════
checa('🎯 o piso é o MENOR unitário já aceito', comAlvo.pisoUnitario, 38.0);
checa('aceita unitário em objeto de metadados',
  perfilDoConcorrente([{ valorUnitario: { valor: 7.25 } }], { hoje: HOJE }).pisoUnitario, 7.25);
checa('aceita unitário em texto brasileiro',
  perfilDoConcorrente([{ valorUnitario: 'R$ 1.234,56' }], { hoje: HOJE }).pisoUnitario, 1234.56);
checa('zero e negativo não viram piso',
  perfilDoConcorrente([{ valorUnitario: 0 }, { valorUnitario: -3 }], { hoje: HOJE }).pisoUnitario, null);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Deságio: mediana, com a amostra colada no número
// ═══════════════════════════════════════════════════════════════════════════
checa('🎯 mediana de 12, 21 e 9', comAlvo.desagio.mediana, 12);
checa('e a amostra viaja junto', comAlvo.desagio.amostra, 3);
checa('com a faixa observada', [comAlvo.desagio.min, comAlvo.desagio.max], [9, 21]);

// ⚠️ "18% EM 2 CONTRATOS" E "18% EM 40" PEDEM DECISÕES DIFERENTES. Por isso a
// amostra fica no mesmo cartão do número, e não numa nota de rodapé.
const umSo = perfilDoConcorrente([{ desagio: 18, valorUnitario: 5 }], { hoje: HOJE });
checa('🎯 amostra de 1 é dita explicitamente',
  evidenciasDoPerfil(umSo).find((e) => e.rotulo === 'Deságio mediano')?.detalhe,
  '1 contrato medido');

// Contrato sem deságio medido não entra na conta como zero.
const parcial = perfilDoConcorrente(
  [{ desagio: 20, valorUnitario: 5 }, { valorUnitario: 6 }, { desagio: null, valorUnitario: 7 }],
  { hoje: HOJE });
checa('🎯 contrato sem deságio medido é ignorado, não vira zero', parcial.desagio.mediana, 20);
checa('e a amostra reflete só o que foi medido', parcial.desagio.amostra, 1);
checa('mas as vitórias continuam contando todos', parcial.vitorias, 3);

// Nenhum medido → a linha some.
const nenhum = perfilDoConcorrente([{ valorUnitario: 5 }, { valorUnitario: 6 }], { hoje: HOJE });
checa('🎯 sem nenhum deságio medido, a linha não aparece',
  evidenciasDoPerfil(nenhum).some((e) => e.rotulo === 'Deságio mediano'), false);
checa('mas as vitórias e o piso continuam aparecendo',
  evidenciasDoPerfil(nenhum).map((e) => e.rotulo),
  ['Contratos vencidos', 'Menor unitário que já aceitou']);

// Deságio negativo (venceu acima do estimado) é preservado.
checa('🎯 deságio negativo sobrevive à mediana',
  perfilDoConcorrente([{ desagio: -15 }, { desagio: -5 }, { desagio: -25 }], { hoje: HOJE }).desagio.mediana,
  -15);

// ═══════════════════════════════════════════════════════════════════════════
// 6. Nenhuma evidência é um percentual inventado
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ A GUARDA CONTRA A REGRESSÃO. Se alguém reintroduzir um "score" com cara de
// probabilidade, ele vai acabar nesta lista — e esta asserção quebra.
const rotulos = evidenciasDoPerfil(comAlvo).map((e) => e.rotulo);
checa('🎯 nenhuma evidência se chama ameaça/risco/score',
  rotulos.some((r) => /amea|risco|score|probabil/i.test(r)), false);
checa('e a ordem é a que decide um lance', rotulos, [
  'Contratos vencidos', 'Neste órgão', 'Deságio mediano',
  'Menor unitário que já aceitou', 'Última vitória',
]);

// ═══════════════════════════════════════════════════════════════════════════
// 6b. "Recente" só quando for
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ A TELA DIZIA "1 vitória recente" INCONDICIONALMENTE — o adjetivo não
// consultava data nenhuma. Uma empresa parada desde 2023 recebia a mesma frase
// de uma que venceu mês passado. Estas asserções sustentam a regra que o
// componente aplica: `mesesAtras <= 12` é "recente", acima disso a frase tem
// de dizer quando foi.
const venceuOntem = perfilDoConcorrente(
  [{ orgao: 'X', data: '10/07/2026' }], { hoje: HOJE });
checa('🎯 vitória do último ano conta como recente', venceuOntem.ultimaVitoria.mesesAtras <= 12, true);
const venceu2023 = perfilDoConcorrente(
  [{ orgao: 'X', data: '05/02/2023' }], { hoje: HOJE });
checa('🎯 vitória de 2023 NÃO conta como recente', venceu2023.ultimaVitoria.mesesAtras <= 12, false);
checa('   e o rótulo diz há quanto tempo', venceu2023.ultimaVitoria.rotulo, 'há mais de 3 anos');
// A borda: exatamente 12 meses ainda é recente; 13 não.
checa('12 meses ainda é recente',
  perfilDoConcorrente([{ data: '21/08/2025' }], { hoje: HOJE }).ultimaVitoria.mesesAtras <= 12, true);
checa('13 meses não é',
  perfilDoConcorrente([{ data: '21/07/2025' }], { hoje: HOJE }).ultimaVitoria.mesesAtras <= 12, false);
// Contrato sem data: não dá para afirmar nem negar recência.
checa('🎯 sem data, não há como afirmar recência',
  perfilDoConcorrente([{ orgao: 'X' }], { hoje: HOJE }).ultimaVitoria, null);

// ═══════════════════════════════════════════════════════════════════════════
// 6c. A "Resposta sugerida" sai do fato, não da posição na lista
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ERAM QUATRO FRASES FIXAS ESCOLHIDAS POR `posicao === 0` E POR SER
// REGIONAL. No radar real, #2, #3, #4 e #5 recebiam a MESMA sentença, palavra
// por palavra, embaixo de CNPJs diferentes. E a posição era o pior insumo
// possível: com todos empatados em 1 vitória, o #1 é só quem o `sort` deixou
// na frente — a recomendação "mais forte" ia para uma empresa sorteada.
const perf = (contratos, alvo) => perfilDoConcorrente(contratos, { orgaoAlvo: alvo, hoje: HOJE });

const noOrgao = acaoSugerida(perf(
  [{ orgao: 'PREFEITURA DE MINEIROS', data: '10/03/2026' },
   { orgao: 'Municipio de Mineiros', data: '01/02/2026' }], 'Município de Mineiros'));
checa('🎯 já venceu no órgão → é isso que a ação diz', /já venceu 2× neste mesmo órgão/.test(noOrgao), true);

const comPiso = acaoSugerida(perf([{ orgao: 'OUTRO', data: '10/03/2026', valorUnitario: 42.5 }], 'ALVO X'));
checa('🎯 sem presença no órgão mas com piso → o piso vira a ação',
  /já fechou a R\$\s?42,50 por unidade/.test(comPiso), true);
// ⚠️ "JÁ FECHOU", NÃO "VAI COBRAR": o piso vem dos contratos dele, que podem
// ser de outro objeto. É referência de margem, não previsão de lance.
checa('   e não promete o que ele vai cobrar aqui',
  /vai cobrar|vai lançar|lance será/.test(comPiso), false);

const soDesagio = acaoSugerida(perf([{ orgao: 'OUTRO', data: '10/03/2026', desagio: 22 }], 'ALVO X'));
checa('🎯 sem piso mas com deságio medido → o deságio vira a ação',
  /corta 22% do estimado \(1 contrato medido\)/.test(soDesagio), true);

const sumido = acaoSugerida(perf([{ orgao: 'OUTRO', data: '01/01/2023' }], 'ALVO X'));
checa('🎯 parado há anos → não gastar esforço de impugnação',
  /pode ter saído do segmento/.test(sumido), true);

const nada = acaoSugerida(perf([], 'ALVO X'));
checa('🎯 sem fato nenhum, NÃO inventa recomendação',
  /Sem contrato deste CNPJ na base/.test(nada), true);
const regionalSemBase = acaoSugerida(perf([], 'ALVO X'), { regional: true });
checa('regional sem histórico manda conferir no PNCP',
  /Abra o Dossiê PNCP/.test(regionalSemBase), true);

// ⚠️ A PROVA DE QUE A POSIÇÃO SAIU: cinco empresas com histórico DIFERENTE
// precisam receber textos diferentes. Antes, quatro delas recebiam o mesmo.
const cinco = [
  perf([{ orgao: 'PREF MINEIROS', data: '10/03/2026' }], 'Municipio de Mineiros'),
  perf([{ orgao: 'OUTRO', data: '10/03/2026', valorUnitario: 42.5 }], 'ALVO X'),
  perf([{ orgao: 'OUTRO', data: '10/03/2026', desagio: 22 }], 'ALVO X'),
  perf([{ orgao: 'OUTRO', data: '01/01/2023' }], 'ALVO X'),
  perf([], 'ALVO X'),
].map((p) => acaoSugerida(p));
checa('🎯 cinco perfis diferentes → cinco respostas diferentes', new Set(cinco).size, 5);
// E o inverso também precisa valer: fatos iguais, texto igual — isso é
// correto, e é diferente de posições vizinhas gerarem texto igual.
checa('   mas dois perfis IGUAIS recebem o mesmo texto (isso é certo)',
  acaoSugerida(perf([{ orgao: 'A', valorUnitario: 10 }], 'X')),
  acaoSugerida(perf([{ orgao: 'B', valorUnitario: 10 }], 'X')));

// ═══════════════════════════════════════════════════════════════════════════
// 7. "Link Oficial" tem de sair do nosso domínio
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ O CASO REAL: um contrato exibia "Link Oficial" apontando para
// `http://localhost:3000/contratos/13925994000107/2025/100`. O valor guardado
// era `/contratos/13925994000107/2025/100` — caminho relativo vindo do campo
// `linkSistemaOrigem` do PNCP —, e o navegador resolve isso contra o NOSSO
// domínio. Em produção viraria `app.bawzi.com/contratos/...`: 404 justamente
// no botão que promete levar à fonte primária.
checa('🎯 caminho relativo do PNCP é recusado (era o link quebrado real)',
  linkExternoValido('/contratos/13925994000107/2025/100'), '');
checa('URL absoluta do PNCP passa',
  linkExternoValido('https://pncp.gov.br/app/contratos/139/2025/100'),
  'https://pncp.gov.br/app/contratos/139/2025/100');
checa('http também passa', linkExternoValido('http://exemplo.gov.br/x'), 'http://exemplo.gov.br/x');
checa('espaço em volta não atrapalha',
  linkExternoValido('  https://pncp.gov.br/a  '), 'https://pncp.gov.br/a');

// ⚠️ E NÃO É SÓ LINK QUEBRADO. O valor é texto de terceiro indo direto para um
// `href`: `javascript:` num `<a>` executa no clique.
for (const perigo of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>',
                      'file:///etc/passwd', '//evil.example.com/x']) {
  checa(`🎯 ${perigo.slice(0, 24)} é recusado`, linkExternoValido(perigo), '');
}
checa('vazio vira vazio', linkExternoValido(''), '');
checa('não-string vira vazio', linkExternoValido(null), '');
checa('número vira vazio', linkExternoValido(42), '');

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
