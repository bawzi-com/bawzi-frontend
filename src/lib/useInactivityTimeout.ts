/**
 * useInactivityTimeout.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook que detecta inatividade do utilizador e encerra a sessão
 * automaticamente após o período configurado.
 *
 * Comportamento:
 *  • Monitoriza: mousemove, keydown, click, scroll, touchstart
 *  • Ao atingir (timeoutMs - warningMs): exibe aviso com contagem decrescente
 *  • Ao atingir timeoutMs: chama onExpire() (tipicamente clearSession)
 *  • Qualquer interação do utilizador reseta o temporizador
 *
 * Uso:
 *   useInactivityTimeout({
 *     onExpire: clearSession,
 *     timeoutMs: 30 * 60 * 1000,   // 30 minutos
 *     warningMs: 2 * 60 * 1000,    // aviso 2 min antes
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  /** Callback chamado quando o tempo de inatividade é atingido */
  onExpire: () => void;
  /** Tempo total de inatividade antes de expirar (ms). Default: 30 min */
  timeoutMs?: number;
  /** Quanto antes do timeout mostrar o aviso (ms). Default: 2 min */
  warningMs?: number;
  /** Se false, o hook fica inactivo (ex: utilizador não autenticado) */
  enabled?: boolean;
}

interface InactivityState {
  showWarning: boolean;
  secondsRemaining: number;
}

const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export function useInactivityTimeout({
  onExpire,
  timeoutMs = 30 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  enabled = true,
}: UseInactivityTimeoutOptions): InactivityState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(warningMs / 1000));

  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (expireTimer.current)    clearTimeout(expireTimer.current);
    if (warningTimer.current)   clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    expireTimer.current = null;
    warningTimer.current = null;
    countdownInterval.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(Math.floor(warningMs / 1000));

    // Timer para mostrar o aviso
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      let secs = Math.floor(warningMs / 1000);
      setSecondsRemaining(secs);

      countdownInterval.current = setInterval(() => {
        secs -= 1;
        setSecondsRemaining(secs);
        if (secs <= 0) {
          clearAllTimers();
        }
      }, 1000);
    }, timeoutMs - warningMs);

    // Timer final — expira sessão
    expireTimer.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      onExpire();
    }, timeoutMs);
  }, [timeoutMs, warningMs, onExpire, clearAllTimers]);

  const handleActivity = useCallback(() => {
    if (!enabled) return;
    startTimers();
  }, [enabled, startTimers]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    startTimers();

    EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      clearAllTimers();
      EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, startTimers, handleActivity, clearAllTimers]);

  return { showWarning, secondsRemaining };
}
