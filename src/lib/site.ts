/**
 * A URL canônica do site, num lugar só.
 *
 * ⚠️ ELA PRECISA SER ABSOLUTA E PRECISA EXISTIR. O `metadataBase` do Next
 * resolve as URLs relativas do Open Graph; sem ele, a imagem de preview vira
 * um caminho relativo que o WhatsApp e o LinkedIn não conseguem buscar — e o
 * link compartilhado aparece sem cartão, que é o mesmo resultado de não ter
 * Open Graph nenhum.
 *
 * Configurável por `NEXT_PUBLIC_SITE_URL` para o preview de branch não
 * anunciar a URL de produção como canônica (o que faria o buscador indexar o
 * preview e ignorar o site).
 *
 * ⚠️ O PADRÃO É `www`, E NÃO O APEX. Medido em 07/09/2026:
 *     curl -D - https://bawzi.com/  →  307  location: https://www.bawzi.com/
 * O host canônico é o `www`; o apex redireciona. Apontar o `metadataBase`, o
 * canonical e o sitemap para um host que redireciona não é fatal — o buscador
 * segue o 307 — mas gasta um salto em cada URL, divide sinal entre dois
 * endereços para a mesma página e faz o cartão do WhatsApp buscar a imagem de
 * Open Graph num endereço que responde 307 antes de responder a imagem.
 *
 * Se um dia o redirecionamento inverter (www → apex), este valor tem de
 * inverter junto: quem manda é para onde o `curl` acima aponta, não a
 * preferência de quem escreve a linha.
 */
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.bawzi.com')
  .replace(/\/+$/, '');
