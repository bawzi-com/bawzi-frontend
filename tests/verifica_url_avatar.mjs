/**
 * `urlDoAvatar` — o endereço da foto de perfil, nas duas formas que existem.
 *
 *   node tests/verifica_url_avatar.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE UM TESTE PARA SEIS LINHAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Porque as duas formas de errar são invisíveis: as duas produzem uma tag
 * `<img>` perfeitamente válida, com um `src` que o navegador aceita, e o único
 * sintoma é uma foto que não aparece — indistinguível de "esta pessoa não tem
 * foto", que é o estado normal de metade das contas.
 *
 *   · concatenar `API_URL` numa URL que já é absoluta dá
 *     `https://api.bawzi.comhttps://api.bawzi.com/uploads/...`;
 *   · não concatenar numa relativa dá `/uploads/...` resolvido contra o
 *     domínio do FRONT, onde não existe nada.
 *
 * E as duas formas convivem de verdade: o banco tem documentos das duas
 * épocas, e o `localStorage` de quem já usou o app guarda a forma antiga num
 * lugar que nenhuma migração alcança.
 *
 * ⚠️ O TESTE IMPORTA A FUNÇÃO DE VERDADE, não uma cópia. `apiClient.ts` não
 * tem import nenhum, então dá para transpilar o arquivo sozinho e carregar o
 * resultado. Uma reimplementação aqui dentro passaria mesmo depois de alguém
 * quebrar a original — foi assim que um teste desta base já ficou verde
 * durante semanas testando a si mesmo.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

let ok = true;
function checa(rotulo, obtido, esperado) {
  const bom = obtido === esperado;
  ok = ok && bom;
  console.log(`${bom ? '✅' : '❌'} ${rotulo}`);
  if (!bom) console.log(`     obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`);
}

// ── carrega a função real ───────────────────────────────────────────────────
const saida = mkdtempSync(join(tmpdir(), 'bawzi-url-'));
try {
  execFileSync('npx', ['tsc', join(RAIZ, 'src/lib/apiClient.ts'),
    '--outDir', saida, '--module', 'es2022', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--lib', 'es2022,dom', '--skipLibCheck'],
    { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
} catch { /* erro de tipo não impede a emissão; a checagem real é o tsc do build */ }

const emitido = join(saida, 'apiClient.js');
if (!existsSync(emitido)) {
  // Código 2: PULADO. Não é 0, porque "não rodou" não pode virar "passou".
  console.log('⏭  PULADO — o tsc não emitiu (isto NÃO é aprovação).');
  process.exit(2);
}
// `.mjs` porque o package.json do front não declara `"type": "module"`, e sem
// isso o Node lê o emitido como CommonJS e estoura no `export`.
const comoModulo = join(saida, 'apiClient.mjs');
writeFileSync(comoModulo, readFileSync(emitido, 'utf8'));

// Lido no topo do módulo, então tem de estar no ambiente ANTES do import.
process.env.NEXT_PUBLIC_API_URL = 'https://api.bawzi.com';
const { urlDoAvatar, API_URL } = await import(comoModulo);

checa('o módulo carregou com a base esperada', API_URL, 'https://api.bawzi.com');

// ── a forma nova: absoluta, passa intacta ───────────────────────────────────
const nova = 'https://api.bawzi.com/uploads/avatars/68a1-Ab3xQz9Kd.webp';
checa('🎯 URL absoluta do backend passa sem tocar', urlDoAvatar(nova), nova);
checa('🎯 e um dia com outro domínio (S3/CDN) também',
      urlDoAvatar('https://cdn.bawzi.com/av/x.webp'), 'https://cdn.bawzi.com/av/x.webp');
checa('http:// também é absoluta', urlDoAvatar('http://localhost:8000/uploads/avatars/x.webp'),
      'http://localhost:8000/uploads/avatars/x.webp');
checa('data: (prévia local) passa intacta', urlDoAvatar('data:image/webp;base64,AAA'),
      'data:image/webp;base64,AAA');
// ⚠️ ESTE CASO DERRUBOU A PRIMEIRA VERSÃO. Ela tratava `//qualquer` como URL
// de protocolo herdado e devolvia intacto — então `//uploads/avatars/x.webp`,
// que é só uma barra a mais num registro antigo, virava um pedido ao host
// `uploads`. Barra é caminho; esquema é endereço. Sem meio-termo.
checa('🎯 `//` é caminho, não host (a barra a mais não muda de domínio)',
      urlDoAvatar('//uploads/avatars/x.webp'), 'https://api.bawzi.com/uploads/avatars/x.webp');

// ── a forma velha: relativa, ganha a base ───────────────────────────────────
// ⚠️ ESTE É O CASO QUE NÃO PODE SUMIR. Vive no `localStorage` de todo mundo
// que já abriu o app, e é lido na montagem do cabeçalho antes de qualquer
// chamada ao servidor. Nenhuma migração de banco alcança aquele navegador.
checa('🎯 caminho relativo do banco antigo ganha a base',
      urlDoAvatar('/uploads/avatars/x.webp'), 'https://api.bawzi.com/uploads/avatars/x.webp');
checa('sem a barra inicial também', urlDoAvatar('uploads/avatars/x.webp'),
      'https://api.bawzi.com/uploads/avatars/x.webp');
checa('três barras também', urlDoAvatar('///uploads/avatars/x.webp'),
      'https://api.bawzi.com/uploads/avatars/x.webp');

// ── ausência é ausência, e não uma imagem quebrada ──────────────────────────
checa('null devolve null (a inicial colorida aparece)', urlDoAvatar(null), null);
checa('undefined devolve null', urlDoAvatar(undefined), null);
checa('string vazia devolve null', urlDoAvatar(''), null);

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
