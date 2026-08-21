/**
 * A foto de perfil: escolher, ver antes de enviar, aparecer no cabeçalho, remover.
 *
 *   node tests/verifica_avatar.mjs
 *
 * ⚠️ POR QUE NAVEGADOR, E NÃO LEITURA DO JSX. Os defeitos que este arquivo
 * cobre são todos invisíveis no código:
 *
 *   · A ROTA EXISTIA E NÃO TINHA PORTA. `POST /api/users/avatar` estava no
 *     backend desde o início, `avatar_url` já era lido na lista de membros —
 *     e nenhuma tela chamava. Todo mundo era uma inicial colorida porque não
 *     havia onde clicar. Nenhuma leitura de arquivo isolado mostra isso: cada
 *     metade parecia completa. Só abrir a tela mostra.
 *   · O CABEÇALHO NÃO SABIA DA TROCA. `Header` mora no layout e só busca
 *     `/users/me` quando o `pathname` muda. Sem um aviso explícito, quem
 *     trocava a foto no perfil via o rosto novo no formulário e a inicial
 *     antiga no canto — a mesma tela mostrando dois avatares diferentes.
 *   · O RECORTE REDONDO É CSS, NÃO MARKUP. `rounded-full` sem
 *     `overflow-hidden` deixa a foto quadrada dentro do círculo. O JSX fica
 *     idêntico; só o pixel do canto denuncia.
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let ok = true;
function checa(rotulo, obtido, esperado) {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

// ── A foto de mentira: MAGENTA CHAPADO, e retangular de propósito ───────────
// ⚠️ Magenta porque nenhuma cor da interface chega perto — se ela aparecer
// num canto onde não devia, não há dúvida sobre o que é. Retangular (600×200)
// porque é o formato que revela recorte errado: um quadrado passaria batido.
const FOTO = execSync(
  `python3 -c "
from PIL import Image; import sys
Image.new('RGB',(600,200),(255,0,220)).save(sys.stdout.buffer, format='PNG')"`,
  { maxBuffer: 8 << 20 },
);
const FOTO_QUADRADA = execSync(
  `python3 -c "
from PIL import Image; import sys
Image.new('RGB',(256,256),(255,0,220)).save(sys.stdout.buffer, format='PNG')"`,
  { maxBuffer: 8 << 20 },
);

const SEM_FOTO = {
  _id: 'u1', email: 'development@bawzi.com', name: 'Marcelo Mendes', tier: 4,
  active_workspace_id: 'w1', companies: [{ cnpj: '11222333000181', name: 'TESTE LTDA' }],
};
let usuario = { ...SEM_FOTO };

const R = () => ({
  '/api/users/me': usuario,
  '/api/workspace/details': { _id: 'w1', name: 'WS', tier: 4, workspace_name: 'Equipe Bawzi',
                              companies: usuario.companies, empresas: [] },
  '/api/workspace/members': [],
  '/api/analyses/quota': { tier: 4, ilimitado: false, limite: 650, usado: 160, saldo: 750,
                           creditos_extras: 50, bonus: 50, bonus_restante: 50,
                           dias_para_reset: 12, unidade: 'creditos' },
  '/api/tiers/config': { status: 'success', config: {} },
  '/api/tiers/limites-publicos': { tiers: {} },
  '/api/tiers/precos-publicos': { planos: {} },
  '/api/admin/promo-banner/public': { active: false },
  '/api/billing/invoices': [],
  '/api/billing/subscription-details': { status: 'inactive' },
});

const nav = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const pg = await nav.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const errosJs = [];
pg.on('pageerror', (e) => errosJs.push(String(e).slice(0, 180)));

// Registra tudo que o app pediu ao servidor — é assim que se prova que uma
// recusa no cliente NÃO virou requisição.
const enviados = [];

await pg.route((u) => u.pathname.startsWith('/uploads/'), async (r) =>
  r.fulfill({ status: 200, contentType: 'image/png', body: FOTO_QUADRADA }));

await pg.route((u) => !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/_next/')
                      && !u.pathname.startsWith('/uploads/'), async (r) => {
  const res = await r.fetch(); const h = { ...res.headers() };
  delete h['content-security-policy']; delete h['content-security-policy-report-only'];
  await r.fulfill({ response: res, headers: h }); });

await pg.route((u) => u.pathname.startsWith('/api/'), async (r, q) => {
  const p = new URL(q.url()).pathname;
  if (p.endsWith('/auth/refresh'))
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"fake"}' });

  if (p === '/api/users/avatar') {
    enviados.push(q.method());
    if (q.method() === 'POST') {
      usuario = { ...usuario, avatar_url: '/uploads/avatars/u1-Ab3xQz9Kd.webp' };
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ message: 'Avatar atualizado!', avatar_url: usuario.avatar_url }) });
    }
    if (q.method() === 'DELETE') {
      usuario = { ...SEM_FOTO };
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Foto removida."}' });
    }
  }
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(R()[p] ?? {}) }); });

await pg.addInitScript(() => {
  const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  localStorage.setItem('bawzi_consent_accepted', 'true');
  localStorage.setItem('bawzi_tier', '4');
  localStorage.setItem('user_name', 'Marcelo Mendes');
  localStorage.setItem('user_email', 'development@bawzi.com');
  localStorage.setItem('bawzi_token',
    `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 86400 })}.x`);
});

await pg.goto('http://127.0.0.1:3100/profile', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3800);

const gatilho = pg.locator('button[aria-label="Menu do usuário"]');

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sem foto: a inicial, e um caminho visível para trocar isso
// ═══════════════════════════════════════════════════════════════════════════
checa('sem foto, o cabeçalho mostra a inicial', (await gatilho.innerText()).trim(), 'M');
checa('e não há imagem nenhuma no gatilho', await gatilho.locator('img').count(), 0);

const secao = pg.locator('#sec-perfil');
await secao.scrollIntoViewIfNeeded();
await pg.waitForTimeout(300);
// ⚠️ ESTA É A ASSERÇÃO QUE FALTAVA EXISTIR. O backend inteiro estava pronto e
// não havia onde clicar — o defeito era exatamente a ausência deste botão.
checa('🎯 a seção Perfil oferece escolher uma foto',
  await secao.locator('button', { hasText: /Escolher foto/ }).count(), 1);
checa('🎯 e o botão de câmera se identifica para leitor de tela',
  await secao.locator('button[aria-label="Escolher foto de perfil"]').count(), 1);
checa('o seletor de arquivo aceita só formatos de imagem',
  await secao.locator('input[type=file]').getAttribute('accept'),
  'image/jpeg,image/png,image/webp');
checa('sem foto, não há botão de remover (botão que não faz nada ensina a ignorar botões)',
  await secao.locator('button', { hasText: /^Remover$/ }).count(), 0);
checa('o limite e o recorte são ditos ANTES de escolher',
  /5 MB/.test(await secao.innerText()) && /quadrado central/.test(await secao.innerText()), true);

// ═══════════════════════════════════════════════════════════════════════════
// 2. As recusas do cliente não podem virar upload
// ═══════════════════════════════════════════════════════════════════════════
const entrada = secao.locator('input[type=file]');
await entrada.setInputFiles({ name: 'grande.png', mimeType: 'image/png',
                              buffer: Buffer.alloc(6 * 1024 * 1024, 7) });
await pg.waitForTimeout(400);
checa('🎯 arquivo acima de 5 MB é recusado na hora, com o tamanho no texto',
  /6[.,]0 MB/.test(await secao.innerText()), true);
checa('🎯 e nada foi enviado ao servidor', enviados, []);

await entrada.setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('nao sou imagem') });
await pg.waitForTimeout(400);
checa('arquivo que não é imagem é recusado', /Escolha um arquivo de imagem/.test(await secao.innerText()), true);
checa('e também não vira requisição', enviados, []);

// ═══════════════════════════════════════════════════════════════════════════
// 3. A prévia mostra o RESULTADO, não uma promessa
// ═══════════════════════════════════════════════════════════════════════════
await entrada.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: FOTO });
await pg.waitForTimeout(600);
checa('🎯 escolher a foto mostra a prévia antes de enviar',
  await secao.locator('img').count() >= 1, true);
checa('🎯 e o envio é uma decisão explícita, não automática',
  await secao.locator('button', { hasText: /Usar esta foto/ }).count(), 1);
checa('🎯 dá para desistir sem enviar',
  await secao.locator('button', { hasText: /Descartar/ }).count(), 1);
checa('escolher ainda não enviou nada', enviados, []);

// ⚠️ A PRÉVIA DE UMA FOTO 600×200 TEM DE SAIR QUADRADA. É o recorte que o
// servidor vai aplicar; se aqui ela aparecesse deitada, a pessoa aprovaria um
// enquadramento e receberia outro.
const cx = await secao.locator('img').first().boundingBox();
checa('🎯 a prévia de uma foto deitada aparece QUADRADA (é o recorte do servidor)',
  Math.abs(cx.width - cx.height) <= 1, true);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Enviar: o cabeçalho tem de mudar SEM recarregar a página
// ═══════════════════════════════════════════════════════════════════════════
await secao.locator('button', { hasText: /Usar esta foto/ }).click();
await pg.waitForTimeout(1500);
checa('🎯 o envio aconteceu', enviados.includes('POST'), true);
checa('🎯 o cabeçalho troca a inicial pela foto na mesma hora',
  await gatilho.locator('img').count(), 1);
checa('e a inicial some de lá', (await gatilho.innerText()).trim(), '');

// O menu aberto mostra o mesmo rosto — ele repete o avatar de propósito.
await gatilho.click();
await pg.waitForTimeout(400);
checa('🎯 o cartão do menu também mostra a foto',
  await pg.locator('[role="menu"] img').count(), 1);
await pg.keyboard.press('Escape');
await pg.waitForTimeout(300);

// ── O recorte redondo, medido no pixel ─────────────────────────────────────
// ⚠️ ESTA É A CHECAGEM QUE `rounded-full` SOZINHO NÃO GARANTE. Sem
// `overflow-hidden` no contêiner, a foto fica QUADRADA dentro do círculo: o
// markup é idêntico, só o canto denuncia. Amostramos o pixel do canto
// superior esquerdo da caixa do gatilho — dentro do quadrado, fora do círculo.
const caixa = await gatilho.boundingBox();
writeFileSync('/tmp/avatar-gatilho.png', await pg.screenshot(
  { clip: { x: caixa.x, y: caixa.y, width: caixa.width, height: caixa.height } }));
const amostra = JSON.parse(execSync(`python3 -c "
from PIL import Image; import json
im = Image.open('/tmp/avatar-gatilho.png').convert('RGB')
w, h = im.size
def magenta(p): return p[0] > 200 and p[1] < 80 and p[2] > 160
print(json.dumps({
  'cantos': [magenta(im.getpixel(c)) for c in
             ((1,1),(w-2,1),(1,h-2),(w-2,h-2))],
  'centro': magenta(im.getpixel((w//2, h//2))),
}))"`).toString());
checa('🎯 nenhum canto do avatar tem foto (o círculo recorta de verdade)',
  amostra.cantos.some(Boolean), false);
// ⚠️ SEM ESTA SEGUNDA LINHA A DE CIMA É INÚTIL: um avatar que não renderizou
// nada também não tem magenta nos cantos, e o teste passaria em verde
// justamente no caso em que a foto sumiu.
checa('🎯 e o centro TEM (senão a checagem acima passaria com o avatar vazio)',
  amostra.centro, true);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Remover devolve a inicial — nos dois lugares
// ═══════════════════════════════════════════════════════════════════════════
await secao.scrollIntoViewIfNeeded();
await pg.waitForTimeout(300);
checa('🎯 com foto, aparece "Trocar foto"',
  await secao.locator('button', { hasText: /Trocar foto/ }).count(), 1);
const remover = secao.locator('button', { hasText: /^Remover$/ });
checa('🎯 e "Remover"', await remover.count(), 1);

await remover.click();
await pg.waitForTimeout(1500);
checa('a remoção chegou ao servidor', enviados.includes('DELETE'), true);
// ⚠️ `avatar_url: null` VOLTA A SER A INICIAL NO CABEÇALHO. O ouvinte precisa
// distinguir "sem foto" de "este evento não fala de foto": um `if (detail.
// avatar_url)` descartaria justamente esta notificação, e o rosto removido
// continuaria no canto até recarregar.
checa('🎯 o cabeçalho volta para a inicial sem recarregar',
  (await gatilho.innerText()).trim(), 'M');
checa('e a imagem sai do gatilho', await gatilho.locator('img').count(), 0);
checa('🎯 o cache local também é limpo (senão a foto volta na próxima navegação)',
  await pg.evaluate(() => localStorage.getItem('user_avatar')), null);

checa('nenhum erro de JS na tela inteira', errosJs, []);

await secao.scrollIntoViewIfNeeded();
const rc = await secao.boundingBox();
await pg.screenshot({ path: 'tests/avatar.png',
  clip: { x: rc.x, y: rc.y, width: rc.width, height: Math.min(rc.height, 420) } });

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
await nav.close();
process.exit(ok ? 0 : 1);
