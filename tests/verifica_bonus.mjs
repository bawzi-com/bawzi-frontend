/**
 * O bônus tem de APARECER — no bolso do cliente e no painel de quem o define.
 *
 *   node tests/verifica_bonus.mjs
 *
 * ⚠️ POR QUE NAVEGADOR E NÃO LEITURA DE JSX: nesta mesma sessão descobri que
 * `text-${cor}-400` construído por interpolação nunca chegava ao CSS, e que
 * três regras sem `@layer` em `base.css` venciam as utilities do Tailwind em
 * todo o app. Código que parece certo e não pinta nada na tela é a falha
 * recorrente aqui; a única prova é medir o que o browser renderizou.
 *
 * O backend é falso. O que está em teste é a tradução dos números para a tela,
 * não a contabilidade — essa vive em backend/tests/test_bonus_de_plano.py.
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

// ── Estado: Essencial, 90 do plano + 30 de bônus, 22 já usados ──────────────
// 22 usados, dos quais 22 saíram do bônus (bônus primeiro) → restam 8.
const QUOTA = {
  tier: 2, ilimitado: false, limite: 90, usado: 22, restante: 98,
  bonus: 30, bonus_usado: 22, bonus_restante: 8,
  creditos_extras: 0, saldo: 120, teto_cortesia: 138,
  cortesia_usada: 0, consumo_total: 22, em_cortesia: false,
  profunda_pausada: false, reseta_em: '2026-09-01', dias_para_reset: 13,
  sublimite_profunda: null, peso_profunda: 4, caracteres_por_credito: 50000,
  precificacao: null, max_chars: 300000, unidade: 'creditos',
};

const TIER_CONFIGS = [
  { tier_id: 1, label: 'Gratuito', name: 'Gratuito', monthly_limit: 5, bonus_creditos: 0,
    max_chars: 50000, max_mb: 5, investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o-mini',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o-mini',
    agent_count: 1, limit_profunda: null, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, price_brl: 0, available_models: ['gpt-4o-mini'],
    model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini' } },
  { tier_id: 2, label: 'Essencial', name: 'Essencial', monthly_limit: 90, bonus_creditos: 30,
    max_chars: 150000, max_mb: 10, investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o',
    agent_count: 2, limit_profunda: 20, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, price_brl: 79, available_models: ['gpt-4o-mini', 'gpt-4o'],
    model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini', 'gpt-4o': 'gpt-4o' } },
  // ⚠️ ILIMITADO COM BÔNUS 0. O backend zera o bônus quando monthly_limit é 0;
  // a tela tem de refletir isso desabilitando o campo, senão o operador digita
  // um número, salva, e nada acontece — sem nenhuma explicação na interface.
  { tier_id: 4, label: 'Avançado', name: 'Avançado', monthly_limit: 0, bonus_creditos: 0,
    max_chars: 400000, max_mb: 25, investigator_model: 'gpt-4o', writer_model: 'gpt-4o',
    investigator_model_rapido: 'gpt-4o', writer_model_rapido: 'gpt-4o',
    agent_count: 3, limit_profunda: 60, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, price_brl: 497, available_models: ['gpt-4o'],
    model_resolution: { 'gpt-4o': 'gpt-4o' } },
];

const BONUS_USO = {
  janela: 'mes_calendario', mes_corrente: '2026-08',
  total_concedido: 360, total_consumido: 214,
  tiers: [
    { tier_id: 1, nome: 'Gratuito', monthly_limit: 5, bonus_por_ciclo: 0,
      workspaces_ativos: 40, concedido: 0, consumido: 0, a_expirar: 0, credito_cobrado: 91 },
    { tier_id: 2, nome: 'Essencial', monthly_limit: 90, bonus_por_ciclo: 30,
      workspaces_ativos: 12, concedido: 360, consumido: 214, a_expirar: 146, credito_cobrado: 806 },
  ],
  serie_mensal: { '2026-07': { '2': 180 }, '2026-08': { '2': 214 } },
};

const RESPOSTAS = {
  '/api/analyses/quota': QUOTA,
  '/api/admin/tier-configs': TIER_CONFIGS,
  '/api/admin/bonus/uso': BONUS_USO,
  '/api/admin/stats': { kpis: { usuarios: 1, analises_totais: 0, analises_24h: 0, conversao_pro: 0, cost_usd_total: 0 }, heavy_users: [], tiers: {} },
  '/api/admin/users': [],
  '/api/admin/email-templates': [],
  '/api/email/smtp': {},
  '/api/billing/admin/stripe-config': {},
  '/api/admin/precos-modelo': { modelos: [], cambio: { cotacao: 5.4 } },
  // ⚠️ OS ENDPOINTS DE LISTA PRECISAM DEVOLVER LISTA. Um `{}` genérico aqui
  // derruba a página inteira com "l.map is not a function" — a mesma classe de
  // falha que um stub `{}` já expôs no painel de notificações desta sessão.
  '/api/workspace/members': [],
  '/api/billing/invoices': [],
  '/api/users/me': { _id: 'u1', email: 'teste@bawzi.com', name: 'Teste', tier: 2,
                     active_workspace_id: 'w1' },
  '/api/workspace/details': { _id: 'w1', name: 'Workspace', tier: 2, member_count: 1,
                              members: [], empresas: [] },
  '/api/tiers/config': { tiers: [] },
};

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1100 } });
const errosJs = [];
pagina.on('pageerror', (e) => errosJs.push(String(e).slice(0, 160)));

// O documento vem com `connect-src 'self'` e o API_URL de dev aponta para
// :8000 — outra origem. Sem tirar o CSP, o browser bloqueia antes da camada de
// interceção e nenhuma chamada chega ao `route`.
await pagina.route((u) => u.pathname === '/admin' || u.pathname === '/profile', async (rota) => {
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
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'admin', exp, is_admin: true })}.x`);
});

// ═══════════════════════════════════════════════════════════════════════════
// A CARTEIRA DO CLIENTE
// ═══════════════════════════════════════════════════════════════════════════
await pagina.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(3000);
// ⚠️ `innerText` DEVOLVE O TEXTO RENDERIZADO, com `text-transform` aplicado.
// Os rótulos da carteira e do Admin usam `uppercase`, então procurar por
// "Bônus" com caixa exata falha embora a tela mostre a palavra. Comparo tudo
// em minúsculas — é o que o olho lê, não o que o JSX escreveu.
const perfil = (await pagina.locator('body').innerText()).toLowerCase();

checa('🎯 a carteira tem uma coluna "Bônus"', /\bbônus\b/.test(perfil), true);
checa('🎯 e ela mostra o que RESTA, não o total concedido',
  /\+8\s*de\s*30/.test(perfil.replace(/\s+/g, ' ')), true);
// ⚠️ O aviso de expiração é o que separa este número de um saldo comum. Sem
// ele o cliente guarda o bônus achando que acumula, e perde.
// ⚠️ ELE MUDOU DE LUGAR, NÃO SUMIU. Era uma frase de rodapé — "8 de bônus do
// plano a usar até o reset (depois expiram)" — dentro da linha de 10px que
// carregava as sete regras da carteira de uma vez e que ninguém lia. Hoje mora
// no `?` da própria coluna "Bônus", que é onde a dúvida nasce. A asserção
// seguiu o aviso: o que importa é que o cliente CONSIGA ler que expira, não em
// que parágrafo a frase está.
// ⚠️ ROLA ANTES, CLICA DEPOIS — e não os dois no mesmo comando. O `Tooltip`
// fecha em qualquer `scroll` (um balão `fixed` não acompanha o gatilho, e
// apontar para o nada é pior que sumir). O auto-scroll do `click()` acontece
// junto com o clique, e a rolagem residual fechava o balão no mesmo quadro em
// que ele abria: `aria-expanded` voltava a `false` e o teste falhava sem nada
// de errado no componente.
const gatilhoBonus = pagina.locator('button[aria-label="O que significa: Bônus"]').first();
await gatilhoBonus.scrollIntoViewIfNeeded();
await pagina.waitForTimeout(400);
await gatilhoBonus.click();
await pagina.waitForTimeout(400);
const ajudaBonus = (await pagina.locator('[role="tooltip"]').first().innerText())
  .replace(/\s+/g, ' ').toLowerCase();
checa('🎯 o ? do bônus avisa que ele expira no reset',
  ajudaBonus.includes('expiram no reset'), true);
checa('e diz quanto resta, não só o total concedido',
  ajudaBonus.includes('restam 8'), true);
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(200);
checa('o saldo total já inclui o bônus (120, não 90)',
  perfil.includes('de 120'), true);

// ═══════════════════════════════════════════════════════════════════════════
// O PAINEL DE QUEM DEFINE O NÚMERO
// ═══════════════════════════════════════════════════════════════════════════
await pagina.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(2500);
const abaTiers = pagina.locator('button', { hasText: /Tiers/ }).first();
if (await abaTiers.count()) { await abaTiers.click(); await pagina.waitForTimeout(2000); }
const admin = (await pagina.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');

checa('🎯 existe o campo "Bônus / ciclo"', admin.includes('bônus / ciclo'), true);
checa('🎯 o campo diz a regra: gasto antes e expira',
  admin.includes('gasto antes do crédito do plano e expira no reset'), true);
checa('e mostra o saldo resultante do ciclo (90 + 30)',
  admin.includes('saldo do ciclo: 120'), true);

// O tier ilimitado tem de dizer POR QUE o campo não vale, em vez de aceitar
// um número que o backend vai ignorar em silêncio.
checa('🎯 plano ilimitado explica que não usa bônus',
  admin.includes('plano ilimitado não usa bônus'), true);
const desabilitados = await pagina.locator('input[type=number][disabled]').count();
checa('🎯 e o input dele está desabilitado', desabilitados >= 1, true);

// Painel de consumo
checa('🎯 o painel mede concedido × consumido',
  admin.includes('bônus concedido × consumido'), true);
checa('🎯 e declara a janela que mediu (mês-calendário ≠ ciclo de cobrança)',
  admin.includes('mês-calendário 2026-08') && admin.includes('ancorado na data da assinatura'), true);
checa('mostra o total', admin.includes('214 / 360'), true);
checa('e quanto expira na virada', admin.includes('146 expiram na virada'), true);

checa('nenhum erro de JS', errosJs, []);

await pagina.screenshot({ path: 'tests/bonus-admin.png', fullPage: false });
console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await navegador.close();
process.exit(ok ? 0 : 1);
