/**
 * Datas do cronograma: o dia certo, e a urgência recomputada ao vivo.
 *
 *     TZ=America/Sao_Paulo node tests/verifica_datas_criticas.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OS DOIS NÚMEROS QUE ESTE ARQUIVO FIXA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. `'2026-09-15T00:00:00Z'` era impresso como "14 de set." e disparava o
 *    banner preto "EDITAL ENCERRADO" a partir das 21h00 do dia 14 — 27 horas
 *    de janela real desaparecendo da tela. O prompt de extração manda usar
 *    `T00:00:00Z` sempre que o horário não é determinável, então este NÃO é
 *    um caso de borda: é o caso comum.
 *
 * 2. `urgente` era gravado no backend no instante da análise e lido do
 *    registro. Um laudo feito 20 dias antes guarda `false` para sempre e o
 *    selo URGENTE nunca acende — nem na véspera da sessão.
 *
 * Os testes rodam com `agora` INJETADO. Sem isso o resultado dependeria do
 * dia em que a suíte roda, que é exatamente a classe de bug em julgamento.
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

// ── Transpila o módulo TS para ESM executável ────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'datas-'));
const fonte = readFileSync(join(RAIZ, 'src/lib/datasCriticas.ts'), 'utf-8');
// O módulo é TS só na superfície (tipos e interfaces). Retirar as anotações é
// suficiente e evita arrastar um transpiler para dentro do teste.
const js = fonte
  .replace(/^export interface [\s\S]*?^}/gm, '')
  .replace(/: Intl\.DateTimeFormatOptions/g, '')
  .replace(/: DataCriticaPartes \| null/g, '')
  .replace(/: 'curto' \| 'longo' \| 'numerico' = 'curto'/g, "= 'curto'")
  .replace(/iso: string \| null \| undefined/g, 'iso')
  .replace(/agora: Date = new Date\(\)/g, 'agora = new Date()')
  .replace(/\): (boolean|number \| null|Date \| null|string \| null) \{/g, ') {');
const arq = join(dir, 'datasCriticas.mjs');
writeFileSync(arq, js);
const M = await import(arq);

// ═══════════════════════════════════════════════════════════════════════════
// 1. O DIA IMPRESSO É O DIA GRAVADO
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n── fuso do processo: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`);

// ⚠️ A REGRESSÃO ORIGINAL, RECONSTRUÍDA. Se alguém trocar o `timeZone: 'UTC'`
// por nada, esta primeira asserção volta a bater com a segunda e o teste cai.
const _jeitoAntigo = new Date('2026-09-15T00:00:00Z')
  .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
checa('   (o jeito antigo imprimia o dia anterior)', _jeitoAntigo.includes('14'), true);
checa('🎯 prazo de 15/09 é impresso como 15/09',
  M.formatarDataCritica('2026-09-15T00:00:00Z', 'curto'), '15 de set. de 2026');
checa('🎯 e no formato longo também',
  M.formatarDataCritica('2026-09-15T00:00:00Z', 'longo'), '15 de setembro de 2026');
checa('🎯 e no numérico do PDF',
  M.formatarDataCritica('2026-09-15T00:00:00Z', 'numerico'), '15/09/2026');

// Hora real do edital aparece; a hora-sentinela 00:00 não é inventada na tela.
checa('🎯 horário extraído do edital vai junto',
  M.formatarDataCritica('2026-09-15T09:30:00Z', 'curto'), '15 de set. de 2026 · 09:30');
checa('🎯 T00:00:00Z não vira "00:00" na tela (é "não sei a hora", não meia-noite)',
  M.formatarDataCritica('2026-09-15T00:00:00Z', 'curto').includes('00:00'), false);

checa('data ausente devolve null (a tela decide o texto)', M.formatarDataCritica(null), null);
checa('lixo devolve null, não "Invalid Date"', M.formatarDataCritica('amanhã'), null);
checa('string vazia devolve null', M.formatarDataCritica(''), null);

// ═══════════════════════════════════════════════════════════════════════════
// 2. PRAZO SEM HORA VENCE NO FIM DO DIA — NÃO NO COMEÇO
// ═══════════════════════════════════════════════════════════════════════════
const ISO = '2026-09-15T00:00:00Z';

// ⚠️ O INSTANTE EXATO DO DEFEITO. 14/09 21h00 em Brasília É 15/09 00:00Z:
// era aí que `new Date(iso) < agora` virava true e o banner preto cobria a
// análise inteira.
const _v = (s) => new Date(s);
checa('   (às 21h de 14/09 o código antigo já dizia expirado)',
  _v('2026-09-15T00:00:01Z') > _v(ISO), true);
checa('🎯 às 21h01 de 14/09 o prazo AINDA está aberto',
  M.dataCriticaExpirada(ISO, _v('2026-09-14T21:01:00-03:00')), false);
checa('🎯 às 08h da manhã do próprio 15/09, aberto',
  M.dataCriticaExpirada(ISO, _v('2026-09-15T08:00:00-03:00')), false);
checa('🎯 às 23h59 de 15/09, ainda aberto',
  M.dataCriticaExpirada(ISO, _v('2026-09-15T23:59:00-03:00')), false);
checa('🎯 às 00h01 de 16/09, aí sim expirado',
  M.dataCriticaExpirada(ISO, _v('2026-09-16T00:01:00-03:00')), true);

// Com hora conhecida o prazo é a hora — não o fim do dia.
const ISO_H = '2026-09-15T09:00:00Z';
checa('🎯 com hora conhecida, 08h59 está aberto',
  M.dataCriticaExpirada(ISO_H, _v('2026-09-15T08:59:00-03:00')), false);
checa('🎯 com hora conhecida, 09h01 está fechado',
  M.dataCriticaExpirada(ISO_H, _v('2026-09-15T09:01:00-03:00')), true);
checa('data ausente nunca é "expirada"', M.dataCriticaExpirada(null), false);

// ═══════════════════════════════════════════════════════════════════════════
// 3. URGENTE É RECOMPUTADO — NÃO LIDO DO REGISTRO
// ═══════════════════════════════════════════════════════════════════════════
// 15/09/2026 é uma terça-feira. Contagem em dias úteis, excluindo hoje.
const emQue = (s) => M.diasUteisAteDataCritica(ISO, _v(s));
checa('   terça 15/09 vista da segunda 14/09 → 1 dia útil', emQue('2026-09-14T10:00:00-03:00'), 1);
checa('   vista da sexta 11/09 → 2 dias úteis (o fim de semana não conta)',
  emQue('2026-09-11T10:00:00-03:00'), 2);
checa('   vista do próprio dia → 0', emQue('2026-09-15T10:00:00-03:00'), 0);
checa('   vista de 20 dias antes → mais de 5', emQue('2026-08-26T10:00:00-03:00') > 5, true);

// ⚠️ ESTE PAR É O DEFEITO 2 INTEIRO. Mesmo `data_iso`, dois instantes de
// leitura: o valor gravado não muda, o que a tela mostra tem que mudar.
checa('🎯 20 dias antes: não urgente', M.dataCriticaUrgente(ISO, _v('2026-08-26T10:00:00-03:00')), false);
checa('🎯 na véspera: URGENTE (com o campo gravado ainda dizendo false)',
  M.dataCriticaUrgente(ISO, _v('2026-09-14T10:00:00-03:00')), true);
checa('🎯 no próprio dia: URGENTE', M.dataCriticaUrgente(ISO, _v('2026-09-15T08:00:00-03:00')), true);
checa('🎯 depois de vencer: não urgente (e nunca vermelho)',
  M.dataCriticaUrgente(ISO, _v('2026-09-17T08:00:00-03:00')), false);

checa('🎯 "vence hoje" só no próprio dia', M.venceHoje(ISO, _v('2026-09-15T08:00:00-03:00')), true);
checa('   na véspera não é hoje', M.venceHoje(ISO, _v('2026-09-14T23:00:00-03:00')), false);
// ⚠️ `venceHoje` NÃO pode ser derivado de `diasUteis === 0`: um prazo no
// sábado de amanhã também devolve 0 (o loop anda um dia e não conta o fim de
// semana). Sábado 19/09/2026, visto da sexta 18/09.
checa('   (diasUteis===0 também acontece para o sábado de amanhã)',
  M.diasUteisAteDataCritica('2026-09-19T00:00:00Z', _v('2026-09-18T10:00:00-03:00')), 0);
checa('🎯 mas sábado-de-amanhã NÃO é "vence hoje"',
  M.venceHoje('2026-09-19T00:00:00Z', _v('2026-09-18T10:00:00-03:00')), false);

// ═══════════════════════════════════════════════════════════════════════════
// 4. A TELA E O PDF USAM ESTA RÉGUA — NÃO `new Date` DIRETO
// ═══════════════════════════════════════════════════════════════════════════
// Sem esta seção, alguém reintroduz `new Date(dc.data_iso)` num render novo e
// o dia volta a recuar sem quebrar nenhuma asserção acima.
const soCodigo = (txt) => txt
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const TELA = soCodigo(readFileSync(join(RAIZ, 'src/components/AnalysisResults.tsx'), 'utf-8'));
const PDF = soCodigo(readFileSync(join(RAIZ, 'src/lib/exportPdf.ts'), 'utf-8'));

checa('🎯 nenhum `new Date(...data_iso)` sobrou na tela',
  /new Date\(\s*(dc|d|dataExpirada)\.data_iso/.test(TELA), false);
checa('🎯 nem no PDF', /new Date\(iso\)|new Date\(\s*d\.data_iso/.test(PDF), false);
checa('🎯 a tela importa a régua', TELA.includes("from '@/lib/datasCriticas'"), true);
checa('🎯 o PDF importa a mesma régua', PDF.includes("from './datasCriticas'"), true);
// `dc.urgente` gravado não pode voltar a pilotar pixel nenhum.
checa('🎯 o campo congelado `dc.urgente` não decide mais cor/selo',
  /dc\.urgente|d\.urgente/.test(TELA + PDF), false);

rmSync(dir, { recursive: true, force: true });
console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
