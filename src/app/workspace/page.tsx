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
        // 🟢 ATRASO TÁTICO DE 3 SEGUNDOS: Dá tempo ao Webhook do Stripe para atualizar o BD
        setTimeout(async () => {
          try {
            const token = localStorage.getItem('bawzi_token');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://bawzi-api.onrender.com';
            const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/users/me`;

            const response = await fetch(apiUrl, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const freshData = await response.json();
              
              // Procura por .tier ou .tier_level ou assume 1 se não vier nada
              const detectedTier = freshData.tier ?? freshData.tier_level ?? 1;

              localStorage.setItem('bawzi_tier', detectedTier.toString());
              console.log("✅ Tier sincronizado:", detectedTier);
              
              // Limpa a URL e recarrega
              window.history.replaceState({}, document.title, window.location.pathname);
              window.location.reload(); 
            }
          } catch (err) {
            console.error("Erro ao sincronizar dados pós-pagamento:", err);
          }
        }, 3000);
      }
    };

    checkUpgrade();
  }, []);

  return (
    <div className="pt-8">
      <AnalysisApp /> 
    </div>
  );
}