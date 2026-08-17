'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// A forma dos nossos dados globais
interface TierContextProps {
  tierLimits: Record<number, number>;
  tierFileLimits: Record<number, number>;
  /** Créditos por mês de cada plano. 0 = ilimitado. */
  tierCredits: Record<number, number>;
  /** Nome do plano como o cliente o vê. Fonte única: tier_config.py no
   *  backend. Escrever à mão no frontend foi o que produziu quatro
   *  vocabulários para os mesmos cinco planos. */
  tierNames: Record<number, string>;
  isLoading: boolean;
}

// Valores de segurança (Fallbacks)

// ⚠️ `4: 400000` ESTAVA DESATUALIZADO. `CHARS_TIER_4` virou 500.000 no backend
// e este espelho ficou para trás — com a API fora, o Avançado era anunciado
// com 100 mil caracteres A MENOS do que entrega.
const fallbackTierLimits = { [-1]: 10000, 1: 25000, 2: 80000, 3: 180000, 4: 500000 };

// ⚠️ ESTES SÃO OS MB EFETIVOS, NÃO OS DO PLANO.
// O plano define {3: 30, 4: 100}, mas `MAX_UPLOAD_MB` = 20 corta toda
// requisição acima disso, em qualquer tier. Espelhando o número do plano, o
// dropzone prometia "PDF ou TXT até 100MB" e o servidor recusava em 21 — a
// promessa e a regra saindo do mesmo backend por portas diferentes.
// `/api/tiers/config` agora já devolve capado; este fallback acompanha, senão
// a divergência volta exatamente quando a API cai — que é quando ninguém está
// olhando.
const fallbackTierFileLimits = { [-1]: 3, 1: 5, 2: 15, 3: 20, 4: 20 };
// Fallback só entra se a API não responder. Os valores reais vêm do Admin.
// ⚠️ ESPELHO dos defaults de config.py (LIMIT_TIER_*) — mudou lá, muda aqui.
// A escada anterior ({2:60, 3:30, 4:35}) era INVERTIDA: com a API fora, a
// EscadaDePlanos convidava ao Avançado prometendo MENOS créditos que o
// Essencial — um fallback que fazia anti-venda.
const fallbackTierCredits = { [-1]: 1, 1: 5, 2: 90, 3: 250, 4: 650 };
const fallbackTierNames: Record<number, string> = {
  [-1]: 'Visitante', 1: 'Gratuito', 2: 'Essencial', 3: 'Profissional', 4: 'Avançado',
};

// Criar o Contexto
const TierContext = createContext<TierContextProps>({
  tierLimits: fallbackTierLimits,
  tierFileLimits: fallbackTierFileLimits,
  tierCredits: fallbackTierCredits,
  tierNames: fallbackTierNames,
  isLoading: true,
});

// O Provider (que vai abraçar a nossa aplicação)
export function TierProvider({ children }: { children: ReactNode }) {
  const [tierLimits, setTierLimits] = useState<Record<number, number>>(fallbackTierLimits);
  const [tierFileLimits, setTierFileLimits] = useState<Record<number, number>>(fallbackTierFileLimits);
  const [tierCredits, setTierCredits] = useState<Record<number, number>>(fallbackTierCredits);
  const [tierNames, setTierNames] = useState<Record<number, string>>(fallbackTierNames);
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
          const novosCreditos: Record<number, number> = {};
          const novosNomes: Record<number, string> = {};

          Object.entries(data.config).forEach(([tierId, config]: [string, any]) => {
            const idNum = parseInt(tierId);
            if (typeof config?.max_chars === 'number') novosLimites[idNum] = config.max_chars;
            if (typeof config?.max_file_mb === 'number') novosLimitesArquivo[idNum] = config.max_file_mb;
            if (typeof config?.monthly_limit === 'number') novosCreditos[idNum] = config.monthly_limit;
            if (typeof config?.name === 'string' && config.name.trim()) novosNomes[idNum] = config.name.trim();
          });

          // MESCLA sobre os fallbacks em vez de substituir. Substituindo, um
          // tier que a API deixe de listar — ou um campo que volte nulo —
          // some do frontend inteiro e vira `undefined` na hora de medir um
          // limite. O sintoma disso não é erro na tela: é limite errado
          // aplicado em silêncio, que foi exatamente o defeito do visitante
          // anônimo. O que a API manda continua vencendo; o fallback só
          // preenche buraco.
          setTierLimits(prev => ({ ...prev, ...novosLimites }));
          setTierFileLimits(prev => ({ ...prev, ...novosLimitesArquivo }));
          if (Object.keys(novosCreditos).length) setTierCredits(prev => ({ ...prev, ...novosCreditos }));
          if (Object.keys(novosNomes).length) setTierNames(prev => ({ ...prev, ...novosNomes }));
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
    <TierContext.Provider value={{ tierLimits, tierFileLimits, tierCredits, tierNames, isLoading }}>
      {children}
    </TierContext.Provider>
  );
}

// 🟢 Hook personalizado para usar facilmente em qualquer lado
export function useTierConfig() {
  return useContext(TierContext);
}
