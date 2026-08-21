/**
 * O modal do Raio-X não pode nascer debaixo do cabeçalho.
 *
 *   node tests/verifica_modal_dossie.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O CORTE, E POR QUE O `z-index` NÃO EXPLICAVA
 * ═══════════════════════════════════════════════════════════════════════════
 * O topo do modal — a barra escura com "Raio-X Competitivo", o nome do
 * concorrente e o ✖ — aparecia por baixo do cabeçalho do site.
 *
 * O overlay já pedia `z-50`, o mesmo do cabeçalho, e vinha DEPOIS dele no DOM:
 * pela regra de desempate deveria ganhar. Não ganhava porque
 * `analysis-app.tsx` envolve a página numa `<section className="relative
 * z-10">`, e `position: relative` com `z-index` numérico CRIA UM CONTEXTO DE
 * EMPILHAMENTO. Dali para dentro, `z-50` só vale entre irmãos da seção; lá
 * fora quem disputa com o cabeçalho é a seção, valendo 10.
 *
 * É por isso que este arquivo testa o MECANISMO e não só o resultado: a
 * diferença entre "funciona" e "não funciona" é um ancestral três níveis
 * acima, num arquivo diferente, sem nenhuma menção a modal. Quem for mexer
 * nisso depois não tem como adivinhar — e a tentação natural, subir o
 * `z-index`, não resolve: dentro de um contexto de z-10, `z-[9999]` continua
 * valendo 10 do lado de fora.
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

let ok = true;
function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await nav.newPage({ viewport: { width: 1280, height: 800 } });
// Carrega o CSS real da aplicação — sem ele o teste mediria classes inexistentes.
await pg.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);

// ═══════════════════════════════════════════════════════════════════════════
// 1. O mecanismo, reproduzido com o CSS real
// ═══════════════════════════════════════════════════════════════════════════
const medir = await pg.evaluate(() => {
  // `paraOndeVai`: 'dentro' reproduz o defeito (modal como filho da seção),
  // 'body' reproduz a correção (portal).
  const montar = (paraOndeVai) => {
    document.body.innerHTML = `
      <div id="cabecalho" class="sticky top-0 z-50">
        <header id="barra" class="bg-white/90 backdrop-blur-xl border-b" style="height:73px"></header>
      </div>
      <main>
        <section id="secao" class="relative z-10">
          <div class="bg-white overflow-hidden relative"><div id="ancora" class="mt-4"></div></div>
        </section>
      </main>`;
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div id="cartao" class="bg-white w-full max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div id="titulo" class="bg-slate-900 text-white" style="height:80px">Raio-X Competitivo</div>
        <div class="p-6 flex-1 overflow-y-auto"><div style="height:4000px"></div></div>
      </div>`;
    (paraOndeVai === 'body' ? document.body : document.getElementById('ancora')).appendChild(overlay);

    const rc = document.getElementById('cartao').getBoundingClientRect();
    const x = rc.left + rc.width / 2;
    const noPonto = document.elementFromPoint(x, rc.top + 5);
    return {
      topo: Math.round(rc.top),
      encobertoPeloCabecalho: Math.max(0, 73 - Math.round(rc.top)),
      quemEstaNoTopo: noPonto ? (noPonto.id || noPonto.tagName.toLowerCase()) : null,
      topoDoModalVisivel: noPonto ? !!noPonto.closest('#cartao') : false,
    };
  };
  return { dentroDaSecao: montar('dentro'), noBody: montar('body') };
});

// ⚠️ A GEOMETRIA É IDÊNTICA NOS DOIS CASOS — só o empilhamento muda. Se o topo
// do cartão não chegasse a encostar no cabeçalho, o teste passaria por vazio.
checa('🎯 o cartão realmente encosta no cabeçalho (senão o teste é vazio)',
  medir.dentroDaSecao.encobertoPeloCabecalho > 0, true);
checa('   e a geometria é a mesma nas duas montagens',
  medir.dentroDaSecao.topo, medir.noBody.topo);

checa('🎯 dentro da seção `relative z-10`, quem cobre o topo é o cabeçalho',
  medir.dentroDaSecao.quemEstaNoTopo, 'barra');
checa('🎯 e o topo do modal fica invisível',
  medir.dentroDaSecao.topoDoModalVisivel, false);

checa('🎯 no body (portal), o topo do modal fica na frente',
  medir.noBody.topoDoModalVisivel, true);
checa('   e quem responde no ponto é o próprio título',
  medir.noBody.quemEstaNoTopo, 'titulo');

// ═══════════════════════════════════════════════════════════════════════════
// 2. E o componente real usa o portal
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ O bloco acima prova a REGRA; esta asserção liga a regra ao arquivo. Sem
// ela o teste continuaria verde com o modal voltando para dentro da seção.
const FONTE = readFileSync('src/components/CompetitorWarRoom.tsx', 'utf-8');
const SEM_COMENTARIO = FONTE.replace(/\/\*[\s\S]*?\*\//g, '');
checa('🎯 o modal do dossiê é montado via createPortal no document.body',
  /dossieTarget && typeof document !== 'undefined' && createPortal\(/.test(SEM_COMENTARIO), true);
checa('   e o portal aponta para o body',
  /<\/div>,\s*document\.body,\s*\)\}/.test(SEM_COMENTARIO), true);
checa('createPortal está importado', /import \{ createPortal \} from 'react-dom';/.test(FONTE), true);

// ⚠️ A ARMADILHA DE QUEM FOR "CONSERTAR" ISTO DEPOIS: subir o z-index. Dentro
// de um contexto de z-10 não adianta — esta asserção existe para o próximo
// não trocar o portal por um número maior achando que é equivalente.
checa('🎯 a correção não é z-index inflado',
  /z-\[\d{3,}\]/.test(SEM_COMENTARIO), false);

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await nav.close();
process.exit(ok ? 0 : 1);
