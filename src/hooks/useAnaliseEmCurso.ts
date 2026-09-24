'use client';
/**
 * useAnaliseEmCurso.ts — a análise que está rodando, vista de FORA do workspace.
 *
 * O chip do cabeçalho ("Analisando 3/5" / "Laudo pronto") usa isto em Planos,
 * Documentação, Perfil, Admin — as rotas que desmontam o app de análise. Lê o
 * mesmo marcador que o `useAnalysis` usa para retomar (ver
 * `lib/analiseEmCurso.ts`) e pergunta a etapa real ao servidor.
 *
 * Custo zero sem análise: sem marcador não há polling. Com marcador, uma
 * consulta a cada 4 s ao `/analyze/progress`, que o backend responde da
 * memória.
 */
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/apiClient';
import {
  CHAVE_ANALISE_EM_CURSO,
  EVENTO_ANALISE_EM_CURSO,
  lerMarcadorAnalise,
} from '@/lib/analiseEmCurso';

export interface AnaliseEmCursoResumo {
  concluida: boolean;
  etapa?: number;
  total?: number;
}

export function useAnaliseEmCurso(ativo: boolean): AnaliseEmCursoResumo | null {
  const [estado, setEstado] = useState<AnaliseEmCursoResumo | null>(null);

  useEffect(() => {
    if (!ativo) { setEstado(null); return; }
    let vivo = true;
    let emVoo = false;
    let semSinal = 0;

    const verificar = async () => {
      if (emVoo) return;
      const m = lerMarcadorAnalise();
      if (!m || m.status === 'erro') { semSinal = 0; if (vivo) setEstado(null); return; }
      if (m.status === 'concluida') { if (vivo) setEstado({ concluida: true }); return; }
      emVoo = true;
      try {
        const r = await fetch(`${API_URL}/api/analyze/progress/${encodeURIComponent(m.progressToken)}`);
        if (!vivo) return;
        const p = r.ok ? await r.json() : null;
        if (!vivo) return;
        if (p?.status === 'ok') {
          semSinal = 0;
          if (p.cancelada) { setEstado(null); return; }   // cancelada: some
          setEstado({
            concluida: Boolean(p.done),
            etapa: typeof p.etapa === 'number' ? p.etapa : undefined,
            total: typeof p.total === 'number' ? p.total : undefined,
          });
          return;
        }
        // Servidor não conhece o token: ou a análise mal começou, ou o registro
        // expirou. Mostra "analisando" sem etapa por um tempo e depois some —
        // o workspace, ao montar, é quem dá a palavra final (e o laudo, se houver).
        semSinal += 1;
        if (semSinal >= 8) setEstado(null);
        else setEstado((prev) => prev ?? { concluida: false });
      } catch {
        if (vivo) setEstado((prev) => prev ?? { concluida: false });
      } finally {
        emVoo = false;
      }
    };

    void verificar();
    const intervalo = setInterval(verificar, 4000);
    const aoMudar = () => { void verificar(); };
    const aoStorage = (e: StorageEvent) => { if (e.key === CHAVE_ANALISE_EM_CURSO) void verificar(); };
    window.addEventListener(EVENTO_ANALISE_EM_CURSO, aoMudar);
    window.addEventListener('storage', aoStorage);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      window.removeEventListener(EVENTO_ANALISE_EM_CURSO, aoMudar);
      window.removeEventListener('storage', aoStorage);
    };
  }, [ativo]);

  return estado;
}
