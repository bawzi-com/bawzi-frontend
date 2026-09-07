import './globals.css';
import type { Metadata } from 'next';

import Header from '../components/Header';
import Footer from '../components/Footer';
import ConsentBanner from '../components/ConsentBanner';
import ChatWidget from '../components/ChatWidget';
import { TierProvider } from '../Contexts/TierContext';
import { SITE } from '@/lib/site';

/**
 * ⚠️ ESTE BLOCO ERA TRÊS LINHAS, E ELAS CUSTAVAM VISITA.
 *
 * A descrição anterior — "Análise estratégica e gestão de oportunidades
 * comerciais" — não continha "edital", "licitação" nem "Go/No-Go". Ela
 * descrevia qualquer empresa de qualquer setor, e portanto nenhuma busca.
 *
 * E não havia `openGraph`. Sem ele, TODO link compartilhado aparece como URL
 * pelada: sem título, sem imagem, sem uma linha do que é. No mercado de
 * licitação, onde o link circula em grupo de WhatsApp e em mensagem de
 * LinkedIn, um link sem cartão é um link que ninguém abre — e o esforço de
 * aquisição se perde no último metro, depois de já ter sido pago.
 *
 * O texto abaixo é o MESMO da home, de propósito. Quem chega pelo cartão
 * precisa reconhecer a página que abre; promessa diferente entre o preview e
 * o H1 é a primeira coisa que faz alguém fechar a aba.
 */
const TITULO = 'Bawzi — Decisão Go / No-Go para licitações';
const DESCRICAO =
  'A Bawzi lê o edital inteiro — objeto, habilitação, prazos, penalidades — e '
  + 'devolve um veredito antes de você gastar equipe, preço e risco na disputa '
  + 'errada. Análise gratuita, sem cadastro.';

export const metadata: Metadata = {
  // Resolve as URLs relativas do Open Graph. Sem isto a imagem do cartão vira
  // caminho relativo e nenhum robô de preview consegue buscá-la.
  metadataBase: new URL(SITE),
  title: {
    default: TITULO,
    // As páginas internas herdam a marca sem repetir a frase inteira.
    template: '%s — Bawzi',
  },
  description: DESCRICAO,
  applicationName: 'Bawzi',
  keywords: [
    'edital', 'licitação', 'análise de edital', 'Go No-Go',
    'PNCP', 'Lei 14.133', 'pregão eletrônico', 'habilitação',
    'termo de referência', 'participar de licitação',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE,
    siteName: 'Bawzi',
    title: TITULO,
    description: DESCRICAO,
    images: [{
      url: '/og.png',
      width: 1200,
      height: 630,
      alt: 'Bawzi — decisão Go / No-Go para licitações',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRICAO,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    // O buscador precisa poder mostrar o trecho e a miniatura; sem isto o
    // resultado sai sem preview e perde clique para quem tem.
    googleBot: { index: true, follow: true, 'max-image-preview': 'large',
                 'max-snippet': -1 },
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900" suppressHydrationWarning>
        
        {/* 🟢 2. Embrulhar toda a aplicação com o TierProvider */}
        <TierProvider>

          {/* BANNER DE CONSENTIMENTO LGPD — aparece uma única vez por dispositivo */}
          <ConsentBanner />

          {/* CABEÇALHO GLOBAL — leva junto a barra de promoção.
              ⚠️ A BARRA SAIU DAQUI DE PROPÓSITO. Como irmã do `Header` ela
              tinha `z-index: auto` contra o `sticky z-50` dele: bastava rolar
              34px para o menu cobrir 34 dos seus 48px de altura. Dentro do
              bloco fixo do cabeçalho ela rola junto e fica sempre à frente do
              conteúdo. */}
          <Header />

          {/* O CONTEÚDO DA PÁGINA OCUPA O ESPAÇO RESTANTE (flex-1) */}
          <main className="flex-1">
            {children}
          </main>

          {/* RODAPÉ GLOBAL */}
          <Footer />

          {/* WIDGET DE CHAT FLUTUANTE */}
          <ChatWidget />

        </TierProvider>

      </body>
    </html>
  );
}