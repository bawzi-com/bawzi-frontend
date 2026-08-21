/**
 * O painel "Base PNCP" tem de dizer a verdade sobre o scheduler.
 *
 *   node tests/verifica_painel_pncp.mjs
 *
 * ⚠️ POR QUE UM TESTE DE NAVEGADOR E NÃO UMA LEITURA DO JSX:
 * o que se afirma aqui é o que o operador LÊ na tela — e a última vez que
 * conferi um painel por leitura de código, o Tailwind estava a descartar
 * metade das classes e três regras globais em `base.css` venciam as
 * utilities. `text-${cor}-400` construído por interpolação é exactamente
 * esse tipo de coisa: existe no código e não existe no CSS.
 *
 * O backend é falso de propósito. O que está em teste é a tradução do estado
 * do scheduler para a tela, não o scheduler.
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

// ── O estado que o backend devolve DE FACTO hoje ────────────────────────────
// Os 14 jobs registados. `consulta_uf_diario` NÃO está aqui: ele só entra com
// SCHEDULER_CONSULTA_UF_ATIVO=true, que não está setado em lado nenhum. E
// `enrich_fornecedor_diario` também não, porque foi apagado do scheduler.
const AMANHA = '2026-08-20T';
const JOBS = [
  ['itens_contratos_diario', '03:45'], ['contratos_diario', '05:00'],
  ['expirar_promos_diario', '05:05'], ['desabilitar_excedentes_diario', '05:15'],
  ['enrich_via_consulta_diario', '05:30'], ['sync_carteiras_diario', '06:00'],
  ['varredura_nacional_diaria', '07:00'], ['resultados_pncp_diario', '08:15'],
  ['editais_detalhe_diario', '09:00'], ['cambio_diario', '09:10'],
  ['monitor_analises_diario', '09:30'], ['radar_alertas_diario', '10:00'],
  ['disputas_diario', '10:20'], ['alertas_renovacao_diario', '11:00'],
].map(([id, h]) => ({ id, nome: id, proxima_exec: `${AMANHA}${h}:00+00:00` }));

const RESPOSTAS = {
  '/api/admin/pncp/stats': {
    contratos: { total: 291366, ativos: 236653, sem_fornecedor: 115943 },
    municipios: { total: 4389 },
    ultima_indexacao: '2026-08-19T04:12:00Z',
  },
  '/api/admin/scheduler/status': {
    scheduler_ativo: true,
    iniciado_em: '2026-08-19T00:00:00Z',
    jobs_proximas_exec: JOBS,
    jobs_resultados: {},
  },
  '/api/admin/workers/status': {
    contratos: { running: false, ultimo_resultado: null, ultimo_erro: null },
    municipios: { running: false, ultimo_resultado: null, ultimo_erro: null },
    fornecedores: { running: false, ultimo_resultado: null, ultimo_erro: null },
    consulta_uf: { running: false, ultimo_resultado: null, ultimo_erro: null },
    enrich_via_consulta: { running: false, ultimo_resultado: null, ultimo_erro: null },
    editais_detalhe: { running: false, ultimo_resultado: null, ultimo_erro: null },
    // ⚠️ O LOTE INTEIRO RECUSADO PELO PNCP — o caso que o painel lia errado.
    itens_contratos: {
      running: false, ultimo_erro: null,
      ultimo_resultado: { candidatos: 150, com_itens: 0, sem_itens: 3, falha_pncp: 147 },
    },
  },
  '/api/admin/stats': {
    kpis: { usuarios: 1, analises_totais: 0, analises_24h: 0, conversao_pro: 0, cost_usd_total: 0 },
    heavy_users: [], tiers: {},
  },
  '/api/admin/users': [],
  '/api/admin/email-templates': [],
  '/api/email/smtp': {},
  '/api/billing/admin/stripe-config': {},
};

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1100 } });
const errosConsole = [];
pagina.on('pageerror', (e) => errosConsole.push(String(e)));

// ⚠️ SEM ISTO, NENHUMA CHAMADA CHEGA AO `route`. O documento vem com
// `connect-src 'self' …`, e o `API_URL` de dev aponta para :8000 — outra
// origem. O browser bloqueia por CSP ANTES da camada de interceção do
// Playwright, e a tela mostra "Falha de Segurança: Failed to fetch" sem que
// um único pedido apareça. O CSP é do produto e está certo; quem tem de sair
// do caminho é o teste.
await pagina.route((u) => u.pathname === '/admin', async (rota) => {
  const resposta = await rota.fetch();
  const cabecalhos = { ...resposta.headers() };
  delete cabecalhos['content-security-policy'];
  delete cabecalhos['content-security-policy-report-only'];
  await rota.fulfill({ response: resposta, headers: cabecalhos });
});

await pagina.route((u) => u.pathname.startsWith('/api/'), async (rota, req) => {
  const p = new URL(req.url()).pathname;
  if (p.endsWith('/auth/refresh') || p.includes('/renew')) {
    return rota.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'fake' }) });
  }
  const corpo = RESPOSTAS[p] ?? {};
  await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
});

await pagina.addInitScript(() => {
  // Token com exp bem no futuro: o apiClient decodifica o payload para decidir
  // se precisa renovar, e um token opaco derrubaria a sessão antes da tela.
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 86400;
  localStorage.setItem('bawzi_token',
    `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'admin', exp, is_admin: true })}.x`);
});

await pagina.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(2500);

// Abre a aba "Base PNCP"
const aba = pagina.locator('button', { hasText: /Base PNCP|PNCP/ }).first();
if (await aba.count()) { await aba.click(); await pagina.waitForTimeout(1800); }

const texto = await pagina.locator('body').innerText();

// ── O job fantasma tem de ter sumido ────────────────────────────────────────
checa('🎯 o card "Enrich Fornecedor · 03:00" não existe mais',
  /Enrich Fornecedor\b(?!\s*via)/.test(texto), false);
// ⚠️ NÃO DÁ PARA TESTAR ISTO PROCURANDO "03:00 BRT": o horário voltou a ser
// legítimo, agora do Sincronismo de Carteiras. O que não pode existir é o
// CARD, não a hora. Comparar o conjunto de cards com o conjunto de jobs
// registados pega as duas direções do erro de uma vez — o fantasma a mais e
// os oito que faltavam.
const cardsAgendados = await pagina.evaluate(() =>
  [...document.querySelectorAll('span.text-\\[9px\\]')]
    .map((s) => s.parentElement?.querySelector('span')?.textContent?.trim())
    .filter(Boolean));
checa('🎯 o painel mostra exactamente os 15 jobs do scheduler (14 activos + 1 desligado)',
  cardsAgendados.length, 15);
checa('🎯 e nenhum deles é o job apagado',
  cardsAgendados.some((c) => /^Enrich Fornecedor$/.test(c)), false);

// ── Os jobs que existiam e não apareciam ────────────────────────────────────
for (const rotulo of ['Varredura Nacional', 'Auto-registro de Resultados',
  'Monitor de Análises', 'Radar de Alertas', 'Disputas que vão abrir',
  'Alertas de Renovação', 'Cotação do Dólar', 'Sincronismo de Carteiras',
  'Expiração de Tier Promocional', 'Desabilitar Empresas Excedentes']) {
  checa(`agendamento mostra "${rotulo}"`, texto.includes(rotulo), true);
}

// ── Consulta UF: desligado, e sem selo de recomendado ───────────────────────
checa('🎯 Consulta UF aparece como DESLIGADO', texto.includes('DESLIGADO'), true);
checa('🎯 o selo "recomendado para fornecedor em massa" sumiu',
  /RECOMENDADO PARA FORNECEDOR/i.test(texto), false);
checa('e a tela diz como religar', texto.includes('SCHEDULER_CONSULTA_UF_ATIVO'), true);

// ── Itens Homologados: recusa ≠ ausência ────────────────────────────────────
checa('🎯 o painel separa recusa do PNCP de ausência de itens',
  texto.includes('147 recusados pelo PNCP'), true);
checa('e continua a mostrar os que realmente não têm itens',
  texto.includes('3 sem itens'), true);

// ── O texto de sessão ───────────────────────────────────────────────────────
checa('🎯 "Nunca executado nesta sessão" não existe mais',
  texto.includes('nesta sessão'), false);

// ── As tarjas de horário têm cor de verdade ─────────────────────────────────
// ⚠️ `text-${cor}-400` nunca gerou CSS: o Tailwind varre nomes LITERAIS.
const corDaTarja = await pagina.evaluate(() => {
  const el = [...document.querySelectorAll('span')]
    .find((s) => /^\d\d:\d\d BRT$/.test(s.textContent?.trim() || ''));
  return el ? getComputedStyle(el).color : null;
});
checa('🎯 a tarja de horário não é cinza-padrão (a classe existe no CSS)',
  corDaTarja !== null && !['rgb(148, 163, 184)', 'rgb(100, 116, 139)'].includes(corDaTarja),
  true);
console.log(`     cor medida: ${corDaTarja}`);

checa('nenhum erro de JS na página', errosConsole, []);

await pagina.screenshot({ path: 'tests/painel-pncp.png', fullPage: true });
console.log('\n📸 tests/painel-pncp.png');
console.log(ok ? 'TODOS PASSARAM' : 'FALHOU');
await navegador.close();
process.exit(ok ? 0 : 1);
