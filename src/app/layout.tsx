import './globals.css';
import type { Metadata } from 'next';

import Header from '../components/Header'; 
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'Bawzi — Inteligência em Editais',
  description: 'Análise estratégica e gestão de oportunidades comerciais.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      {/* Adicionámos flexbox para o footer descer sempre para o fim do ecrã */}
      <body className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
        
        {/* CABEÇALHO GLOBAL */}
        <Header />

        {/* O CONTEÚDO DA PÁGINA OCUPA O ESPAÇO RESTANTE (flex-1) */}
        <main className="flex-1">
          {children}
        </main>

        {/* RODAPÉ GLOBAL */}
        <Footer />

      </body>
    </html>
  );
}