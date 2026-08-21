/**
 * O pop-up da campanha: quando abre, quando NÃO abre, e quando volta.
 *
 *   node tests/verifica_promo_popup.mjs
 *
 * ⚠️ POR QUE NAVEGADOR. Praticamente nada aqui dá para conferir lendo o JSX —
 * o comportamento inteiro é sobre ESTADO QUE ATRAVESSA CARREGAMENTOS:
 *
 *   · "volta a cada novo acesso" só existe se `sessionStorage` sobreviver ao
 *     F5 e morrer no contexto novo. Um `localStorage` trocado por engano passa
 *     em qualquer leitura de código e falha silenciosamente em produção — o
 *     pop-up simplesmente nunca mais aparece, e ninguém abre um chamado para
 *     dizer "não vi uma propaganda";
 *   · "não aparece para quem tem conta" depende de `initSession()` resolver o
 *     cookie de refresh ANTES da decisão. No JSX as duas versões são idênticas;
 *     só o relógio mostra a diferença;
 *   · a armadilha de foco e o travamento da rolagem são posição e evento, não
 *     marcação.
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

let ok = true;
function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

const CAMPANHA = {
  active: true, origem: 'campanha',
  title: 'Lançamento Bawzi', description: 'Bônus de créditos para os primeiros.',
  coupon_code: 'LANCAMENTO', discount_label: 'BÔNUS DE LANÇAMENTO', color: 'emerald',
  expires_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
  link_text: 'Criar conta e resgatar', link_url: '/?campanha=LANCAMENTO',
  dismissible: true,
  bonus_creditos: 50, validade_dias: 30, modo: 'unico', duracao_meses: 0,
  tipo_valor: 'fixo', bonus_percentual: 0,
  vagas_restantes: 3412, vagas_total: 5000,
};
const CUPOM = {
  active: true, origem: 'cupom',
  title: 'Black Friday', description: '20% no primeiro mês.',
  coupon_code: 'BF20', discount_label: '-20%', color: 'violet',
  link_text: 'Ver planos', link_url: '/plans', dismissible: true,
};

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

/**
 * Um contexto de navegador = UM ACESSO. É esta linha que dá sentido ao teste:
 * `sessionStorage` nasce vazio em cada contexto, exatamente como quando alguém
 * fecha o navegador e volta depois.
 */
