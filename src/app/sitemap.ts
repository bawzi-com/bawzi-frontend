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

/**
 * ⚠️ SEM `lastModified`, DE PROPÓSITO — E ISSO É UMA CORREÇÃO, NÃO UM ESQUECIMENTO.
 *
 * A primeira versão usava `lastModified: new Date()`, avaliado no build. O
 * efeito era toda URL declarar ter mudado a cada deploy, inclusive `/termos` e
 * `/privacidade`, que não mudam há meses. O Google trata `lastmod` como dica
 * verificável: quando ela não bate com o que ele vê ao rastrear, ele passa a
 * ignorar o campo para o site inteiro — e aí ele deixa de servir justamente no
 * dia em que uma página muda de verdade e queremos que seja revisitada.
 *
 * As duas formas de medir a data real NÃO funcionam neste build:
 *
 *   · `fs.statSync(...).mtime` do arquivo da rota — a Vercel constrói a partir
 *     de um clone do git, e clone não preserva `mtime`. Todos os arquivos
 *     ficam com a hora do checkout: o `new Date()` de volta, com mais passos.
 *   · data do último commit do arquivo — o clone é raso (`depth 1`), não há
 *     histórico para consultar.
 *
 * Não havendo como medir, o campo sai. Ausente significa "não sei", que é
 * verdade e que o buscador sabe interpretar (ele cai nos próprios sinais).
 * Presente e errado significa "mudou hoje", que é mentira e custa a
 * credibilidade do campo para todas as outras páginas.
 *
 * Para reintroduzi-lo com valor: gravar a data no momento em que a página
 * muda — uma constante ao lado da rota, atualizada no mesmo commit que edita
 * o conteúdo. Aí o número é declarado por quem sabe, não inferido por quem
 * não pode saber.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLICAS.map(([rota, priority]) => ({
    url: `${SITE}${rota}`,
    changeFrequency: rota === '' ? 'weekly' : 'monthly',
    priority,
  }));
}
