import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * ⚠️ AUSÊNCIA DE robots.txt NÃO BLOQUEIA NADA — mas também não protege nada.
 * Sem este arquivo o buscador entra em tudo, inclusive `/workspace`, `/admin`
 * e `/profile`: páginas que exigem sessão e, para o robô, devolvem o esqueleto
 * vazio. Página vazia indexada é pior que página não indexada — ela concorre
 * com a home pelo mesmo termo e entrega nada a quem clica.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/login` e `/swagger` entraram em 07/09/2026: são rotas PÚBLICAS que
      // não estavam nem aqui nem no sitemap, ou seja, seriam indexadas. A de
      // login concorre com a home pelo nome da marca e não entrega nada a quem
      // clica; a de swagger serve a especificação da API (ela agora exige
      // senha, mas um resultado de busca apontando para lá continua sendo um
      // convite que ninguém quis fazer).
      disallow: ['/admin', '/workspace', '/profile', '/history', '/gestao',
                 '/convite', '/reset-password', '/confirmar-email', '/promo',
                 '/login', '/swagger'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
