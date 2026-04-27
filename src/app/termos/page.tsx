import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function TermosPage() {
  const lastUpdate = new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-16 px-6 sm:px-12 selection:bg-violet-500/30">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-bold mb-10 transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Voltar para o início
        </Link>
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-sm">
            Última atualização: {lastUpdate}
          </p>
          <div className="h-1.5 w-24 bg-violet-600 rounded-full mt-6"></div>
        </header>

        <article className="space-y-8 text-lg leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Aceitação dos Termos</h2>
            <p>
              Ao aceder e utilizar a plataforma Bawzi (bawzi.com), o utilizador declara ter lido, compreendido e concordado com os presentes Termos de Uso. Este documento constitui um contrato vinculativo entre o utilizador e a Bawzi.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Descrição do Serviço</h2>
            <p>
              A Bawzi é uma plataforma SaaS que utiliza Inteligência Artificial para análise técnica de editais e documentos de licitação. O serviço visa a extração de insights, mapeamento de riscos e automação de checklists.
            </p>
            <div className="mt-4 p-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg">
              <p className="text-amber-200 text-sm font-semibold">
                AVISO: A Bawzi é uma ferramenta de apoio à decisão. Os outputs gerados não constituem aconselhamento jurídico formal. A decisão final sobre a participação em certames é de inteira responsabilidade do utilizador.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Subscrições e Pagamentos</h2>
            <p>
              O acesso aos planos premium é realizado mediante subscrição mensal processada de forma segura via <strong>Stripe</strong>. O utilizador pode cancelar a renovação automática a qualquer momento através do dashboard, mantendo o acesso até ao fim do período já pago.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Propriedade Intelectual</h2>
            <p>
              Todo o código, algoritmos de "prompt engineering" e identidade visual são propriedade exclusiva da Bawzi. O utilizador retém todos os direitos de propriedade sobre os ficheiros (PDFs) submetidos para análise.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Limitação de Responsabilidade</h2>
            <p>
              A Bawzi não garante êxito em processos licitatórios. Não seremos responsabilizados por eventuais desclassificações, multas ou perdas contratuais decorrentes da utilização da ferramenta.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}