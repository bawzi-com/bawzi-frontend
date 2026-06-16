import { ArrowLeft, Database, Globe2, Lock, Mail, Server, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';

const version = 'v2.0';
const lastUpdate = '16 de junho de 2026';

const dataCategories = [
  ['Conta e acesso', 'nome, e-mail, senha criptografada, autenticação social quando usada, tokens de sessão, registros de consentimento e preferências.'],
  ['Empresa e workspace', 'CNPJ, razão social, domínio, CNAE, porte, endereço, contatos, website, usuários do workspace, configurações de equipe e contexto ativo.'],
  ['Uso da plataforma', 'buscas, filtros, análises criadas, resultados, checklists, decisões, histórico, alertas, logs técnicos, data/hora, IP e eventos de segurança.'],
  ['Documentos e conteúdo', 'PDFs, textos colados, trechos extraídos, documentos oficiais de licitação, informações de editais e dados que você decide enviar para análise.'],
  ['Pagamento e assinatura', 'plano contratado, status de assinatura, identificadores de cliente/assinatura no provedor de pagamento, notas fiscais ou registros necessários. A Bawzi não armazena dados completos de cartão.'],
  ['Comunicação e suporte', 'mensagens enviadas ao suporte, e-mails transacionais, convites, compartilhamento de análises, notificações e preferências de comunicação.'],
];

const legalBases = [
  ['Execução de contrato', 'para criar conta, entregar análises, manter histórico, permitir workspace, cobrar planos e prestar suporte.'],
  ['Legítimo interesse', 'para segurança, prevenção a fraude, melhoria operacional, estatísticas internas, suporte, logs e proteção da plataforma.'],
  ['Cumprimento legal/regulatório', 'para obrigações fiscais, contábeis, consumeristas, segurança da informação e resposta a autoridades.'],
  ['Consentimento', 'quando exigido para comunicações opcionais, cookies não essenciais ou tratamento que dependa de autorização específica.'],
  ['Exercício regular de direitos', 'para preservar registros necessários em disputas, auditorias, cobranças, defesa judicial, administrativa ou arbitral.'],
];

const operators = [
  'provedores de nuvem, banco de dados, hospedagem, CDN, monitoramento e segurança;',
  'provedores de inteligência artificial e extração/processamento de linguagem;',
  'provedores de pagamento e cobrança, como processadores de assinatura;',
  'provedores de e-mail transacional, suporte, notificações e observabilidade;',
  'bases públicas e integrações governamentais usadas para enriquecer dados de licitação, CNPJ, sanções e mercado.',
];

const retention = [
  ['Conta', 'enquanto a conta existir e pelo prazo necessário para cumprir obrigações legais, segurança, auditoria e exercício de direitos.'],
  ['Histórico de análises', 'enquanto mantido pelo usuário ou workspace. Pode ser apagado individualmente ou em massa pelos recursos da plataforma, salvo retenções técnicas ou legais.'],
  ['Textos e documentos processados', 'podem ser armazenados como parte do histórico da análise e usados para exibir resultados, reprocessar revisões, monitorar alterações e manter rastreabilidade.'],
  ['Pagamentos', 'pelo prazo exigido por legislação fiscal, contábil, antifraude, cobrança e obrigações do provedor de pagamento.'],
  ['Logs e segurança', 'pelo período necessário para segurança, investigação de abuso, prevenção a fraude, auditoria e estabilidade operacional.'],
];

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-300 selection:bg-emerald-500/30 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-emerald-400 transition-colors hover:text-emerald-300">
          <ArrowLeft size={18} /> Voltar
        </Link>

        <header className="mb-10 border-b border-slate-800 pb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-300">
            <Lock size={14} /> Transparência de dados
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Aviso de Privacidade
          </h1>
          <p className="mt-4 max-w-4xl text-sm font-medium leading-6 text-slate-400">
            Este aviso explica como a Bawzi coleta, usa, compartilha, armazena e protege dados pessoais e dados empresariais enviados à plataforma.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">Versão {version}</span>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">Atualizado em {lastUpdate}</span>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <ShieldCheck className="mb-3 text-emerald-400" size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Controlador</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A Bawzi é controladora dos dados tratados diretamente para operar a plataforma. Em workspaces corporativos, a empresa cliente também pode tomar decisões sobre dados de seus usuários e documentos.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <Mail className="mb-3 text-sky-400" size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Contato</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Solicitações de privacidade: <a className="font-bold text-sky-300 underline underline-offset-4" href="mailto:development@bawzi.com">development@bawzi.com</a>.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <Trash2 className="mb-3 text-emerald-400" size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Controle do usuário</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A plataforma possui recursos para excluir análises, apagar histórico e solicitar exclusão de conta, observadas retenções legais e técnicas.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <Database className="text-emerald-400" size={22} /> Dados que podemos tratar
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {dataCategories.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <Server className="text-sky-400" size={22} /> Como usamos dados
          </h2>
          <div className="space-y-4 text-sm leading-7 text-slate-300">
            <p>
              Usamos dados para autenticar usuários, operar workspaces, analisar documentos, buscar informações públicas, gerar relatórios, manter histórico, enviar notificações, processar pagamentos, prestar suporte, prevenir fraude, proteger a plataforma e cumprir obrigações legais.
            </p>
            <p>
              Análises feitas por usuários autenticados podem ser armazenadas para histórico, gestão de decisão, comparação, monitoramento e continuidade operacional. Isso significa que o processamento não é puramente efêmero dentro da Bawzi.
            </p>
            <p>
              Dados enviados para IA são usados para gerar as respostas solicitadas. A Bawzi não usa documentos de clientes para treinar modelo público próprio. Quando utiliza provedores externos de IA, busca usar integrações e configurações compatíveis com uso empresarial, confidencialidade e restrições de treinamento conforme contratos e políticas desses provedores.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 text-xl font-black tracking-tight text-white">Bases legais</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {legalBases.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-sky-300">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-5 text-xl font-black tracking-tight text-white">Compartilhamento e operadores</h2>
            <p className="mb-4 text-sm leading-7 text-slate-300">
              Compartilhamos dados apenas quando necessário para operar a plataforma, cumprir contrato, proteger direitos, atender obrigação legal ou viabilizar integrações solicitadas.
            </p>
            <ul className="space-y-3">
              {operators.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-400">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black tracking-tight text-white">
              <Globe2 className="text-sky-400" size={22} /> Transferência internacional
            </h2>
            <p className="text-sm leading-7 text-slate-300">
              Provedores de IA, pagamento, nuvem, monitoramento e e-mail podem processar dados fora do Brasil. Nesses casos, a Bawzi busca utilizar fornecedores com controles de segurança, contratos, políticas empresariais e mecanismos compatíveis com a LGPD.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 text-xl font-black tracking-tight text-white">Retenção e exclusão</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {retention.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-xl font-black tracking-tight text-white">Cookies, localStorage e tecnologias similares</h2>
          <div className="space-y-4 text-sm leading-7 text-slate-300">
            <p>
              Usamos cookies essenciais e armazenamento local para autenticação, sessão, refresh token seguro, preferências, consentimento, nível de plano, contexto ativo de CNPJ e funcionamento da interface.
            </p>
            <p>
              Cookies ou ferramentas não essenciais de análise, marketing ou publicidade somente devem ser usados quando implementados com aviso e controle compatível com a legislação aplicável.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
