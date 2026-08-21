/**
 * Cada número da carteira precisa explicar a si mesmo.
 *
 *   node tests/verifica_ajuda_carteira.mjs
 *
 * "DO PLANO 650/mês · BÔNUS +50 de 50 · ADICIONAIS +50 · DISPONÍVEL 590 de 750"
 * são quatro números que se comportam de formas DIFERENTES — um renova, dois
 * expiram, um não expira nunca — e nada na tela dizia isso. Pior: 650 ao lado
 * de "590 de 750" não fecha de cabeça, e a conclusão natural de quem olha é que
 * o sistema errou.
 *
 * ⚠️ POR QUE NAVEGADOR: o `?` tem de funcionar no TOQUE. O projeto já teve
 * `title=""` em cinco lugares e ele nunca aparecia no celular — foi por isso
 * que o componente `Tooltip` existe. Um teste que só lesse o JSX não
 * distinguiria um do outro.
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
let ok = true;

function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

// Exatamente o estado que o usuário colou.
const QUOTA = {
  tier: 4, ilimitado: false, limite: 650, usado: 160, restante: 590,
  bonus: 50, bonus_usado: 0, bonus_restante: 50,
  bonus_campanha: 0, bonus_campanha_usado: 0, bonus_campanha_restante: 0,
  bonus_campanha_dias: null, bonus_campanha_nome: null,
  bonus_recorrente: 0, bonus_recorrente_usado: 0, bonus_recorrente_restante: 0,
  bonus_recorrente_meses: null, bonus_recorrente_suspenso: false,
  creditos_extras: 50, saldo: 750, teto_cortesia: 862,
  cortesia_usada: 0, consumo_total: 160, em_cortesia: false,
  profunda_pausada: false, reseta_em: '2026-09-02', dias_para_reset: 13,
  sublimite_profunda: null, peso_profunda: 4, caracteres_por_credito: 50000,
  precificacao: null, max_chars: 400000, unidade: 'creditos',
};

const RESPOSTAS = {
  '/api/analyses/quota': QUOTA,
  '/api/users/me': { _id: 'u1', email: 'teste@bawzi.com', name: 'Teste', tier: 4,
                     active_workspace_id: 'w1' },
  '/api/workspace/details': { _id: 'w1', name: 'WS', tier: 4, member_count: 1,
                              members: [], empresas: [] },
  '/api/workspace/members': [],
  '/api/billing/invoices': [],
  '/api/tiers/config': { tiers: [] },
  '/api/admin/promo-banner/public': { active: false },
};

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
// Viewport de celular: é onde `title=""` falhava e onde o `?` mais importa.
const pagina = await navegador.newPage({
  viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true,
});
const errosJs = [];
pagina.on('pageerror', (e) => errosJs.push(String(e).slice(0, 160)));

await pagina.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'),
  async (rota) => {
    const r = await rota.fetch();
    const h = { ...r.headers() };
    delete h['content-security-policy'];
    delete h['content-security-policy-report-only'];
    await rota.fulfill({ response: r, headers: h });
  });
await pagina.route((u) => u.pathname.startsWith('/api/'), async (rota, req) => {
  const p = new URL(req.url()).pathname;
  if (p.endsWith('/auth/refresh')) {
    return rota.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake' }) });
  }
  await rota.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(RESPOSTAS[p] ?? {}) });
});
await pagina.addInitScript(() => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  localStorage.setItem('bawzi_token',
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u', exp })}.x`);
});

await pagina.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(3200);

// Os `?` da carteira: um por número.
const ajudas = pagina.locator('button[aria-label^="O que significa:"]');
const rotulos = (await ajudas.evaluateAll(
  (els) => els.map((e) => e.getAttribute('aria-label').replace('O que significa: ', ''))));

for (const r of ['Do plano', 'Bônus', 'Adicionais', 'Disponível']) {
  checa(`🎯 "${r}" tem um ?`, rotulos.includes(r), true);
}
// ⚠️ Sem campanha nem cortesia nesta conta, os `?` desses também não podem
// aparecer — um botão de ajuda para um número que não está na tela é ruído.
checa('e não há ? sobrando para números ausentes',
  rotulos.filter((r) => ['Campanha', 'Campanha /mês', 'Por nossa conta'].includes(r)), []);

// ── Os quatro números numa linha só ─────────────────────────────────────────
// ⚠️ A CARTEIRA É UMA CONTA, NÃO QUATRO NÚMEROS SOLTOS. Quebrada em 2×2,
// "Disponível" desce para longe de "Do plano" e some a relação entre eles —
// que é exatamente a dúvida ("650 no plano, mas 590 de 750?") que os `?`
// vieram matar. Ou seja: quebrar a linha desfaz metade do trabalho anterior.
//
// Medido: a 390px sobram 316px úteis no perfil e o conteúdo exigia 351px.
// O ajuste foi todo em espaço vazio — `tracking` zerado no celular, `?` de
// 16px para 12px, respiro entre colunas e moldura dos cartões — sem abreviar
// nenhum rótulo. Este teste é o que impede o próximo ajuste de reintroduzir a
// quebra sem ninguém perceber: só o navegador sabe onde a linha parte.
const linhas = await ajudas.evaluateAll((els) => {
  const y = els.map((e) => Math.round(e.closest('p').parentElement.getBoundingClientRect().y));
  return [...new Set(y)].length;
});
checa('🎯 os quatro números cabem numa linha só a 390px', linhas, 1);

// ⚠️ E O ALVO DE TOQUE NÃO ENCOLHEU JUNTO. O `?` tem 12px visíveis; o que o
// mantém tocável é um `before:-inset-3` que estende a área clicável para 36px
// sem ocupar espaço no layout. Trocar esse `before:` por padding de verdade
// devolveria a quebra de linha, e tirá-lo deixaria um alvo de 12px no celular
// — menor que o mínimo de 24px do WCAG e menor ainda que o dedo de quem
// realmente precisa da explicação.
// ⚠️ ROLA ATÉ A CARTEIRA ANTES DE MEDIR. `elementFromPoint` trabalha em
// coordenadas de VIEWPORT: com o painel a 3489px do topo ele devolve `null`
// para todo ponto, inclusive o centro do próprio botão — e o teste "falharia"
// sem nada de errado no componente.
await pagina.locator('button[aria-label="O que significa: Disponível"]').scrollIntoViewIfNeeded();
await pagina.waitForTimeout(200);
const alvo = await pagina.evaluate(() => {
  const b = document.querySelector('button[aria-label="O que significa: Disponível"]');
  const r = b.getBoundingClientRect();
  // 14px acima do centro: fora dos 12px do ícone, dentro dos 36px do `before:`.
  const alvoAcima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2 - 14);
  return { visivel: Math.round(r.width), pegaFora: alvoAcima?.closest('button') === b };
});
checa('o ? encolheu só no visual (12px)', alvo.visivel, 12);
checa('🎯 mas continua tocável 14px fora do ícone', alvo.pegaFora, true);

// ── O toque abre, que é o ponto do componente ───────────────────────────────
// ⚠️ SELECIONA PELO `aria-label`, não por índice. `nth()` sobre um filtro
// depende da ordem do DOM e quebra em silêncio quando uma coluna condicional
// (campanha, cortesia) aparece — passaria a medir o balão errado.
const botao = (r) => pagina.locator(`button[aria-label="O que significa: ${r}"]`);
await botao('Disponível').tap();
await pagina.waitForTimeout(400);
const balao = pagina.locator('[role="tooltip"]');
checa('🎯 o ? abre por TOQUE (title="" nunca abria no celular)',
  await balao.count() > 0, true);

// ⚠️ COMPARA COM MAIÚSCULAS/MINÚSCULAS EXATAS, de propósito. `innerText`
// devolve o texto RENDERIZADO: foi assim que apareceu que o balão herdava
// `uppercase` do rótulo e saía inteiro em caixa alta. Normalizar a caixa aqui
// esconderia justamente esse defeito.
const texto = (await balao.first().innerText()).replace(/\s+/g, ' ');
checa('🎯 o balão não herda o `uppercase` do rótulo ao lado',
  texto === texto.toUpperCase(), false);
// A conta escrita, com os números desta conta — é o que responde "por que 590
// e não 650?" antes de virar chamado.
checa('🎯 o balão mostra a conta com as parcelas reais',
  texto.includes('650 do plano') && texto.includes('+ 50 de bônus')
  && texto.includes('+ 50 adicionais'), true);
checa('🎯 e fecha a conta até o disponível',
  texto.includes('= 750 no ciclo') && texto.includes('− 160 usados')
  && texto.includes('= 590 disponíveis'), true);

// ⚠️ E O TEXTO NÃO PODE ESTAR RECORTADO NA HORIZONTAL. Este é o mesmo defeito
// do `uppercase`, por outra propriedade: quando a carteira precisou caber em
// uma linha, o rótulo ganhou `whitespace-nowrap` e o balão HERDOU — a
// explicação inteira virou uma linha só e o `overflow-y-auto` cortou tudo à
// direita ("...É a soma de tudo à esquerda, r"). O `innerText` continuava
// completo, então nenhuma asserção de texto pegaria: só a medição pega.
const recorte = await pagina.evaluate(() => {
  const b = document.querySelector('[role="tooltip"]');
  return { sobra: Math.round(b.scrollWidth - b.clientWidth),
           quebra: getComputedStyle(b).whiteSpace };
});
checa('🎯 o balão não herda o `nowrap` do rótulo (texto recortado à direita)',
  recorte.quebra, 'normal');
checa('e por isso não sobra texto para os lados', recorte.sobra <= 1, true);

// ── O balão nasce no `body`, senão o menu passa por cima ────────────────────
// ⚠️ `z-[9999]` NÃO GARANTE NADA SOZINHO. `z-index` só compete dentro do
// contexto de empilhamento em que o elemento nasce, e na tela de análise a
// cadeia acima do gatilho era `section.relative z-10` → `div.relative z-20`:
// os 9999 valiam apenas dentro daquele `z-10`, e o trilho do menu — `fixed
// z-30` na raiz — pintava por cima e cortava a explicação ao meio.
//
// ⚠️ E ISSO NÃO DÁ PARA MEDIR COM `elementFromPoint`: o trilho é
// `pointer-events-none`, então ele pinta por cima mas some do teste de clique
// — toda sondagem por hit-test dizia que o balão estava no topo enquanto a
// tela mostrava o contrário. Por isso a asserção é ESTRUTURAL: filho do
// `body`, sem nenhum contexto de empilhamento no caminho. É o que o portal
// garante, e é o que um `overflow`, um `transform` ou um `z-index` novo em
// qualquer ancestral voltaria a quebrar em silêncio.
const empilhamento = await pagina.evaluate(() => {
  const b = document.querySelector('[role="tooltip"]');
  const presos = [];
  for (let e = b.parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.transform !== 'none' || s.filter !== 'none' || s.opacity !== '1'
        || s.willChange !== 'auto' || s.isolation === 'isolate'
        || (s.position !== 'static' && s.zIndex !== 'auto')) {
      presos.push(`${e.tagName.toLowerCase()}(${s.position}/z:${s.zIndex})`);
    }
  }
  return { pai: b.parentElement?.tagName.toLowerCase(), presos };
});
checa('🎯 o balão é filho do body (portal), não do gatilho', empilhamento.pai, 'body');
checa('🎯 e nenhum ancestral prende o z-index dele', empilhamento.presos, []);

// ── O balão cabe na tela do celular ─────────────────────────────────────────
// ⚠️ Foi por vazar a viewport que o componente virou `position: fixed`. Um `?`
// novo num lugar apertado pode reintroduzir o problema.
const cx = await balao.first().boundingBox();
checa('🎯 o balão não vaza a lateral da tela',
  cx !== null && cx.x >= 0 && cx.x + cx.width <= 390, true);
checa('nem o rodapé', cx !== null && cx.y + cx.height <= 780, true);

// Escape fecha.
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(300);
checa('Escape fecha o balão', await pagina.locator('[role="tooltip"]').count(), 0);

// ── Cada explicação diz a REGRA daquele número, não só o nome ───────────────
const esperado = {
  'Do plano': 'não',            // "o que sobrar NÃO passa para o próximo ciclo"
  'Bônus': 'expiram no reset',
  'Adicionais': 'não expiram',
};
for (const [rot, trecho] of Object.entries(esperado)) {
  await botao(rot).tap();
  await pagina.waitForTimeout(350);
  const t = (await pagina.locator('[role="tooltip"]').first().innerText()).replace(/\s+/g, ' ');
  checa(`🎯 "${rot}" explica o que acontece na renovação`, t.includes(trecho), true);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(200);
}

// ── E o rodapé NÃO repete o que o `?` já explica ────────────────────────────
// ⚠️ A FRASE DE BAIXO ERA A VERSÃO ANTIGA DA MESMA AJUDA. Antes dos `?` ela
// carregava sete regras em texto corrido de 10px — o que expira, o que não
// acumula, o que não expira nunca — porque os números acima não se explicavam.
// Com a explicação no lugar certo, repetir aqui não reforça: dilui, e cria uma
// segunda redação da mesma regra para divergir no primeiro ajuste (foi assim
// que este app acabou com quatro vocabulários para os mesmos cinco planos).
// Sobra o que NÃO tem coluna própria: o consumido e quando renova.
const rodape = await pagina.evaluate(() => {
  const p = [...document.querySelectorAll('p')]
    .find((e) => /^\d[\d.]*\s+usados/.test(e.innerText.trim()));
  return p ? p.innerText.replace(/\s+/g, ' ').trim() : null;
});
// ⚠️ SEM O "renova em N dias" NESTA TELA, e isso é de propósito. A aba
// Assinatura passou a mostrar "Ciclo: 02/08 → 02/09 · Cobra de novo em 12
// dias" logo abaixo da carteira — a mesma contagem a 46px de distância. Nas
// outras telas (Radar, barra de créditos) a frase mantém o prazo, porque lá
// não existe a linha do ciclo; é o `semReset` do `detalhesDeCreditos`.
checa('🎯 o rodapé virou uma linha curta', rodape, '160 usados');
checa('e não repete as regras que agora moram no ?',
  /expiram|não acumula|adicionais/.test(rodape || ''), false);

checa('nenhum erro de JS', errosJs, []);

await botao('Disponível').tap();
await pagina.waitForTimeout(500);
await pagina.screenshot({ path: 'tests/ajuda-carteira.png' });

// ── E no desktop o "Comprar créditos" fica na MESMA linha dos números ───────
// ⚠️ 1024px, NÃO 1280. A janela larga sempre coube; o defeito morava nas
// larguras intermediárias — a linha pedia 666px e o cartão dava 646, então o
// botão caía sozinho para uma segunda linha e o cartão ganhava uma faixa vazia
// à direita dos números. Só o navegador sabe disso: o JSX é o mesmo em toda
// largura, e um teste a 1280 passaria feliz enquanto a tela quebrava a 1024.
//
// O que devolveu os 20px foi tirar ar, não conteúdo: `tracking` de 0.16em para
// 0.08em (a 10px, 0.16em custa 1,6px POR LETRA — 58px nos quatro rótulos) e o
// botão adotando o `BOTAO_SECUNDARIO` que a tela de análise já usava, em vez
// do clone `h-9 text-xs` que tinha aqui.
const desktop = await navegador.newPage({ viewport: { width: 1024, height: 900 } });
await desktop.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'),
  async (rota) => {
    const r = await rota.fetch();
    const h = { ...r.headers() };
    delete h['content-security-policy'];
    delete h['content-security-policy-report-only'];
    await rota.fulfill({ response: r, headers: h });
  });
await desktop.route((u) => u.pathname.startsWith('/api/'), async (rota, req) => {
  const p = new URL(req.url()).pathname;
  if (p.endsWith('/auth/refresh')) {
    return rota.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake' }) });
  }
  await rota.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(RESPOSTAS[p] ?? {}) });
});
await desktop.addInitScript(() => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  localStorage.setItem('bawzi_token',
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u', exp })}.x`);
});
await desktop.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
await desktop.waitForTimeout(3200);
const noDesktop = await desktop.evaluate(() => {
  const bts = [...document.querySelectorAll('button[aria-label^="O que significa:"]')]
    .filter((b) => b.closest('p'));
  const cols = bts.map((b) => b.closest('p').parentElement.getBoundingClientRect());
  const comprar = [...document.querySelectorAll('button')]
    .find((b) => /Comprar cr[eé]ditos/i.test(b.textContent || ''));
  return {
    linhas: new Set(cols.map((c) => Math.round(c.y))).size,
    // Mesma faixa vertical que os números = mesma linha visual.
    juntos: Math.abs(comprar.getBoundingClientRect().y - cols[0].y) < 30,
  };
});
checa('🎯 a 1024px os números continuam numa linha', noDesktop.linhas, 1);
checa('🎯 e o "Comprar créditos" fica na mesma linha, não sozinho embaixo',
  noDesktop.juntos, true);

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await navegador.close();
process.exit(ok ? 0 : 1);
