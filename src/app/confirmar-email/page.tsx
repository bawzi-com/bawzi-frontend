'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { API_URL, clearSession, mensagemDeErro } from '@/lib/apiClient';

/**
 * Passo 2 da troca de e-mail de acesso: a tela onde o link cai.
 *
 * O passo 1 é `POST /api/users/me/email-change` (autenticado, exige a senha
 * atual) e monta o link como `{APP_URL}/confirmar-email?token=...`
 * (`router_users.py`). Esta rota existe porque esse link precisava de um lugar
 * onde cair — sem ela o e-mail chegava e o clique dava em 404.
 *
 * A rota é PÚBLICA de propósito, espelhando a `/reset-password`: quem abre o
 * link pode estar noutro navegador, noutro aparelho, ou nem estar logado. A
 * prova não é a sessão, é a posse do token — que só existe na caixa de entrada
 * do endereço novo.
 */

type Estado = 'carregando' | 'sucesso' | 'erro';

const SEGUNDOS_ATE_O_LOGIN = 5;

function ConfirmarEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [estado, setEstado] = useState<Estado>('carregando');
  const [erro, setErro] = useState('');
  const [emailNovo, setEmailNovo] = useState('');
  // 409 não é "link inválido": o endereço foi ocupado por outra conta entre o
  // pedido e o clique. O caminho de saída é outro, e a tela precisa dizer qual.
  const [enderecoOcupado, setEnderecoOcupado] = useState(false);

  // ⚠️ GUARDA CONTRA A SEGUNDA CHAMADA DO STRICT MODE. `reactStrictMode: true`
  // está ligado no `next.config.ts`, e em desenvolvimento o React monta o
  // componente duas vezes — o efeito roda duas vezes. O token é de USO ÚNICO e
  // consumido atomicamente no servidor (`find_one_and_update` com
  // `usado: false`): a primeira chamada devolve 200, a segunda toma
  // "Link inválido ou já utilizado" e sobrescreveria o sucesso com um erro
  // falso. O ref é o que impede a segunda ida ao servidor.
  const jaDisparou = useRef(false);

  useEffect(() => {
    // Sem `?token=` na URL não há o que perguntar ao servidor. Uma requisição
    // com token vazio só gastaria uma vaga do limite (5/min) para receber um
    // 422 do Pydantic (`min_length=1`) e mostrar esta mesma frase.
    if (!token) {
      setErro('Link inválido: o endereço aberto não traz o código de confirmação. Abra o link direto do e-mail, sem copiar só um pedaço.');
      setEstado('erro');
      return;
    }
    if (jaDisparou.current) return;
    jaDisparou.current = true;

    let vivo = true;

    (async () => {
      try {
        // ⚠️ `fetch` PURO, NÃO `apiFetch`. O `apiFetch` anexa o access token e,
        // sem sessão em memória, dispara renovação e o evento
        // `bawzi_session_expired` antes mesmo de a requisição sair — e quem
        // clica neste link pode não ter sessão nenhuma neste navegador. Mesma
        // escolha da `/reset-password`.
        //
        // ⚠️ `credentials: 'include'` NÃO É ENFEITE. A resposta do servidor traz
        // o `delete_cookie` do `bawzi_refresh`; num pedido cross-origin
        // (app.bawzi.com → api.bawzi.com) o navegador ignora o `Set-Cookie` se
        // as credenciais não viajarem. Sem isto o cookie de refresh sobrevive à
        // troca e o próximo `initSession()` ressuscita a sessão velha.
        const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/auth/confirm-email-change`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));
        if (!vivo) return;

        if (!res.ok) {
          if (res.status === 409) {
            setEnderecoOcupado(true);
            setErro(mensagemDeErro(
              data.detail,
              'Este endereço foi registado por outra conta enquanto o link estava pendente. Peça a troca novamente com outro e-mail.',
            ));
          } else {
            // 400 cobre link inválido, já usado, expirado e pedido incompleto —
            // o backend distingue os casos na própria frase, então repassamos a
            // dele em vez de inventar uma genérica por cima.
            setErro(mensagemDeErro(data.detail, 'Não foi possível confirmar o novo e-mail.'));
          }
          setEstado('erro');
          return;
        }

        setEmailNovo(String(data.email || ''));

        // ⚠️ A SESSÃO LOCAL PRECISA MORRER AQUI. O servidor já incrementou o
        // `session_version`, e o `sub` do access token guardado em memória
        // aponta para um e-mail que não existe mais no banco. Deixar isso de pé
        // entrega ao usuário um token morto: a próxima navegação toma 401 sem
        // nenhuma frase que ligue uma coisa à outra — exatamente o sintoma que
        // o fluxo de duas etapas foi criado para eliminar.
        //
        // `clearSession` basta, e `encerrarSessao` seria errado: o cookie de
        // refresh já foi apagado pela própria resposta acima, e chamar
        // `/api/auth/logout` sem sessão válida só somaria uma requisição a
        // falhar. `notifyExpired: false` porque nenhuma tela de app está
        // montada nesta rota pública para ouvir o evento, e o que o usuário
        // precisa ler é "e-mail trocado", não "sessão expirada".
        clearSession({ notifyExpired: false });
        setEstado('sucesso');
      } catch {
        if (!vivo) return;
        setErro('Não conseguimos falar com o servidor. Verifique sua conexão e abra o link de novo — ele continua valendo até expirar.');
        setEstado('erro');
      }
    })();

    return () => { vivo = false; };
  }, [token]);

  // Redirecionamento automático depois do sucesso. O botão existe para quem não
  // quer esperar; o temporizador existe para quem fecharia a aba achando que
  // acabou — e voltaria depois com uma sessão que já não vale.
  useEffect(() => {
    if (estado !== 'sucesso') return;
    const t = setTimeout(() => router.push('/login'), SEGUNDOS_ATE_O_LOGIN * 1000);
    return () => clearTimeout(t);
  }, [estado, router]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-pink-600"></div>

        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-6 transform hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/')}>
              <Image src="/logo-bawzi.png" alt="Bawzi Logo" width={140} height={40} className="object-contain" priority />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Confirmar Novo E-mail</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Estamos validando o link enviado para o seu novo endereço</p>
          </div>

          {estado === 'carregando' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-slate-700 font-semibold">Confirmando o seu e-mail...</p>
              <p className="text-slate-500 text-sm">Não feche esta janela.</p>
            </div>
          )}

          {estado === 'sucesso' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-700 font-semibold">E-mail confirmado com sucesso!</p>
              {emailNovo && (
                <p className="text-slate-500 text-sm">
                  O seu e-mail de acesso agora é{' '}
                  <span className="font-bold text-slate-700 break-all">{emailNovo}</span>.
                </p>
              )}
              <p className="text-slate-500 text-sm">
                Por segurança, as sessões abertas foram encerradas. Entre novamente com o novo endereço e a mesma senha.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 w-full py-4 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
              >
                Ir para o Login
              </button>
              <p className="text-xs text-slate-400">Vamos levar você ao login em instantes...</p>
            </div>
          )}

          {estado === 'erro' && (
            <div className="text-center space-y-4">
              <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 text-center">
                {erro}
              </div>

              {enderecoOcupado ? (
                <p className="text-slate-500 text-sm">
                  O seu e-mail de acesso <strong>não mudou</strong>. Entre na conta, abra o seu perfil e peça a troca
                  outra vez — desta vez com um endereço diferente.
                </p>
              ) : (
                <p className="text-slate-500 text-sm">
                  O seu e-mail de acesso <strong>não mudou</strong>. Entre com o endereço atual e peça a troca outra vez
                  no seu perfil: cada link vale 30 minutos e serve uma vez só.
                </p>
              )}

              <button
                onClick={() => router.push('/login')}
                className="mt-2 w-full py-4 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
              >
                Ir para o Login
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-xs text-slate-400 hover:text-violet-600 font-semibold transition-colors"
            >
              &larr; Voltar ao Login
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-sm font-medium">Carregando...</div>
      </main>
    }>
      <ConfirmarEmailContent />
    </Suspense>
  );
}
