/**
 * O menu da conta, no cabeçalho.
 *
 *   node tests/verifica_menu_conta.mjs
 *
 * ⚠️ POR QUE NAVEGADOR. Os três defeitos daqui eram invisíveis no JSX:
 *   · a setinha do balão existia no markup e NUNCA aparecia — nascia 11px
 *     acima do topo de um cartão `overflow-hidden`, portanto recortada;
 *   · o gatilho não declarava `aria-expanded`/`aria-haspopup`, então para um
 *     leitor de tela era um botão qualquer, sem menu associado;
 *   · Escape não fechava: quem abria pelo teclado ficava preso.
 * Ler o componente mostraria markup plausível nos três casos.
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = Number(process.env.W || 1280);
let ok = true;

function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}
const R = {
  '/api/users/me': { _id: 'u1', email: 'development@bawzi.com', name: 'Marcelo Mendes', tier: 4,
                     active_workspace_id: 'w1' },
  '/api/workspace/details': { _id: 'w1', name: 'WS', tier: 4, workspace_name: 'Equipe Bawzi',
                              companies: [{ cnpj: '11222333000181', name: 'TESTE LTDA' }], empresas: [] },
  '/api/workspace/members': [],
  '/api/analyses/quota': { tier: 4, ilimitado: false, limite: 650, usado: 160, saldo: 750,
                           creditos_extras: 50, bonus: 50, bonus_restante: 50, dias_para_reset: 12,
                           unidade: 'creditos' },
  '/api/tiers/config': { status: 'success', config: {} },
  '/api/tiers/limites-publicos': { tiers: {} },
  '/api/tiers/precos-publicos': { planos: {} },
  '/api/admin/promo-banner/public': { active: false },
  '/api/billing/invoices': [], '/api/billing/subscription-details': { status: 'inactive' },
};
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await nav.newPage({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 });
const errosJs = [];
pg.on('pageerror', (e) => errosJs.push(String(e).slice(0, 160)));
await pg.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'), async (r) => {
  const res = await r.fetch(); const h = { ...res.headers() };
  delete h['content-security-policy']; delete h['content-security-policy-report-only'];
  await r.fulfill({ response: res, headers: h }); });
await pg.route((u) => u.pathname.startsWith('/api/'), async (r, q) => {
  const p = new URL(q.url()).pathname;
  if (p.endsWith('/auth/refresh')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"fake"}' });
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(R[p] ?? {}) }); });
await pg.addInitScript(() => {
  const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  localStorage.setItem('bawzi_consent_accepted', 'true');
  localStorage.setItem('bawzi_tier', '4');
  localStorage.setItem('user_name', 'Marcelo Mendes');
  localStorage.setItem('user_email', 'development@bawzi.com');
  localStorage.setItem('bawzi_token', `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 86400 })}.x`);
});
await pg.goto('http://127.0.0.1:3100/workspace', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3200);

const gatilho = pg.locator('button[aria-label="Menu do usuário"]');
checa('o gatilho anuncia que abre um menu',
  await gatilho.getAttribute('aria-haspopup'), 'menu');
checa('e que está fechado', await gatilho.getAttribute('aria-expanded'), 'false');

await gatilho.click();
await pg.waitForTimeout(400);
checa('🎯 aberto, o gatilho declara `aria-expanded`',
  await gatilho.getAttribute('aria-expanded'), 'true');

const menu = pg.locator('[role="menu"]');
checa('o painel é um menu para leitor de tela', await menu.count(), 1);

// ── O plano tem NOME, não só número ─────────────────────────────────────────
// ⚠️ "NÍVEL 4" sozinho obriga a pessoa a decorar a tabela de planos. O nome é
// o que ela reconhece da página de preços e da fatura.
const texto = (await menu.innerText()).replace(/\s+/g, ' ');
checa('🎯 o menu mostra o NOME do plano', /Avançado/.test(texto), true);
checa('e mantém o nível como referência secundária', /N4/.test(texto), true);

// ── Os caminhos que o menu precisa oferecer ─────────────────────────────────
for (const [rotulo, href] of [['Meu perfil', '/profile'],
                              ['Equipe', '/profile#sec-equipe'],
                              ['Planos e créditos', '/plans']]) {
  checa(`🎯 "${rotulo}" leva a ${href}`,
    await menu.locator(`a[href="${href}"]`).count(), 1);
}
checa('e há como sair', await menu.locator('button', { hasText: /^Sair$/ }).count(), 1);

// ── Nada de decoração recortada ─────────────────────────────────────────────
// ⚠️ A setinha antiga era markup morto: `-top-2` dentro de um cartão
// `overflow-hidden`. Este teste impede que ela — ou outra decoração fora do
// recorte — volte sem que alguém perceba que não aparece.
const recortado = await pg.evaluate(() => {
  const cartao = document.querySelector('[role="menu"] .overflow-hidden');
  if (!cartao) return 'sem cartão';
  const rc = cartao.getBoundingClientRect();
  return [...cartao.querySelectorAll('*')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.bottom < rc.top || r.top > rc.bottom);
  });
});
checa('🎯 nenhum elemento nasce fora do recorte do cartão', recortado, false);

// ── Escape fecha e devolve o foco ───────────────────────────────────────────
await pg.keyboard.press('Escape');
await pg.waitForTimeout(300);
checa('🎯 Escape fecha o menu', await pg.locator('[role="menu"]').count(), 0);
// Sem devolver o foco, a próxima tabulação recomeça do topo da página.
checa('🎯 e o foco volta para o gatilho',
  await pg.evaluate(() => document.activeElement?.getAttribute('aria-label')),
  'Menu do usuário');

checa('nenhum erro de JS', errosJs, []);

await gatilho.click();
await pg.waitForTimeout(400);
const cx = await pg.evaluate(() => {
  const el = document.querySelector('[role="menu"]');
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x - 24), y: Math.max(0, r.y - 24), width: r.width + 48, height: r.height + 48 };
});
await pg.screenshot({ path: 'tests/menu-conta.png', clip: cx });
console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await nav.close();
process.exit(ok ? 0 : 1);
