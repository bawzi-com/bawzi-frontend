'use client';
import { useState, useEffect } from 'react';

const CONSENT_KEY = 'bawzi_consent_accepted';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-[900] sm:bottom-4 sm:left-4 sm:right-4">
      <div className="pointer-events-auto mx-auto grid max-w-3xl grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 text-slate-700 shadow-2xl shadow-slate-950/20 backdrop-blur sm:max-w-4xl sm:px-4 sm:py-3">
        <p className="text-[11px] font-medium leading-4 sm:text-xs sm:leading-5">
          Usamos dados essenciais para operar a Bawzi. Consulte a{' '}
          <a href="/lgpd" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
            LGPD
          </a>
          {' '}e a{' '}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
            privacidade
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="h-9 shrink-0 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition-all hover:bg-slate-800 active:scale-[0.97] sm:h-10 sm:px-4"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
