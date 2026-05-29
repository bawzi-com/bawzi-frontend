import type { Metadata } from 'next';
import Link from 'next/link';
import PricingSection from '../../components/PricingSection';

export const metadata: Metadata = {
  title: 'Planos e Preços — Bawzi',
  description: 'Escolha o plano Bawzi ideal para a sua empresa. De 5 análises gratuitas ao plano Elite com análise ilimitada, War Room de concorrentes e Capital de Giro.',
};

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb / nav de volta */}
      <div className="max-w-[1400px] mx-auto px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para o início
        </Link>
      </div>

      {/* Hero da página */}
      <div className="max-w-[800px] mx-auto px-6 pt-12 pb-4 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">
          Planos e preços
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
          Escolha o seu nível
        </h1>
        <p className="text-slate-500 font-medium text-lg">
          Comece grátis com 5 análises. Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>

      {/* Seção de planos */}
      <PricingSection />

      {/* FAQ rápido */}
      <div className="max-w-[700px] mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-slate-900 text-center mb-8">Perguntas frequentes</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Posso cancelar a qualquer momento?',
              r: 'Sim. Cancele diretamente pelo painel de perfil, sem necessidade de contato com suporte.',
            },
            {
              q: 'O que acontece com minhas análises se eu fazer downgrade?',
              r: 'Todo o seu histórico é mantido. Apenas novos limites do plano inferior passam a valer.',
            },
            {
              q: 'Posso ter mais de uma empresa no mesmo plano?',
              r: 'Plano Pro suporta 2 empresas, Elite suporta 3. Cada empresa tem seu próprio CNPJ monitorado.',
            },
            {
              q: 'A análise do PNCP é em tempo real?',
              r: 'Sim. O Radar conecta diretamente na API pública do PNCP e retorna editais ativos no momento da busca.',
            },
          ].map(({ q, r }) => (
            <div key={q} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="font-black text-slate-900 mb-2 text-sm">{q}</p>
              <p className="text-slate-500 text-sm leading-relaxed">{r}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-sm text-slate-400">
          Tem dúvidas?{' '}
          <a href="mailto:suporte@bawzi.com" className="text-emerald-600 font-bold hover:underline">
            suporte@bawzi.com
          </a>
        </p>
      </div>
    </div>
  );
}