async function abrirAcesso({ promo = CAMPANHA, logado = false, consentido = true, rota = '/workspace', tokenLegado = false, admin = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const erros = [];

  await ctx.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/'), async (r) => {
    const res = await r.fetch(); const h = { ...res.headers() };
    delete h['content-security-policy']; delete h['content-security-policy-report-only'];
    await r.fulfill({ response: res, headers: h }); });

  await ctx.route((u) => u.pathname.startsWith('/api/'), async (r, q) => {
    const p = new URL(q.url()).pathname;
    // ⚠️ ESTE É O INTERRUPTOR DE "TEM CONTA". `initSession()` chama
    // `/auth/refresh`; devolver 401 é o que faz o visitante ser um visitante.
    if (p.endsWith('/auth/refresh')) {
      return logado
        ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"fake"}' })
        : r.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"sem sessao"}' });
    }
    if (p === '/api/admin/promo-banner/public')
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(promo) });
    const R = {
      '/api/users/me': { _id: 'u1', email: 'd@bawzi.com', name: 'Marcelo Mendes', tier: 4, active_workspace_id: 'w1', companies: [], is_admin: admin },
      '/api/workspace/details': { _id: 'w1', tier: 4, workspace_name: 'Equipe', companies: [], empresas: [] },
      '/api/tiers/config': { status: 'success', config: {} },
      '/api/tiers/limites-publicos': { tiers: {} },
      '/api/tiers/precos-publicos': { planos: {} },
    };
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(R[p] ?? {}) }); });

  // ⚠️ O CASO "LOGADO" NÃO SEMEIA `bawzi_token` DE PROPÓSITO — e essa ausência
  // é o teste. Quem fechou o navegador ontem e voltou hoje tem SÓ o cookie
  // HttpOnly de refresh: o token de acesso vive em memória e morreu junto com
  // a aba. Se a decisão fosse tomada por `getAuthToken()`, esta pessoa
  // pareceria deslogada e receberia o modal — e é exatamente ela quem mais
  // abre o site. Semear o token aqui faria as duas implementações passarem
  // igual, que é o mesmo que não testar.
  await ctx.addInitScript(({ consentido, logado, tokenLegado, admin }) => {
    if (consentido) localStorage.setItem('bawzi_consent_accepted', 'true');
    if (logado) {
      localStorage.setItem('bawzi_tier', '4');
      localStorage.setItem('user_name', 'Marcelo Mendes');
    }
    if (tokenLegado) {
      const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
      localStorage.setItem('bawzi_token',
        `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 86400, is_admin: admin })}.x`);
    }
  }, { consentido, logado, tokenLegado, admin });

  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(String(e).slice(0, 180)));
  await pg.goto(`http://127.0.0.1:3100${rota}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  return { ctx, pg, erros };
}

const modalDe = (pg) => pg.locator('[role="dialog"][aria-modal="true"]');
const barraDe = (pg) => pg.locator('[role="banner"][aria-label="Oferta promocional"]');

// ═══════════════════════════════════════════════════════════════════════════
// 1. Visitante + campanha → pop-up, e depois a barra
// ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, pg, erros } = await abrirAcesso();
  const modal = modalDe(pg);
  checa('🎯 visitante com campanha ativa recebe o pop-up', await modal.count(), 1);
  checa('o modal se anuncia pelo título para leitor de tela',
    await modal.getAttribute('aria-labelledby'), 'promo-modal-titulo');

  const texto = (await modal.innerText()).replace(/\s+/g, ' ');
  checa('mostra o título da campanha', /Lançamento Bawzi/.test(texto), true);
  // ⚠️ O NÚMERO VEM DO CONTADOR ATÔMICO, e é o que justifica interromper.
  checa('🎯 mostra a escassez real', /3\.412 vagas restantes/.test(texto), true);
  checa('e o total', /de 5\.000/.test(texto), true);
  // Derivado dos campos que o backend usa para creditar, não do texto do admin.
  checa('🎯 mostra o que a conta vai receber', /\+50 créditos/.test(texto), true);
  checa('e como recebe', /de uma vez só, na criação da conta/.test(texto), true);
  checa('e por quanto tempo vale', /para usar em 30 dias/.test(texto), true);

  // ⚠️ A ROLAGEM DO FUNDO TEM DE ESTAR TRAVADA.
  checa('🎯 a página atrás não rola enquanto o modal está aberto',
    await pg.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');

  // ── Armadilha de foco ────────────────────────────────────────────────────
  // Sem ela o Tab sai para o cabeçalho ATRÁS do overlay.
  const dentro = async () => pg.evaluate(() =>
    !!document.activeElement?.closest('[role="dialog"]'));
  checa('o foco começa dentro do modal', await dentro(), true);
  for (let i = 0; i < 12; i++) await pg.keyboard.press('Tab');
  checa('🎯 e continua dentro depois de 12 tabulações', await dentro(), true);

  // ── Escape fecha e a barra assume ────────────────────────────────────────
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(400);
  checa('🎯 Escape fecha o pop-up', await modalDe(pg).count(), 0);
  checa('🎯 e a barra fica no lugar dele', await barraDe(pg).count(), 1);
  checa('a rolagem volta ao normal',
    await pg.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), true);

  // ── Mesma sessão: F5 não traz o pop-up de volta ──────────────────────────
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2600);
  checa('🎯 recarregar na MESMA sessão não reabre o pop-up', await modalDe(pg).count(), 0);
  checa('e a barra continua lá', await barraDe(pg).count(), 1);

  // ── Fechar a barra vale só para esta sessão ──────────────────────────────
  await pg.locator('button[aria-label="Fechar banner"]').click();
  await pg.waitForTimeout(300);
  checa('fechar a barra some com ela', await barraDe(pg).count(), 0);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2600);
  checa('e ela continua fechada no resto da sessão', await barraDe(pg).count(), 0);

  checa('nenhum erro de JS', erros, []);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Novo acesso → tudo de volta
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ESTA É A ASSERÇÃO CENTRAL DO PEDIDO. Contexto novo = navegador fechado e
// reaberto. Se alguém trocar `sessionStorage` por `localStorage`, é aqui — e
// só aqui — que aparece.
{
  const { ctx, pg } = await abrirAcesso();
  checa('🎯 NOVO ACESSO traz o pop-up de novo', await modalDe(pg).count(), 1);
  await pg.locator('[role="dialog"] button[aria-label="Fechar"]').click();
  await pg.waitForTimeout(400);
  checa('🎯 e a barra também volta (o fechamento anterior não era permanente)',
    await barraDe(pg).count(), 1);

  // ── A prova de que a memória é de SESSÃO, e não do dispositivo ───────────
  // ⚠️ SEM ESTA ABA, O TESTE ACIMA NÃO PROVA NADA. Um contexto novo do
  // Playwright nasce com `localStorage` vazio TAMBÉM — trocar `sessionStorage`
  // por `localStorage` no componente passaria em todas as asserções
  // anteriores. Uma segunda aba DENTRO do mesmo contexto é o único lugar onde
  // as duas escolhas divergem: `localStorage` é compartilhado entre abas,
  // `sessionStorage` não.
  //
  // O efeito colateral é real e foi aceito: abrir o site numa segunda aba
  // mostra o pop-up de novo. É o preço de "todo novo acesso deve aparecer"
  // sem prender a decisão ao dispositivo.
  const aba2 = await ctx.newPage();
  await aba2.goto('http://127.0.0.1:3100/workspace', { waitUntil: 'domcontentloaded' });
  await aba2.waitForTimeout(3000);
  checa('🎯 a memória é da SESSÃO, não do dispositivo (aba nova → pop-up)',
    await modalDe(aba2).count(), 1);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Quem já tem conta não é interrompido
// ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, pg } = await abrirAcesso({ logado: true });
  checa('🎯 pessoa logada NÃO recebe o pop-up (o bônus é do cadastro)',
    await modalDe(pg).count(), 0);
  checa('mas continua vendo a barra', await barraDe(pg).count(), 1);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3b. A barra não pode sumir atrás do menu ao rolar
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ISTO É GEOMETRIA, NÃO MARCAÇÃO — e por isso não dá para conferir no JSX.
// A barra era irmã do `Header` no layout, com `z-index: auto` contra o
// `sticky top-0 z-50` dele. Medido antes da correção: com 34px de rolagem a
// barra ficava no topo 39 e o cabeçalho ocupava 0–73 — sobravam 14 dos 48px
// dela, uma tira colorida espremida embaixo do menu. Um pouco mais de rolagem
// e ela sumia por completo. Nada disso aparece lendo o componente: as duas
// versões têm exatamente o mesmo markup de barra.
{
  const { ctx, pg } = await abrirAcesso({ promo: CUPOM });
  const medir = () => pg.evaluate(() => {
    const b = document.querySelector('[role="banner"][aria-label="Oferta promocional"]');
    const h = document.querySelector('header');
    if (!b || !h) return null;
    const rb = b.getBoundingClientRect(), rh = h.getBoundingClientRect();
    // Quanto da barra o cabeçalho esconde. Só conta sobreposição de verdade.
    const encoberto = Math.max(0, Math.min(rb.bottom, rh.bottom) - Math.max(rb.top, rh.top));
    // E o que o navegador diz que está no ponto — `pointer-events-none`
    // enganaria aqui, mas nem a barra nem o cabeçalho usam isso.
    const meio = document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2);
    return {
      alturaBarra: Math.round(rb.height),
      topoBarra: Math.round(rb.top),
      encoberto: Math.round(encoberto),
      visivel: rb.bottom > 0 && rb.top < innerHeight,
      naFrente: meio ? !!meio.closest('[aria-label="Oferta promocional"]') : false,
    };
  });

  const parada = await medir();
  checa('parada, a barra aparece inteira', parada.encoberto, 0);

  for (const y of [34, 200, 900]) {
    await pg.evaluate((v) => window.scrollTo(0, v), y);
    await pg.waitForTimeout(350);
    const m = await medir();
    checa(`🎯 rolando ${y}px a barra continua visível`, m.visivel, true);
    // A asserção que pega o defeito: ZERO pixels escondidos pelo cabeçalho.
    checa(`🎯 e o menu não cobre nenhum pixel dela (${y}px)`, m.encoberto, 0);
    checa(`e ela responde ao clique, não o que está atrás (${y}px)`, m.naFrente, true);
  }
  await pg.evaluate(() => window.scrollTo(0, 0));
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3c. O pop-up não pode ficar preso no contexto de empilhamento do cabeçalho
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ AGORA QUE A BARRA MORA DENTRO DO BLOCO `sticky z-50`, O MODAL DELA NASCE
// ALI DENTRO TAMBÉM — a menos que vá por portal. `position: fixed` escapa do
// recorte e do fluxo, mas NÃO escapa de contexto de empilhamento: preso no
// z-50 ele apareceria ATRÁS do aviso de LGPD (z-900) e do painel de
// notificações (z-9999), mesmo declarando z-1000.
{
  const { ctx, pg } = await abrirAcesso();
  const situacao = await pg.evaluate(() => {
    const m = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!m) return null;
    const overlay = m.parentElement;
    return {
      filhoDoBody: overlay?.parentElement === document.body,
      dentroDoCabecalho: !!m.closest('.sticky'),
      z: getComputedStyle(overlay).zIndex,
    };
  });
  checa('🎯 o modal é filho direto do body (portal), não do cabeçalho',
    situacao.filhoDoBody, true);
  checa('🎯 e não está dentro do bloco sticky', situacao.dentroDoCabecalho, false);
  checa('com z-index acima do cabeçalho', Number(situacao.z) > 50, true);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Cupom nunca vira pop-up
// ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, pg } = await abrirAcesso({ promo: CUPOM });
  checa('🎯 cupom não abre pop-up (não há escassez verificada)', await modalDe(pg).count(), 0);
  checa('e aparece como barra, como sempre foi', await barraDe(pg).count(), 1);
  // O fechamento do cupom continua permanente — comportamento antigo intacto.
  await pg.locator('button[aria-label="Fechar banner"]').click();
  await pg.waitForTimeout(300);
  checa('🎯 o cupom fechado fica gravado em localStorage (comportamento antigo)',
    await pg.evaluate(() => localStorage.getItem('promo_dismissed_BF20')), '1');
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. O pop-up espera o consentimento
// ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, pg } = await abrirAcesso({ consentido: false });
  checa('🎯 com o aviso de LGPD na tela, o pop-up segura', await modalDe(pg).count(), 0);
  await pg.locator('button', { hasText: /^Entendi$/ }).click();
  await pg.waitForTimeout(600);
  checa('🎯 e entra assim que o aviso sai', await modalDe(pg).count(), 1);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Não interrompe quem está no meio de uma tarefa
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `/convite` É O PIOR CASO. A pessoa foi convidada para um workspace que já
// existe e está a um clique de entrar; um modal dizendo "crie uma conta e
// ganhe créditos" empurra para o caminho errado — e escolher errado a tira do
// workspace em que ela está hoje.
for (const rota of ['/convite/abc123', '/reset-password']) {
  const { ctx, pg } = await abrirAcesso({ rota });
  checa(`🎯 nada de pop-up em ${rota}`, await modalDe(pg).count(), 0);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. A oferta anunciada é a que o backend concede
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `conceder_bonus` REBAIXA `percentual` PARA `fixo` quando o modo não é
// recorrente — um pote é uma quantidade entregue, não um valor recalculado a
// cada leitura. Se a tela não repetisse a regra, esta campanha anunciaria
// "+20% de créditos" e a conta receberia 50. Promessa e entrega divergiriam.
{
  const { ctx, pg } = await abrirAcesso({ promo: {
    ...CAMPANHA, modo: 'unico', tipo_valor: 'percentual', bonus_percentual: 20, bonus_creditos: 50,
  } });
  const t = (await modalDe(pg).innerText()).replace(/\s+/g, ' ');
  checa('🎯 unico + percentual anuncia os CRÉDITOS, não a porcentagem',
    /\+50 créditos/.test(t) && !/20%/.test(t), true);
  await ctx.close();
}
{
  const { ctx, pg } = await abrirAcesso({ promo: {
    ...CAMPANHA, modo: 'recorrente', tipo_valor: 'percentual', bonus_percentual: 20, duracao_meses: 12,
  } });
  const t = (await modalDe(pg).innerText()).replace(/\s+/g, ' ');
  checa('🎯 recorrente + percentual anuncia a porcentagem', /\+20% de créditos/.test(t), true);
  checa('e diz que renova todo ciclo', /todo ciclo/.test(t), true);
  checa('e por quantos meses', /durante 12 meses/.test(t), true);
  await ctx.close();
}
{
  // `duracao_meses = 0` no recorrente significa "sem data de fim", que no
  // backend quer dizer "enquanto o workspace for pagante" — não "para sempre".
  const { ctx, pg } = await abrirAcesso({ promo: {
    ...CAMPANHA, modo: 'recorrente', tipo_valor: 'fixo', bonus_creditos: 50, duracao_meses: 0,
  } });
  const t = (await modalDe(pg).innerText()).replace(/\s+/g, ' ');
  checa('🎯 recorrente sem prazo diz "enquanto você for cliente", não "para sempre"',
    /enquanto você for cliente/.test(t), true);
  await ctx.close();
}
{
  // Singular: "1 vaga" e "1 crédito" não podem sair com "s".
  const { ctx, pg } = await abrirAcesso({ promo: {
    ...CAMPANHA, bonus_creditos: 1, validade_dias: 1, vagas_restantes: 1,
  } });
  const t = (await modalDe(pg).innerText()).replace(/\s+/g, ' ');
  checa('singular sai certo nos créditos', /\+1 crédito\b/.test(t) && !/\+1 créditos/.test(t), true);
  checa('e nas vagas', /última vaga/.test(t), true);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Retrato
// ═══════════════════════════════════════════════════════════════════════════
{
  const { ctx, pg } = await abrirAcesso();
  await pg.screenshot({ path: 'tests/promo-popup.png', clip: { x: 340, y: 120, width: 600, height: 660 } });
  await ctx.close();
}

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await nav.close();
process.exit(ok ? 0 : 1);
