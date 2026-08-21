/**
 * A secção Equipe: vagas do servidor, link de convite, e ações visíveis.
 *
 *   node tests/verifica_equipe.mjs
 *
 * ⚠️ POR QUE NAVEGADOR. Três dos quatro defeitos daqui só existem RENDERIZADOS:
 * as ações de promover/remover estavam atrás de `sm:group-hover`, e portanto
 * invisíveis em qualquer tela ≥640px sem mouse; o número de vagas vinha de um
 * mapa cravado no componente em vez da API; e o botão de copiar depende de
 * `navigator.clipboard`, que nem sempre existe. Nenhum deles aparece lendo JSX.
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

// ⚠️ `vagas_totais: 5` DE PROPÓSITO CONTRA UM tier 4. O mapa cravado no
// componente dizia 10 para o tier 4; se a tela mostrar 10, é porque voltou a
// ler o mapa em vez da API — e é assim que ela passa a bloquear (ou liberar)
// convites que o servidor decide ao contrário.
const MEMBROS = [
  { id: 'u1', name: 'Marcelo Mendes', email: 'development@bawzi.com', is_me: true,  is_owner: true,  is_admin: true },
  { id: 'u2', name: 'Ana Souza',      email: 'ana@bawzi.com',         is_me: false, is_owner: false, is_admin: false },
];
const RESPOSTAS = {
  '/api/users/me': { _id: 'u1', email: 'development@bawzi.com', name: 'Marcelo Mendes', tier: 4,
                     active_workspace_id: 'w1' },
  '/api/workspace/details': { _id: 'w1', name: 'WS', tier: 4, is_admin: true,
                              workspace_name: 'Equipe Bawzi', workspace_users_count: 2,
                              vagas_totais: 5, members_overflow: 0, companies: [], empresas: [] },
  '/api/workspace/members': MEMBROS,
  '/api/workspace/convite-link': { ativo: true, link: 'https://app.bawzi.com/convite?token=abc123',
                                   expira_em: '2026-08-28T12:00:00Z', usos: 2 },
  '/api/billing/invoices': [],
  '/api/billing/subscription-details': { status: 'inactive' },
  '/api/tiers/config': { tiers: [] },
  '/api/tiers/limites-publicos': { tiers: {} },
  '/api/tiers/precos-publicos': { planos: {} },
  '/api/admin/promo-banner/public': { active: false },
};

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
// ⚠️ 900px COM `hasTouch`: é a combinação exata em que as ações sumiam.
// `sm:opacity-0 sm:group-hover:opacity-100` esconde tudo acima de 640px, e num
// tablet não há hover para revelar. Testar a 390 ou com mouse esconderia o bug.
const pg = await nav.newPage({ viewport: { width: 900, height: 900 }, hasTouch: true });
const errosJs = [];
pg.on('pageerror', (e) => errosJs.push(String(e).slice(0, 160)));

await pg.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'), async (r) => {
  const res = await r.fetch(); const h = { ...res.headers() };
  delete h['content-security-policy']; delete h['content-security-policy-report-only'];
  await r.fulfill({ response: res, headers: h });
});
await pg.route((u) => u.pathname.startsWith('/api/'), async (r, q) => {
  const p = new URL(q.url()).pathname;
  if (p.endsWith('/auth/refresh')) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"fake"}' });
  }
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPOSTAS[p] ?? {}) });
});
await pg.addInitScript(() => {
  const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  localStorage.setItem('bawzi_consent_accepted', 'true');
  localStorage.setItem('bawzi_token',
    `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 86400 })}.x`);
});
await pg.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);

const corpo = (await pg.locator('body').innerText()).replace(/\s+/g, ' ');

// ── As vagas vêm do servidor ────────────────────────────────────────────────
checa('🎯 mostra as vagas da API (5), não o mapa cravado (10)',
  /2\s*de\s*5\s*vagas/i.test(corpo), true);
checa('e não sobrou nenhum "de 10" do mapa antigo', /\bde 10 vagas\b/i.test(corpo), false);

// ── As ações existem sem hover ──────────────────────────────────────────────
const remover = pg.locator('button[aria-label^="Remover Ana"]');
const promover = pg.locator('button[aria-label^="Tornar Ana"]');
checa('🎯 "Remover" está visível a 900px sem hover', await remover.isVisible(), true);
checa('🎯 "Promover" também', await promover.isVisible(), true);
// ⚠️ `isVisible` do Playwright ignora `opacity: 0` — um elemento transparente
// conta como visível. A medição da opacidade é o que realmente pega o defeito.
const opac = await remover.evaluate((e) => getComputedStyle(e.parentElement).opacity);
checa('🎯 e não estão transparentes (era `sm:opacity-0`)', opac, '1');

// O dono não pode ser removido nem despromovido por ninguém.
checa('🎯 o proprietário não tem botão de remover',
  await pg.locator('button[aria-label^="Remover Marcelo"]').count(), 0);

// ── O link de convite ───────────────────────────────────────────────────────
const campo = pg.locator('input[aria-label="Link de convite do workspace"]');
checa('🎯 o link ativo aparece pronto para copiar', await campo.inputValue(),
  'https://app.bawzi.com/convite?token=abc123');
checa('e diz quantas pessoas já entraram por ele', /2 pessoas entraram por ele/i.test(corpo), true);
checa('e até quando vale', /Vale até 28\/08\/2026/i.test(corpo), true);
// Desligar o link não expulsa ninguém — a frase é a promessa que impede o
// dono de achar que está removendo membros ao revogar.
checa('🎯 avisa que desligar não expulsa quem já entrou',
  /quem já entrou continua no workspace/i.test(corpo), true);

// ── O modal diz o que realmente acontece ────────────────────────────────────
// ⚠️ `/workspace/invite` NÃO CONVIDA: move a conta na hora, sem aceite, e tira
// a pessoa do workspace dela. O texto antigo dizia "dar acesso à plataforma".
await pg.locator('button', { hasText: /Convidar membro/i }).first().click();
await pg.waitForTimeout(600);
const modal = (await pg.locator('body').innerText()).replace(/\s+/g, ' ');
checa('🎯 o modal avisa que a pessoa entra na hora, sem aceitar',
  /entra na hora, sem precisar aceitar/i.test(modal), true);
checa('🎯 e que ela sai do workspace atual dela',
  /sai do workspace em que estiver/i.test(modal), true);

checa('nenhum erro de JS', errosJs, []);

// ⚠️ FECHA PELO BOTÃO, NÃO POR `Escape`. O modal não escuta Escape (ao
// contrário do `Tooltip`, que fecha) — e um teste que apertasse Escape e
// seguisse em frente capturaria a tela com o modal por cima sem acusar nada.
await pg.locator('button', { hasText: /^Cancelar$/i }).first().click();
await pg.waitForTimeout(400);
checa('o modal fecha no Cancelar',
  await pg.locator('input[placeholder="exemplo@empresa.com"]').count(), 0);
const secao = pg.locator('#sec-equipe, section').filter({ hasText: /Membros do workspace/ }).first();
await secao.scrollIntoViewIfNeeded();
await pg.waitForTimeout(300);
await secao.screenshot({ path: 'tests/equipe.png' });
console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await nav.close();
process.exit(ok ? 0 : 1);
