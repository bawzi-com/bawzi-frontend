import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/**
 * Só as páginas PÚBLICAS, e só as que respondem conteúdo sem sessão.
 *
 * ⚠️ Listar uma rota autenticada aqui é pedir para o buscador indexar um
 * esqueleto vazio — e depois competir com a própria home por esse resultado.
 */
const PUBLICAS: Array<[string, number]> = [
  ['', 1.0],
  ['/plans', 0.9],
  ['/enterprise', 0.7],
  ['/docs', 0.5],
  ['/termos', 0.3],
  ['/privacidade', 0.3],
  ['/lgpd', 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();
  return PUBLICAS.map(([rota, priority]) => ({
    url: `${SITE}${rota}`,
    lastModified: agora,
    changeFrequency: rota === '' ? 'weekly' : 'monthly',
    priority,
  }));
}
