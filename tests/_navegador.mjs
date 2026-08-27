/**
 * Onde está o Chromium — a resposta muda de máquina para máquina.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OS NOVE VERIFICADORES DE NAVEGADOR NÃO RODAVAM NO MAC
 * ═══════════════════════════════════════════════════════════════════════════
 * Cada um trazia, fixo,
 * `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` — o
 * caminho do contêiner Linux onde foram escritos. No Mac esse arquivo não
 * existe e o `launch` estoura antes da primeira asserção.
 *
 * ⚠️ O CABEÇALHO DO `verifica_avatar.mjs` JÁ CONTAVA ESSA HISTÓRIA: "o caminho
 * do Playwright era fixo, e era o de outra máquina; um teste que não roda onde
 * é preciso não é cobertura, é decoração." O conserto de lá arrumou a resolução
 * do MÓDULO. O caminho do BINÁRIO ficou fixo, uma linha abaixo, no mesmo
 * arquivo — o defeito descrito continuou vivo dentro do texto que o descrevia.
 *
 * A regra agora: usa o caminho do contêiner SE ELE EXISTIR; senão deixa o
 * Playwright resolver o navegador que ele mesmo instalou.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE O PLAYWRIGHT É GLOBAL E NÃO ENTRA NO package.json
 * ═══════════════════════════════════════════════════════════════════════════
 * O pacote `playwright` baixa ~150 MB de navegador no `postinstall`. Em
 * `devDependencies`, a Vercel instalaria isso em TODO build de produção — por
 * causa de testes que ela nunca roda. A resolução do módulo em cada verificador
 * já procura no `npm root -g`, então:
 *
 *     npm i -g playwright && npx playwright install chromium
 *
 * Sem o Playwright instalado, os verificadores saem com código 2 (PULADO), que
 * não é 0 — "não rodou" nunca pode virar "passou".
 */
import { existsSync } from 'node:fs';

const DO_CONTEINER = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const opcoesDoChromium = existsSync(DO_CONTEINER)
  ? { executablePath: DO_CONTEINER }
  : {};
