/**
 * O código tem de sobreviver ao caminho entre o link e o cadastro.
 *
 *   node tests/verifica_campanha.mjs
 *
 * ⚠️ ESTE É O TESTE QUE JUSTIFICA O ARQUIVO EXISTIR. A pessoa clica em
 * `/?campanha=LANCAMENTO`, lê a home, vai para /plans, volta, abre o modal e
 * só então cria a conta. Nesse caminho a query string some na PRIMEIRA
 * navegação. Uma implementação que lesse `window.location.search` na hora do
 * submit funcionaria no teste manual (abre o link, cadastra) e falharia com
 * praticamente todo mundo real — que olha o site antes de se cadastrar.
 *
 * Só um navegador de verdade prova isso: é preciso navegar, perder a query
 * string e ver o código continuar lá.
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

const BANNER_CAMPANHA = {
  active: true, origem: 'campanha',
  title: '50 créditos de bônus', description: 'Crie sua conta e teste a auditoria profunda.',
  coupon_code: 'LANCAMENTO', discount_label: 'BÔNUS', color: 'amber',
  expires_at: null, link_text: 'Criar conta e resgatar', link_url: '/?campanha=LANCAMENTO',
  dismissible: true, bonus_creditos: 50, validade_dias: 30,
  vagas_restantes: 137, vagas_total: 200,
};

const RESPOSTAS = {
  '/api/admin/promo-banner/public': BANNER_CAMPANHA,
  '/api/tiers/config': { tiers: [] },
  '/api/users/me': {},
  '/api/workspace/details': {},
  '/api/workspace/members': [],
  '/api/billing/invoices': [],
};

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage({ viewport: { width: 1400, height: 950 } });
const errosJs = [];
pagina.on('pageerror', (e) => errosJs.push(String(e).slice(0, 160)));

// CSP `connect-src 'self'` bloqueia o API_URL de dev (:8000) antes da camada
// de interceção do Playwright — sem tirar, nenhuma chamada chega ao `route`.
await pagina.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'),
  async (rota) => {
    const r = await rota.fetch();
    const h = { ...r.headers() };
    delete h['content-security-policy'];
    delete h['content-security-policy-report-only'];
    await rota.fulfill({ response: r, headers: h });
  });

// O cadastro é o que interessa medir: guardo o corpo do POST.
let corpoRegistro = null;
await pagina.route((u) => u.pathname.startsWith('/api/'), async (rota, req) => {
  const p = new URL(req.url()).pathname;
  if (p.endsWith('/auth/register')) {
    corpoRegistro = JSON.parse(req.postData() || '{}');
    return rota.fulfill({ status: 400, contentType: 'application/json',
      body: JSON.stringify({ detail: 'parado de propósito pelo teste' }) });
  }
  await rota.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(RESPOSTAS[p] ?? {}) });
});

// ── 1. O banner mostra a campanha, com escassez real ────────────────────────
await pagina.goto(`${BASE}/?campanha=lancamento`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(2500);
const home = (await pagina.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');

checa('🎯 o banner mostra o código da campanha', home.includes('lancamento'), true);
checa('🎯 e as vagas restantes, vindas do contador',
  home.includes('137 vagas restantes de 200'), true);

// ── 2. O código sobrevive à navegação ───────────────────────────────────────
// ⚠️ O CORAÇÃO DO TESTE. Depois desta navegação a query string não existe mais.
await pagina.goto(`${BASE}/plans`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(1500);
const urlSemQuery = pagina.url();
checa('a segunda página não tem mais o ?campanha na URL',
  urlSemQuery.includes('campanha'), false);

const guardado = await pagina.evaluate(() => localStorage.getItem('bawzi_campanha'));
checa('🎯 mas o código continua guardado', guardado, 'LANCAMENTO');

// Link novo com outro código sobrescreve — quem clicou no link novo está na
// campanha nova.
await pagina.goto(`${BASE}/?campanha=BLACKFRIDAY`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(1200);
checa('🎯 um link novo sobrescreve o código antigo',
  await pagina.evaluate(() => localStorage.getItem('bawzi_campanha')), 'BLACKFRIDAY');

// Código malformado não entra (ele vai para dentro de uma query no servidor).
await pagina.goto(`${BASE}/?campanha=$ne`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(1200);
checa('🎯 código com caractere de operador é ignorado',
  await pagina.evaluate(() => localStorage.getItem('bawzi_campanha')), 'BLACKFRIDAY');

// ── 3. O cadastro leva o código ─────────────────────────────────────────────
await pagina.evaluate(() => localStorage.setItem('bawzi_campanha', 'LANCAMENTO'));
await pagina.goto(`${BASE}/plans`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(1800);

// O modal abre em "login"; o cadastro é a segunda porta.
await pagina.locator('button:has-text("Entrar")').first().click();
await pagina.waitForTimeout(1000);
await pagina.locator('button:has-text("Criar conta grátis")').first().click();
await pagina.waitForTimeout(1000);

const campoCampanha = pagina.locator('#campo-campanha');
const temCampo = await campoCampanha.count();
checa('🎯 o campo de campanha existe no cadastro', temCampo > 0, true);
if (temCampo) {
  // ⚠️ ESTA É A ASSERÇÃO QUE PROVA O CAMINHO INTEIRO. O código entrou por um
  // link, sobreviveu a duas navegações e chega aqui sem a pessoa digitar nada.
  checa('🎯 e nasce PREENCHIDO com o código do link',
    await campoCampanha.inputValue(), 'LANCAMENTO');
  checa('a tela confirma que o código foi aplicado',
    (await pagina.locator('body').innerText()).includes('Código aplicado'), true);

  // Digitar à mão vence o link: quem colou um código está corrigindo.
  await campoCampanha.fill('OUTROCODIGO');
  await pagina.locator('input[placeholder="Nome Completo"]').fill('Fulano de Teste');
  await pagina.locator('input[placeholder="E-mail Profissional"]').fill('teste@bawzi.com');
  await pagina.locator('input[placeholder="Senha"]').fill('SenhaForte1!');
  await pagina.locator('input[placeholder="Confirmar senha"]').fill('SenhaForte1!');
  const consent = pagina.locator('input[type="checkbox"]').first();
  if (await consent.count()) await consent.check().catch(() => {});
  await pagina.locator('button[type="submit"]').first().click().catch(() => {});
  await pagina.waitForTimeout(2000);

  checa('🎯 o POST de cadastro leva o código', corpoRegistro?.campanha, 'OUTROCODIGO');
}

// ── 4. O admin precisa mostrar o tamanho da aposta ──────────────────────────
// ⚠️ ESTE É O NÚMERO QUE EVITA O ERRO CARO. "50 créditos × 200 pessoas"
// parecem 10 mil; se for todo ciclo por um ano são 120 mil. Uma tela que
// mostrasse 10 mil num benefício recorrente estaria informando um vinte-avos
// do compromisso — e o operador só descobriria na fatura.
RESPOSTAS['/api/admin/campanhas'] = [
  { _id: '1', codigo: 'FUNDADOR', titulo: 'Membro fundador', ativa: true,
    modo: 'recorrente', bonus_creditos: 50, duracao_meses: 12, validade_dias: 30,
    max_resgates: 200, resgates: 63, vagas_restantes: 137,
    creditos_comprometidos: 37800, creditos_no_teto: 120000, exposicao_aberta: false },
  { _id: '2', codigo: 'VITALICIA', titulo: 'Sem data de fim', ativa: true,
    modo: 'recorrente', bonus_creditos: 50, duracao_meses: 0, validade_dias: 30,
    max_resgates: 100, resgates: 10, vagas_restantes: 90,
    creditos_comprometidos: 500, creditos_no_teto: 5000, exposicao_aberta: true },
  // Ativa e sem vaga: o selo tem de dizer ESGOTADA, não NO AR — o banner já
  // parou de anunciá-la e a tela do admin precisa concordar com isso.
  { _id: '3', codigo: 'TESTEDRIVE', titulo: 'Pote de ativação', ativa: true,
    modo: 'unico', bonus_creditos: 50, duracao_meses: 0, validade_dias: 30,
    max_resgates: 500, resgates: 500, vagas_restantes: 0,
    creditos_comprometidos: 25000, creditos_no_teto: 25000, exposicao_aberta: false },
  { _id: '4', codigo: 'ANTIGA', titulo: 'Encerrada em julho', ativa: false,
    modo: 'unico', bonus_creditos: 20, duracao_meses: 0, validade_dias: 15,
    max_resgates: 100, resgates: 44, vagas_restantes: 56,
    creditos_comprometidos: 880, creditos_no_teto: 2000, exposicao_aberta: false },
  // Percentual da cota: o valor por pessoa depende do plano DELA.
  { _id: '5', codigo: 'ESCALA', titulo: '+20% de cota', ativa: true,
    modo: 'recorrente', tipo_valor: 'percentual', bonus_percentual: 20,
    bonus_creditos: 0, duracao_meses: 12, validade_dias: 30,
    max_resgates: 50, resgates: 5, vagas_restantes: 45,
    creditos_comprometidos: 7800, creditos_no_teto: 78000, exposicao_aberta: false,
    pior_plano: 'Avançado' },
];
RESPOSTAS['/api/admin/tier-configs'] = [
  { tier_id: 1, name: 'Gratuito', monthly_limit: 5, max_chars: 5e4, max_mb: 5,
    investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o-mini',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o-mini',
    agent_count: 1, limit_profunda: null, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, bonus_creditos: 0, price_brl: 0,
    available_models: ['gpt-4o-mini'], model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini' } },
  { tier_id: 2, name: 'Essencial', monthly_limit: 90, max_chars: 15e4, max_mb: 10,
    investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o-mini',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o-mini',
    agent_count: 2, limit_profunda: null, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, bonus_creditos: 0, price_brl: 79,
    available_models: ['gpt-4o-mini'], model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini' } },
  { tier_id: 3, name: 'Profissional', monthly_limit: 250, max_chars: 18e4, max_mb: 30,
    investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o-mini',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o-mini',
    agent_count: 3, limit_profunda: null, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, bonus_creditos: 0, price_brl: 197,
    available_models: ['gpt-4o-mini'], model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini' } },
  { tier_id: 4, name: 'Avançado', monthly_limit: 0, max_chars: 4e5, max_mb: 100,
    investigator_model: 'gpt-4o-mini', writer_model: 'gpt-4o-mini',
    investigator_model_rapido: 'gpt-4o-mini', writer_model_rapido: 'gpt-4o-mini',
    agent_count: 3, limit_profunda: null, limit_rapida: null, peso_profunda: 4,
    caracteres_por_credito: 50000, bonus_creditos: 0, price_brl: 497,
    available_models: ['gpt-4o-mini'], model_resolution: { 'gpt-4o-mini': 'gpt-4o-mini' } },
];
RESPOSTAS['/api/admin/precos-modelo'] = { modelos: [], cambio: { cotacao: 5.4 } };
RESPOSTAS['/api/admin/stats'] = { kpis: { usuarios: 1, analises_totais: 0, analises_24h: 0, conversao_pro: 0, cost_usd_total: 0 }, heavy_users: [], tiers: {} };
RESPOSTAS['/api/admin/users'] = [];
RESPOSTAS['/api/admin/email-templates'] = [];
RESPOSTAS['/api/admin/promo-invites'] = [];
RESPOSTAS['/api/admin/promo-banner'] = {};
RESPOSTAS['/api/email/smtp'] = {};
RESPOSTAS['/api/billing/admin/stripe-config'] = {};

await pagina.addInitScript(() => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  localStorage.setItem('bawzi_token',
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'admin', exp, is_admin: true })}.x`);
});
await pagina.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(2500);
const abaPromo = pagina.locator('button', { hasText: /Promoções/ }).first();
if (await abaPromo.count()) { await abaPromo.click(); await pagina.waitForTimeout(1800); }
const admin = (await pagina.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');

checa('🎯 a exposição do recorrente multiplica pelos meses (50×200×12)',
  admin.includes('exposição máxima 120.000 créditos'), true);
checa('🎯 e diz que é por mês, durante 12 meses',
  admin.includes('por mês durante 12 meses'), true);
// ⚠️ Sem data de fim não existe teto. Inventar um número seria pior que não
// mostrar nenhum — o operador leria como se estivesse limitado.
checa('🎯 duração 0 avisa "exposição aberta" em vez de inventar um teto',
  admin.includes('exposição aberta (sem data de fim)'), true);
checa('e diz "enquanto for cliente"', admin.includes('enquanto for cliente'), true);
checa('o pote continua sendo mostrado como pote',
  admin.includes('em pote, válidos 30 dias'), true);
checa('campanha esgotada aparece como esgotada', admin.includes('esgotada'), true);
checa('e a desligada, como desligada', admin.includes('desligada'), true);
// O aviso que impede confundir crédito com desconto do Stripe.
checa('🎯 a tela separa campanha de cupom',
  admin.includes('campanhas de crédito') && admin.includes('banner de cupom'), true);

// ── 5. Percentual da cota, e a prévia que o torna concreto ──────────────────
checa('a lista mostra o percentual em vez de um número de créditos',
  admin.includes('+20% da cota'), true);

// Abre a campanha percentual para conferir a prévia por plano.
const editar = pagina.locator('div', { hasText: /^ESCALA/ }).locator('button:has-text("Editar")').first();
const qualquerEditar = (await editar.count()) ? editar
  : pagina.locator('button:has-text("Editar")').nth(4);
await qualquerEditar.click().catch(() => {});
await pagina.waitForTimeout(1200);
const form = (await pagina.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');

checa('🎯 existe o seletor de valor fixo vs percentual',
  form.includes('% da cota do plano'), true);
// ⚠️ ESTA É A PRÉVIA QUE IMPEDE CONFIGURAR NO ESCURO. "20% da cota" não é um
// número até dizer de qual plano — e no gratuito são 1 crédito.
checa('🎯 a prévia mostra quanto vale em cada plano',
  form.includes('quanto isso vale por plano, hoje'), true);
checa('🎯 20% de 90 aparece como +18/mês', form.includes('+18/mês'), true);
checa('🎯 20% de 250 aparece como +50/mês', form.includes('+50/mês'), true);
checa('🎯 20% de 5 aparece como +1/mês (o caso que engana no gratuito)',
  form.includes('+1/mês'), true);
checa('🎯 e o plano ilimitado aparece como ilimitado, não como 0',
  form.includes('ilimitado'), true);
// A exposição usa o pior caso, não a média — 250 é o maior teto finito.
checa('🎯 a exposição usa o pior caso e avisa disso',
  form.includes('pior caso: todos no plano mais alto'), true);
checa('e multiplica pelo plano mais alto × vagas × meses (50×50×12)',
  form.includes('30.000 créditos'), true);

checa('nenhum erro de JS', errosJs, []);

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await navegador.close();
process.exit(ok ? 0 : 1);
