'use client';

import React, { useState } from 'react';

export default function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('bawzi_token')}` },
        body: JSON.stringify({ tier: 2, cnpj: cnpj.replace(/\D/g, '') })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">✕</button>
        <h2 className="text-2xl font-black text-center mb-2">🚀 Limite Atingido!</h2>
        <p className="text-slate-500 text-center text-sm mb-8">Você já usou as suas 3 análises gratuitas. Insira o CNPJ para assinar o Plano Profissional.</p>
        <form onSubmit={handleUpgrade} className="space-y-4">
          <input type="text" required placeholder="CNPJ da Empresa" value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full p-4 rounded-xl border border-slate-200" />
          <button type="submit" disabled={loading} className="w-full py-4 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all">
            {loading ? 'A processar...' : 'Ir para o Pagamento'}
          </button>
        </form>
      </div>
    </div>
  );
}