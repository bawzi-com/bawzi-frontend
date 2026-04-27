'use client'; // 🟢 1. Adicionado para podermos executar código no browser (useEffect)

import { useEffect } from 'react';
import AnalysisApp from '../../components/analysis-app';

export default function WorkspacePage() {
  
  // 🟢 2. A lógica que "escuta" se o utilizador acabou de voltar do Stripe
  useEffect(() => {
    const checkUpgrade = async () => {
      const params = new URLSearchParams(window.location.search);
      const isSuccess = params.get('success') === 'true';

      if (isSuccess) {
        try {
          const token = localStorage.getItem('bawzi_token');
          
          // Usa a tua variável de ambiente de forma segura
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
          const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/me`;

          const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const freshData = await response.json();
            
            // 🚀 A MÁGICA ACONTECE AQUI: Atualiza o nível no navegador
            localStorage.setItem('bawzi_tier', freshData.tier.toString());
            console.log("✅ Tier sincronizado após pagamento:", freshData.tier);
            
            // Limpa o "?success=true" da barra de endereços para ficar bonito
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Força um recarregamento da página para o AnalysisApp "acordar" com os novos limites
            window.location.reload(); 
          }
        } catch (err) {
          console.error("Erro ao sincronizar dados pós-pagamento:", err);
        }
      }
    };

    checkUpgrade();
  }, []);

  return (
    <div className="pt-8">
      {/* O teu componente continua intacto aqui */}
      <AnalysisApp /> 
    </div>
  );
}