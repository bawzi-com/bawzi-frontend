'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// A forma dos nossos dados globais
interface TierContextProps {
  tierLimits: Record<number, number>;
  tierFileLimits: Record<number, number>;
  isLoading: boolean;
}

// Valores de segurança (Fallbacks)
const fallbackTierLimits = { [-1]: 10000, 1: 25000, 2: 80000, 3: 180000, 4: 400000 };
const fallbackTierFileLimits = { [-1]: 3, 1: 5, 2: 15, 3: 30, 4: 100 };

// Criar o Contexto
const TierContext = createContext<TierContextProps>({
  tierLimits: fallbackTierLimits,
  tierFileLimits: fallbackTierFileLimits,
  isLoading: true,
});

// O Provider (que vai abraçar a nossa aplicação)
export function TierProvider({ children }: { children: ReactNode }) {
  const [tierLimits, setTierLimits] = useState<Record<number, number>>(fallbackTierLimits);
  const [tierFileLimits, setTierFileLimits] = useState<Record<number, number>>(fallbackTierFileLimits);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const carregarConfiguracoes = async () => {
      try {
        // 🟢 INJETA A URL DO BACKEND AQUI
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        
        // 🟢 FAZ O FETCH NA ROTA CERTA DO FASTAPI (/api/tiers/config)
        const response = await fetch(`${API_URL}/api/tiers/config`);
        
        if (!response.ok) return;

        const data = await response.json();
        
        // ⚠️ Isto testava `data.tiers` e lia `config.max_mb`. A rota devolve
        // `data.config` com a chave `max_file_mb` — os DOIS nomes estavam
        // errados, então este `if` nunca executou uma vez sequer. O site
        // buscava a configuração a cada carregamento e jogava fora, e os
        // limites usados eram sempre os `fallback*` deste arquivo. Nenhum
        // valor do Admin jamais chegou ao front, incluindo o limite de
        // caracteres que corta o texto colado na análise.
        if (data.config) {
          const novosLimites: Record<number, number> = {};
          const novosLimitesArquivo: Record<number, number> = {};

          Object.entries(data.config).forEach(([tierId, config]: [string, any]) => {
            const idNum = parseInt(tierId);
            if (typeof config?.max_chars === 'number') novosLimites[idNum] = config.max_chars;
            if (typeof config?.max_file_mb === 'number') novosLimitesArquivo[idNum] = config.max_file_mb;
          });

          setTierLimits(novosLimites);
          setTierFileLimits(novosLimitesArquivo);
        }
      } catch {
        // Mantém os limites locais quando a API não está disponível.
      } finally {
        setIsLoading(false);
      }
    };

    carregarConfiguracoes();
  }, []); // Executa apenas 1x ao abrir o site

  return (
    <TierContext.Provider value={{ tierLimits, tierFileLimits, isLoading }}>
      {children}
    </TierContext.Provider>
  );
}

// 🟢 Hook personalizado para usar facilmente em qualquer lado
export function useTierConfig() {
  return useContext(TierContext);
}
