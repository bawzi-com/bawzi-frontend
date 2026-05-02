import './globals.css';
import type { Metadata } from 'next';

import Header from '../components/Header'; 
import Footer from '../components/Footer';
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
          
          {/* CABEÇALHO GLOBAL */}
          <Header />

          {/* O CONTEÚDO DA PÁGINA OCUPA O ESPAÇO RESTANTE (flex-1) */}
          <main className="flex-1">
            {children}
          </main>

          {/* RODAPÉ GLOBAL */}
          <Footer />

        </TierProvider>

      </body>
    </html>
  );
}