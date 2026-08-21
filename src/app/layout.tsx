import './globals.css';
import type { Metadata } from 'next';

import Header from '../components/Header';
import Footer from '../components/Footer';
import ConsentBanner from '../components/ConsentBanner';
import ChatWidget from '../components/ChatWidget';
import { TierProvider } from '../Contexts/TierContext';

export const metadata: Metadata = {
  title: 'Bawzi — Inteligência em Editais e Contratos',
  description: 'Análise estratégica e gestão de oportunidades comerciais.',
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