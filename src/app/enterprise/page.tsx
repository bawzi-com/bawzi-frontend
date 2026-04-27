// app/enterprise/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

// Importação dinâmica para evitar erros de renderização no servidor (SSR)
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

export default function EnterpriseApiPage() {
  const [spec, setSpec] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Verifica se o utilizador é Nível 4 (Dominador)
    const tier = localStorage.getItem('bawzi_tier');
    
    if (tier === '4') {
      setIsAuthorized(true);
      // 2. Busca a documentação através do nosso túnel secreto
      fetch('/api/swagger')
        .then(res => res.json())
        .then(data => setSpec(data))
        .catch(err => console.error("Erro ao carregar docs:", err));
    } else {
      setIsAuthorized(false);
    }
  }, []);

  // Se ainda estiver a carregar
  if (isAuthorized === null) return <div className="min-h-screen bg-slate-50"></div>;

  // Se o utilizador NÃO for Nível 4
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Lock size={64} className="text-violet-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Acesso Restrito</h1>
        <p className="text-slate-400 max-w-md mb-8">
          A documentação da API Enterprise é exclusiva para clientes do plano Dominador (Nível 4). Faça upgrade para integrar a Bawzi ao seu ERP.
        </p>
        <Link href="/#planos" className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
          Ver Planos
        </Link>
      </div>
    );
  }

  // Se ele FOR Nível 4 e os dados carregaram
  return (
    <div className="min-h-screen bg-white">
      {/* HEADER CUSTOMIZADO BAWZI */}
      <div className="bg-slate-950 text-white py-12 px-6 sm:px-12 border-b-4 border-violet-600">
        <div className="max-w-6xl mx-auto">
          <Link href="/workspace" className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-bold mb-6 transition-colors">
            <ArrowLeft size={18} /> Voltar ao Workspace
          </Link>
          <h1 className="text-4xl font-black tracking-tight mb-2">Bawzi API <span className="text-violet-500">Enterprise</span></h1>
          <p className="text-slate-400 text-lg">Integre o nosso motor Multi-LLM de licitações diretamente no seu software.</p>
        </div>
      </div>

      {/* RENDERIZADOR DO SWAGGER */}
      <div className="max-w-6xl mx-auto py-12 px-6">
        {spec ? (
          <div className="prose-swagger">
            <SwaggerUI spec={spec} />
          </div>
        ) : (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}