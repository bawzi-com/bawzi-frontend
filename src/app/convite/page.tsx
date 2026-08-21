'use client';

/**
 * A ponta que recebe o link de convite de um workspace.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTA PÁGINA EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * O `/workspace/invite` do backend não convida: move a conta indicada para o
 * workspace na hora, sem aceite — e só funciona para quem já tem cadastro.
 * Quem ainda não tem conta recebia "usuário não encontrado" e acabava ali.
 *
 * Aqui a direção se inverte: quem decide entrar é quem clica. É o que torna a
 * palavra "convite" verdadeira, e é o único caminho que atende quem ainda não
 * é cliente — ela cria a conta e volta para este mesmo link.
 *
 * ⚠️ E A TELA AVISA O QUE ENTRAR CUSTA. Entrar num workspace TIRA a pessoa do
 * workspace em que ela está — inclusive do dela própria, com as empresas e o
 * histórico. Nada é apagado, mas some da vista, e descobrir isso depois de
 * clicar seria a mesma armadilha que esta página veio consertar.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, UsersRound } from 'lucide-react';
import { apiFetch, getAuthToken } from '@/lib/apiClient';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

type Estado = 'carregando' | 'pronto' | 'entrou' | 'ja_era' | 'erro';

function ConviteConteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [estado, setEstado] = useState<Estado>('carregando');
  const [nome, setNome] = useState('');
  const [vagas, setVagas] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);
  const logado = !!getAuthToken();

  useEffect(() => {
    if (!token) { setEstado('erro'); setErro('Link inválido.'); return; }
    // Rota pública de propósito: a pessoa precisa saber PARA ONDE o link leva
    // antes de criar conta. Exigir login para só então revelar o destino faria
    // ela se cadastrar às cegas.
    fetch(`${API_URL}/api/workspace/convite/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setEstado('erro'); setErro(d.detail || 'Convite inválido ou expirado.'); return; }
        setNome(d.workspace_nome || 'Workspace');
        setVagas(typeof d.vagas_livres === 'number' ? d.vagas_livres : null);
        setEstado('pronto');
      })
      .catch(() => { setEstado('erro'); setErro('Não foi possível verificar o convite.'); });
  }, [token]);

  const entrar = async () => {
    setEntrando(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/convite/${encodeURIComponent(token)}/aceitar`,
        { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setEstado('erro'); setErro(d.detail || 'Não foi possível entrar.'); return; }
      setEstado(d.ja_era_membro ? 'ja_era' : 'entrou');
      setTimeout(() => router.push('/workspace'), 1800);
    } catch {
      setEstado('erro');
      setErro('Erro de ligação ao servidor.');
    } finally {
      setEntrando(false);
    }
  };

  // O link de volta para CÁ depois do login/cadastro — sem ele a pessoa
  // autentica e cai na home, sem nunca entrar no workspace que a chamou.
  const voltarPraCa = `/convite?token=${encodeURIComponent(token)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        {estado === 'carregando' && (
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm font-bold">Verificando o convite...</span>
          </div>
        )}

        {estado === 'erro' && (
          <>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-900">Convite indisponível</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{erro}</p>
            <p className="mt-1.5 text-xs text-slate-400">
              Links de convite valem por 7 dias e podem ser desligados por quem os criou.
              Peça um novo a quem te chamou.
            </p>
            <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-emerald-700 hover:text-emerald-800">
              Ir para a Bawzi <ArrowRight size={14} />
            </Link>
          </>
        )}

        {(estado === 'entrou' || estado === 'ja_era') && (
          <>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-900">
              {estado === 'ja_era' ? `Você já está em ${nome}` : `Bem-vindo a ${nome}`}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">Levando você para o workspace...</p>
          </>
        )}

        {estado === 'pronto' && (
          <>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UsersRound size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Convite para equipe</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">{nome}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entrando, você passa a ver as análises, as empresas monitoradas e o histórico deste
              workspace.
            </p>

            {/* ⚠️ O CUSTO VEM ANTES DO BOTÃO, não depois do clique. */}
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
              Você sai do workspace em que está hoje. Nada é apagado — as empresas e o histórico de
              lá continuam existindo —, mas deixam de aparecer para você enquanto estiver aqui.
            </p>

            {vagas === 0 && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-800">
                Este workspace está sem vagas no plano dele. Peça a quem te convidou para liberar
                uma vaga ou subir de plano.
              </p>
            )}

            {logado ? (
              <button
                type="button"
                onClick={entrar}
                disabled={entrando || vagas === 0}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {entrando ? 'Entrando...' : `Entrar em ${nome}`}
              </button>
            ) : (
              <>
                {/* Sem conta é o caso NORMAL aqui, não a exceção: é justamente
                    para ele que o link existe. Por isso "criar conta" vem
                    primeiro, e os dois caminhos voltam para esta página. */}
                <Link
                  href={`/login?redirect=${encodeURIComponent(voltarPraCa)}&cadastro=1`}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700"
                >
                  Criar conta e entrar
                </Link>
                <Link
                  href={`/login?redirect=${encodeURIComponent(voltarPraCa)}`}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Já tenho conta
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={null}>
      <ConviteConteudo />
    </Suspense>
  );
}
