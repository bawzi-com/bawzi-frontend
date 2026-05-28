// app/history/page.tsx
'use client';
import { useState, useEffect } from 'react';
import HistoryTab from '../../components/HistoryTab';

export default function HistoryPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem('bawzi_token'));
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      {token ? (
        <HistoryTab token={token} />
      ) : (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 text-center shadow-sm">
          <p className="text-slate-500 font-medium">Inicia sessão para aceder ao teu histórico estratégico.</p>
        </div>
      )}
    </div>
  );
}
