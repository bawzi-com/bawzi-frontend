import { ArrowLeft, AlertTriangle, FileText, Scale, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const version = 'v2.0';
const lastUpdate = '16 de junho de 2026';

const sections = [
  {
    title: '1. Aceitação e escopo',
    body: [
      'Estes Termos de Uso regulam o acesso e a utilização da plataforma Bawzi, incluindo site, workspace, recursos de busca, análise de editais, relatórios, histórico, alertas, funcionalidades de equipe e integrações relacionadas.',
      'Ao criar conta, acessar a plataforma, contratar um plano ou utilizar qualquer funcionalidade, você declara que leu, compreendeu e aceita estes Termos. Se estiver usando a Bawzi em nome de uma empresa, declara possuir autorização para vincular essa empresa às obrigações aqui previstas.',
    ],
  },
  {
    title: '2. Natureza da plataforma',
    body: [
      'A Bawzi é uma plataforma SaaS de apoio à decisão em licitações públicas. O serviço combina dados fornecidos pelo usuário, bases públicas, automações e modelos de inteligência artificial para organizar informações, apontar riscos, estimar esforço, estruturar checklists e apoiar decisões operacionais.',
      'A Bawzi não substitui advogado, contador, responsável técnico, agente de contratação ou consultor especializado. Relatórios, scores, pareceres automatizados, alertas e recomendações são insumos de apoio, não garantias de habilitação, vitória, margem, regularidade documental ou resultado financeiro.',
    ],
  },
  {
    title: '3. Conta, workspace e responsabilidades do usuário',
    body: [
      'Você é responsável pela veracidade dos dados cadastrados, pela guarda de credenciais, pela configuração correta de empresas, CNPJs, usuários autorizados, limites operacionais e informações submetidas para análise.',
      'Em contas corporativas ou workspaces compartilhados, o administrador é responsável por convidar apenas pessoas autorizadas, remover acessos indevidos e definir quais dados empresariais podem ser tratados na plataforma.',
      'Você se compromete a não enviar conteúdo ilegal, malware, documentos sem autorização de uso, dados pessoais excessivos ou informações que violem direitos de terceiros, sigilo profissional, segredo comercial de terceiros ou normas aplicáveis.',
    ],
  },
  {
    title: '4. Uso de IA e validação humana',
    body: [
      'A Bawzi pode utilizar provedores de IA, extração de texto, classificação, enriquecimento de dados públicos e rotinas automatizadas. Esses recursos podem produzir erros, omissões, interpretações incompletas, estimativas imprecisas ou respostas dependentes da qualidade do documento analisado.',
      'Antes de participar de qualquer certame, enviar proposta, impugnar edital, assumir obrigação financeira ou tomar decisão sensível, você deve validar documentos oficiais, anexos, prazos, exigências técnicas, critérios de julgamento, habilitação, preço, capacidade operacional e orientação jurídica quando necessário.',
    ],
  },
  {
    title: '5. Planos, cobrança e cancelamento',
    body: [
      'Planos pagos, quando disponíveis, são cobrados por assinatura recorrente, processada por provedor de pagamento externo. A Bawzi não armazena dados completos de cartão.',
      'Você pode cancelar a renovação automática pelo painel ou canal indicado na plataforma. O cancelamento impede cobranças futuras, mantendo o acesso ao plano até o fim do ciclo já contratado, salvo disposição comercial ou legal diferente.',
      'Quando aplicável, pedidos de arrependimento, estorno ou reembolso serão analisados conforme a legislação brasileira, a política comercial vigente e as regras do provedor de pagamento.',
    ],
  },
  {
    title: '6. Dados, documentos e histórico',
    body: [
      'Você mantém a titularidade sobre documentos, textos, dados empresariais e informações que submeter à Bawzi. Ao usar a plataforma, concede à Bawzi autorização limitada para processar, armazenar, transmitir e exibir esses dados na medida necessária à prestação do serviço, segurança, suporte, auditoria, cobrança e melhoria operacional.',
      'Análises autenticadas podem ser salvas no histórico do workspace para permitir consulta posterior, continuidade de fluxo, comparação, monitoramento e gestão de decisões. Você pode excluir análises individualmente ou apagar o histórico pelos recursos disponíveis, observadas retenções técnicas, legais, antifraude e de backup quando aplicáveis.',
    ],
  },
  {
    title: '7. Propriedade intelectual',
    body: [
      'A plataforma, marca, interface, fluxos, modelos de análise, prompts, código, bancos auxiliares, documentação, design e demais elementos da Bawzi pertencem à Bawzi ou a seus licenciantes.',
      'É proibido copiar, revender, fazer engenharia reversa, treinar concorrente, explorar comercialmente relatórios em massa ou usar a plataforma para reproduzir funcionalidade substancialmente equivalente sem autorização prévia.',
    ],
  },
  {
    title: '8. Disponibilidade e alterações',
    body: [
      'A Bawzi busca manter o serviço estável e seguro, mas não garante disponibilidade ininterrupta. Manutenções, falhas de terceiros, indisponibilidade de bases públicas, bloqueios de APIs, erros de rede, limitações de provedores ou eventos de força maior podem afetar a plataforma.',
      'Funcionalidades, planos, limites, modelos de IA, integrações e preços podem ser alterados para evolução do produto, segurança, viabilidade econômica ou conformidade. Mudanças materialmente relevantes serão comunicadas por meios razoáveis.',
    ],
  },
  {
    title: '9. Limitação de responsabilidade',
    body: [
      'Na máxima extensão permitida pela lei, a Bawzi não responde por perda de oportunidade, desclassificação, sanções, multas, prejuízos indiretos, lucros cessantes, proposta inexequível, decisão tomada sem validação humana ou interpretação divergente de edital, órgão público ou autoridade.',
      'A responsabilidade total da Bawzi por danos diretos comprovados, quando legalmente cabível, fica limitada ao valor efetivamente pago pelo cliente à Bawzi nos 3 meses anteriores ao evento que originou a reclamação, salvo hipóteses em que a lei imponha limite diferente.',
    ],
  },
  {
    title: '10. Suspensão, encerramento e lei aplicável',
    body: [
      'A Bawzi pode suspender ou encerrar acesso em caso de violação destes Termos, fraude, abuso, risco de segurança, inadimplência, uso indevido de dados, tentativa de contornar limites técnicos ou ordem legal/regulatória.',
      'Estes Termos são regidos pelas leis da República Federativa do Brasil. Controvérsias deverão ser tratadas inicialmente pelos canais de suporte e, se não resolvidas, serão submetidas ao foro competente conforme a legislação aplicável.',
    ],
  },
];

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-300 selection:bg-emerald-500/30 sm:px-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-emerald-400 transition-colors hover:text-emerald-300">
          <ArrowLeft size={18} /> Voltar para o início
        </Link>

        <header className="mb-10 border-b border-slate-800 pb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
            <FileText size={14} /> Privacidade e Legal
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Termos de Uso
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-slate-400">
            Documento contratual para uso da Bawzi. Leia junto com o Aviso de Privacidade e a página de Conformidade LGPD.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">Versão {version}</span>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Atualizado em {lastUpdate}</span>
          </div>
        </header>

        <section className="mb-10 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-amber-300" size={20} />
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-amber-200">Aviso essencial</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-100/90">
                A Bawzi apoia análise e decisão, mas não garante resultado em licitações nem substitui validação técnica, jurídica, contábil ou operacional.
              </p>
            </div>
          </div>
        </section>

        <article className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black tracking-tight text-white">
                <Scale className="text-emerald-400" size={20} /> {section.title}
              </h2>
              <div className="space-y-4 text-[15px] leading-7 text-slate-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <footer className="mt-10 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5 text-sm leading-6 text-sky-100/90">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-sky-300" size={20} />
            <p>
              Dúvidas contratuais ou solicitações formais podem ser enviadas para{' '}
              <a className="font-bold text-sky-200 underline underline-offset-4" href="mailto:suporte@bawzi.com">
                suporte@bawzi.com
              </a>
              .
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
