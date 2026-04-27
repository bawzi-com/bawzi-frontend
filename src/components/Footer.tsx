'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  // 1. Estado que controla se o link secreto aparece
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 2. Lógica para decidir quem vê o link. 
    // Pode mudar o '4' para o e-mail do admin, se preferir.
    const userTier = localStorage.getItem('bawzi_tier');
    
    if (userTier === '4') {
      setIsAuthorized(true);
    }
  }, []);

  return (
    <footer className="bg-white text-slate-500 relative overflow-hidden border-t border-slate-200/60">
      
      {/* 1. Linha gradiente no topo para um toque premium */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 opacity-80"></div>
      
      {/* 2. Efeito de luz de fundo (super subtil) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-violet-100/30 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        
        {/* Coluna 1: Marca */}
        <div className="md:col-span-2">
          {/* Logo */}
          <img src="/logo-bawzi.png" alt="Bawzi" className="h-8 w-auto mb-6 drop-shadow-sm" />
          
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-6 font-medium">
            Inteligência Artificial avançada para análise de editais e contratos. 
            Tome decisões de <span className="text-violet-600 font-bold">Go/No-Go</span> em segundos com o nosso motor Multi-LLM.
          </p>
          
          <div className="flex gap-3">
            {/* Ícone LinkedIn */}
            <a href="#" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-violet-600 hover:text-white hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-600/20 transition-all duration-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            </a>
            {/* Ícone Instagram */}
            <a href="#" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-pink-600 hover:text-white hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-600/20 transition-all duration-300">
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
          </div>
        </div>

        {/* Coluna 2: Produto */}
        <div>
          <h4 className="text-slate-900 font-bold mb-5 uppercase tracking-widest text-[11px]">Produto</h4>
          <ul className="space-y-3 text-sm font-medium">
            <li><Link href="/#planos" className="hover:text-violet-600 transition-colors">Planos e Preços</Link></li>
            <li><Link href="/workspace" className="hover:text-violet-600 transition-colors">Nova Análise</Link></li>
            <li><Link href="/history" className="hover:text-violet-600 transition-colors">O Meu Histórico</Link></li>
            <li>
              <Link href="/enterprise" className="group flex items-center gap-2 hover:text-violet-600 transition-colors">
                API Enterprise 
                <span className="bg-violet-100 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition-colors">Novo</span>
              </Link>
            </li>
            
            {/* 3. BLOCO CONDICIONAL DA DOCUMENTAÇÃO API */}
            {isAuthorized && (
              <li>
                <Link 
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.bawzi.com'}/docs`} 
                  target="_blank"
                  className="group flex items-center gap-2 hover:text-violet-600 transition-colors"
                >
                  Documentação API 
                  <span className="bg-violet-100 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-full group-hover:bg-violet-600 group-hover:text-white transition-colors">
                    Restrito
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* Coluna 3: Legal (LGPD) */}
        <div>
          <h4 className="text-slate-900 font-bold mb-5 uppercase tracking-widest text-[11px]">Privacidade e Legal</h4>
          <ul className="space-y-3 text-sm font-medium">
            <li><Link href="/termos" className="hover:text-violet-600 transition-colors">Termos de Uso</Link></li>
            <li><Link href="/privacidade" className="hover:text-violet-600 transition-colors">Aviso de Privacidade</Link></li>
            <li><Link href="/lgpd" className="hover:text-violet-600 transition-colors">Conformidade LGPD</Link></li>
          </ul>
        </div>
      </div>

      {/* Barra Inferior */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs font-medium text-slate-400">© {new Date().getFullYear()} Bawzi. Todos os direitos reservados.</p>
        <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          Feito com <span className="text-pink-500 text-sm animate-pulse">♥</span> para empresas vencedoras.
        </p>
      </div>
      
    </footer>
  );
}