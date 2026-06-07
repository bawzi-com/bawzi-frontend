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
    <div className="fixed bottom-0 left-0 right-0 z-[900] bg-slate-900 border-t border-slate-700 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-xs text-slate-400 leading-relaxed flex-1">
          Utilizamos seus dados (nome, e-mail, documentos enviados) exclusivamente para prestar os serviços da plataforma, em conformidade com a{' '}
          <a href="/lgpd" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline underline-offset-2 hover:text-violet-300 font-medium">
            LGPD (Lei nº 13.709/2018)
          </a>.{' '}
          Saiba mais em nossa{' '}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline underline-offset-2 hover:text-violet-300 font-medium">
            Política de Privacidade
          </a>.
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-6 py-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.97] text-white text-sm font-bold rounded-lg transition-all"
        >
          OK, entendi
        </button>
      </div>
    </div>
  );
}
