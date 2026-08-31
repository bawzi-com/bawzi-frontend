import { defineConfig } from 'vitest/config';
import path from 'node:path';

/* Runner de testes do frontend.
 *
 * ⚠️ `include` É EXPLÍCITO DE PROPÓSITO. `tests/` já existe neste repositório e
 * guarda scripts `.mjs` de verificação manual (abrem navegador, batem em URL
 * real). O padrão do vitest varreria a pasta inteira e tentaria executá-los —
 * o runner falharia por motivo que não é defeito de código, que é exatamente
 * como uma suíte perde a confiança de quem a lê. Aqui só entram os `.test.ts`
 * que vivem ao lado do que testam, em `src/`.
 *
 * O alias `@` repete o do `tsconfig.json`: sem ele o vitest não resolve os
 * imports de `@/lib/...` e cada teste morre no import, antes de afirmar nada.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    reporters: 'default',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
