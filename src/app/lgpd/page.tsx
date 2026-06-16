import { ArrowLeft, CheckCircle2, Database, FileCheck2, LockKeyhole, Mail, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';

const version = 'v2.0';
const lastUpdate = '16 de junho de 2026';

const principles = [
  ['Finalidade', 'tratamos dados para fins legítimos, específicos e informados, ligados ao funcionamento da Bawzi.'],
  ['Necessidade', 'buscamos limitar dados ao necessário para conta, análise, segurança, pagamento, suporte e obrigações legais.'],
  ['Transparência', 'explicamos categorias de dados, finalidade, bases legais, operadores, retenção e canais de solicitação.'],
  ['Segurança', 'adotamos controles técnicos e administrativos para reduzir riscos de acesso indevido, perda, alteração ou divulgação.'],
  ['Responsabilização', 'mantemos registros, consentimentos, logs e procedimentos para demonstrar medidas de proteção.'],
];

const rights = [
  'confirmação da existência de tratamento;',
  'acesso aos dados pessoais tratados;',
  'correção de dados incompletos, inexatos ou desatualizados;',
  'anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;',
  'portabilidade, quando regulamentada e tecnicamente aplicável;',
  'informação sobre compartilhamento com operadores, parceiros e terceiros;',
  'revogação do consentimento e informação sobre consequências da negativa;',
  'oposição a tratamento realizado com fundamento em bases legais aplicáveis, quando houver descumprimento da LGPD;',
  'revisão de decisões tomadas unicamente com base em tratamento automatizado, quando produzirem efeitos relevantes sobre seus interesses.',
];

const controls = [
  {
    icon: UserCheck,
    title: 'Consentimento registrado',
    body: 'Quando o consentimento é usado, a plataforma registra versão, data, horário e dados técnicos do aceite para rastreabilidade.',
  },
  {
    icon: RotateCcw,
    title: 'Revogação',
    body: 'O consentimento pode ser revogado por solicitação ou recurso disponível, sem invalidar tratamentos realizados antes da revogação.',
  },
  {
    icon: Database,
    title: 'Histórico controlável',
    body: 'Usuários autenticados podem apagar análises específicas ou limpar o histórico do workspace, respeitadas retenções legais e técnicas.',
  },
  {
    icon: LockKeyhole,
    title: 'Segregação por workspace',
    body: 'A Bawzi utiliza segregação lógica por workspace, autenticação e controles de permissão para reduzir risco de acesso indevido.',
  },
];

const requestSteps = [
  ['1. Identificação', 'Envie a solicitação pelo e-mail do titular ou por canal autenticado da plataforma. Podemos pedir informações adicionais para confirmar identidade e evitar acesso indevido.'],
  ['2. Triagem', 'Classificamos a solicitação: acesso, correção, exclusão, revogação, oposição, informação sobre compartilhamento ou outro direito previsto na LGPD.'],
  ['3. Resposta', 'Respondemos em prazo razoável e compatível com a LGPD, explicando providências, limitações técnicas, retenções legais ou impossibilidade justificada.'],
  ['4. Execução', 'Quando cabível, corrigimos, exportamos, bloqueamos, anonimizamos ou eliminamos dados nos sistemas ativos, com propagação conforme ciclos técnicos e backups.'],
];

const securityPractices = [
  'senhas armazenadas com hash criptográfico;',
  'refresh token em cookie HttpOnly quando aplicável;',
  'controle de acesso por usuário e workspace;',
  'validação de arquivos e limites de upload;',
  'logs para segurança, auditoria e investigação de abuso;',
  'restrição de acesso administrativo a dados operacionais;',
  'monitoramento opcional de erros e incidentes técnicos;',
  'procedimentos de resposta a incidentes com avaliação de risco ao titular.',
];

export default function LgpdPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-300 selection:bg-emerald-500/30 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-emerald-400 transition-colors hover:text-emerald-300">
          <ArrowLeft size={18} /> Voltar
        </Link>

        <header className="mb-10 border-b border-slate-800 pb-10 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
            <ShieldCheck size={14} /> Governança de dados
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Conformidade LGPD
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-7 text-slate-400">
            Esta página resume como a Bawzi aplica princípios da Lei Geral de Proteção de Dados na operação da plataforma.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">Versão {version}</span>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Atualizado em {lastUpdate}</span>
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-sm font-semibold leading-6 text-amber-100/90">
            A LGPD é um programa contínuo, não um selo estático. Esta página descreve práticas implementadas e compromissos operacionais, sem prometer conformidade absoluta ou imunidade a risco.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          {principles.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <UserCheck className="text-emerald-400" size={22} /> Direitos do titular
          </h2>
          <p className="mb-5 text-sm leading-7 text-slate-300">
            Titulares podem solicitar, conforme a LGPD e limites legais/técnicos aplicáveis:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {rights.map((right) => (
              <div key={right} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-400">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                <span>{right}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {controls.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <Icon className="mb-3 text-sky-400" size={24} />
              <h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <Mail className="text-sky-400" size={22} /> Como exercer direitos
          </h2>
          <div className="mb-6 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-sky-100/90">
            Envie sua solicitação para <a className="font-bold text-sky-200 underline underline-offset-4" href="mailto:dpo@bawzi.com">dpo@bawzi.com</a>. Se a conta pertencer a uma empresa cliente, algumas solicitações podem exigir validação com o administrador do workspace.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {requestSteps.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
              <LockKeyhole className="text-emerald-400" size={22} /> Segurança
            </h2>
            <ul className="space-y-3">
              {securityPractices.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-400">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
              <FileCheck2 className="text-sky-400" size={22} /> Incidentes de segurança
            </h2>
            <div className="space-y-4 text-sm leading-7 text-slate-300">
              <p>
                Em caso de incidente confirmado envolvendo dados pessoais, a Bawzi avaliará natureza dos dados, titulares afetados, riscos, medidas de contenção e necessidade de comunicação.
              </p>
              <p>
                Quando houver risco ou dano relevante, a Bawzi adotará providências compatíveis com a LGPD e orientações da ANPD, incluindo comunicação aos titulares e à autoridade quando exigido.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 text-xl font-black tracking-tight text-white">Referências normativas e orientações</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lgpd-en-lei-no-13-709-capa.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-white"
            >
              Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais.
            </a>
            <a
              href="https://www.gov.br/anpd/pt-br"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 transition-colors hover:border-sky-400/40 hover:text-white"
            >
              ANPD — orientações para titulares, agentes de tratamento e comunicação de incidentes.
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
