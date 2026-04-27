import { ArrowLeft, CheckCircle2, ShieldCheck, Database, HardDriveDownload } from 'lucide-react';
import Link from 'next/link';

export default function LgpdPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-16 px-6 sm:px-12 selection:bg-violet-500/30">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-bold mb-10 transition-colors">
          <ArrowLeft size={18} /> Voltar
        </Link>
        
        <header className="mb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter italic">
            COMPLIANCE <span className="text-violet-500">LGPD</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto italic">
            Segurança de dados e transparência total no tratamento de informações estratégicas.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl group hover:border-violet-500/50 transition-colors">
            <ShieldCheck className="text-violet-500 mb-4" size={40} />
            <h3 className="text-xl font-bold text-white mb-3">Privacidade de Modelos</h3>
            <p className="text-slate-400">Utilizamos instâncias privadas de API. Os seus segredos industriais e dados de editais nunca são partilhados com modelos públicos.</p>
          </div>
          
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl group hover:border-violet-500/50 transition-colors">
            <Database className="text-violet-500 mb-4" size={40} />
            <h3 className="text-xl font-bold text-white mb-3">Isolamento Multi-Tenant</h3>
            <p className="text-slate-400">Cada workspace possui um identificador único na nossa base de dados MongoDB Atlas, garantindo isolamento total entre utilizadores.</p>
          </div>
        </div>

        <article className="prose prose-invert prose-violet max-w-none bg-slate-900/30 p-8 md:p-12 rounded-3xl border border-slate-800">
          <h2 className="text-white">Os Seus Direitos</h2>
          <p>Em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), garantimos ao utilizador:</p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="text-violet-500 mt-1 flex-shrink-0" size={20} />
              <span><strong>Direito de Acesso:</strong> Consulta facilitada sobre quais os dados que tratamos.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="text-violet-500 mt-1 flex-shrink-0" size={20} />
              <span><strong>Direito ao Esquecimento:</strong> Eliminação definitiva da conta e de todo o histórico de análises mediante solicitação.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="text-violet-500 mt-1 flex-shrink-0" size={20} />
              <span><strong>Segurança em Repouso:</strong> Encriptação de bases de dados e palavras-passe via Bcrypt.</span>
            </li>
          </ul>

          <div className="mt-12 p-6 bg-violet-600/10 rounded-2xl border border-violet-500/20">
            <h4 className="text-white font-bold mb-2">Contato do DPO</h4>
            <p className="mb-0 text-sm">Dúvidas sobre o tratamento de dados? Contacte o nosso Encarregado de Proteção de Dados: <span className="text-violet-400 font-mono">dpo@bawzi.com</span></p>
          </div>
        </article>
      </div>
    </div>
  );
}