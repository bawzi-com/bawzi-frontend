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
        const response = await fetch('/api/tiers/config');
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.tiers) {
          const novosLimites: Record<number, number> = {};
          const novosLimitesArquivo: Record<number, number> = {};

          Object.entries(data.tiers).forEach(([tierId, config]: [string, any]) => {
            const idNum = parseInt(tierId);
            novosLimites[idNum] = config.max_chars;
            novosLimitesArquivo[idNum] = config.max_mb;
          });

          setTierLimits(novosLimites);
          setTierFileLimits(novosLimitesArquivo);
        }
      } catch (err) {
        console.error("Erro ao carregar tiers globais:", err);
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