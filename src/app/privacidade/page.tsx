import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-16 px-6 sm:px-12 selection:bg-violet-500/30">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-bold mb-10 transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Voltar
        </Link>
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Aviso de Privacidade
          </h1>
          <div className="h-1.5 w-24 bg-blue-600 rounded-full mt-6"></div>
        </header>

        <div className="grid gap-12 text-lg">
          <section className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Lock className="text-blue-500" /> Como tratamos os seus dados
            </h2>
            <ul className="space-y-6">
              <li>
                <h3 className="text-white font-bold mb-2 underline decoration-blue-500/50">Recolha de Dados</h3>
                <p>Recolhemos o seu e-mail e nome para autenticação, CNPJ para configuração de workspace e os ficheiros PDF que submete para análise via IA.</p>
              </li>
              <li>
                <h3 className="text-white font-bold mb-2 underline decoration-blue-500/50">Finalidade</h3>
                <p>Os dados são usados exclusivamente para processar as análises solicitadas e gerir a sua conta e subscrição.</p>
              </li>
              <li>
                <h3 className="text-white font-bold mb-2 underline decoration-blue-500/50">Pagamentos Blindados</h3>
                <p>A Bawzi não armazena dados de cartão de crédito. Todas as transações são geridas pela infraestrutura global do <strong>Stripe</strong>.</p>
              </li>
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Privacidade e IA</h2>
            <p>
              A Bawzi utiliza APIs de nível empresarial (Enterprise APIs) da OpenAI, Google e Groq. 
            </p>
            <p className="font-bold text-white bg-slate-800 p-4 rounded-lg border-l-4 border-blue-500">
              Garantia de Confidencialidade: Os seus dados e documentos NÃO são utilizados para treinar modelos públicos de IA. O processamento é privado e efémero.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}