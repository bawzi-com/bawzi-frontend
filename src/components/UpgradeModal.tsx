'use client';

import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

// Inicialize o Stripe fora do componente
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;  
  clientSecret: string | null; 
}

export default function UpgradeModal({ isOpen, onClose, tier, clientSecret }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col">
        
        {/* Botão de Fechar discreto */}
        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all z-50">&times;</button>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {clientSecret ? (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Sincronizando com Stripe...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}