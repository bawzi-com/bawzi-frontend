import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * A especificação OpenAPI do backend, atrás da MESMA senha que a protege lá.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ESTA ROTA AUTENTICAVA-SE EM NOME DE QUALQUER VISITANTE.
 * ═══════════════════════════════════════════════════════════════════════════
 * A versão anterior lia `DOCS_USERNAME`/`DOCS_PASSWORD` do ambiente, montava
 * o Basic Auth com elas e buscava o `openapi.json` — sem verificar QUEM estava
 * chamando. O backend protege esse arquivo com senha; esta rota guardava a
 * senha no servidor e entregava o resultado a quem digitasse a URL. Ela nunca
 * vazou a credencial, mas anulava por inteiro a proteção que a credencial
 * existe para dar: toda rota, todo schema, incluindo as de admin.
 *
 * Em 07/09/2026 ela respondia 401 — não por desenho, mas porque
 * `DOCS_PASSWORD` não estava definida na Vercel e o fetch ao backend falhava.
 * Isso é pior que estar quebrada: no dia em que alguém definisse a variável
 * para "fazer o swagger funcionar", a especificação ficaria pública sem uma
 * linha de aviso e sem ninguém ter decidido isso.
 *
 * Agora o navegador é quem apresenta a senha. A URL curta continua servindo
 * ao propósito para que foi criada — o browser pede a credencial uma vez e
 * guarda — e a proteção do backend volta a valer deste lado.
 *
 * ⚠️ SEM `DOCS_PASSWORD` CONFIGURADA A ROTA FECHA, e não abre. Credencial
 * ausente é motivo para recusar, nunca para dispensar a conferência: o
 * fallback `'sua_senha_aqui'` da versão anterior é exatamente o tipo de
 * placeholder que vira senha de produção por esquecimento.
 */

function confere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // Comprimentos diferentes já não casam; `timingSafeEqual` exige tamanhos
  // iguais, e comparar antes evita que ele lance em vez de devolver false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const PEDIR_SENHA = {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Bawzi API docs", charset="UTF-8"' },
};

export async function GET(request: Request) {
  const usuario = process.env.DOCS_USERNAME;
  const senha = process.env.DOCS_PASSWORD;

  if (!usuario || !senha) {
    // Fecha, e diz por quê no log do servidor — não na resposta, que é pública.
    console.error('[swagger] DOCS_USERNAME/DOCS_PASSWORD ausentes — rota fechada.');
    return NextResponse.json(
      { error: 'Documentação indisponível.' }, { status: 503 },
    );
  }

  const enviado = request.headers.get('authorization') || '';
  const esperado = 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
  if (!confere(enviado, esperado)) {
    return new NextResponse('Autenticação necessária.', PEDIR_SENHA);
  }

  try {
    const resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/openapi.json`, {
      headers: { Authorization: esperado },
      cache: 'no-store',
    });
    if (!resposta.ok) {
      console.error(`[swagger] backend respondeu ${resposta.status} ao openapi.json`);
      return NextResponse.json({ error: 'Documentação indisponível.' }, { status: 502 });
    }
    return NextResponse.json(await resposta.json(), {
      // Nunca em cache de CDN: a resposta depende de credencial.
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch (erro) {
    console.error('[swagger] falha ao buscar openapi.json:', erro);
    return NextResponse.json({ error: 'Documentação indisponível.' }, { status: 502 });
  }
}
