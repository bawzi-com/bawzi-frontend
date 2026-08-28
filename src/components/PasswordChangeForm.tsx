'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { API_URL, apiFetch, SessionExpiredError, clearSession, encerrarSessao, mensagemDeErro } from '@/lib/apiClient';

interface PasswordChangeFormProps {
  token: string;
}

/**
 * Espelho de `_validar_complexidade_senha` (backend/app/api/router_auth.py).
 *
 * ⚠️ O FORMULÁRIO EXIGIA 6 CARACTERES; A ROTA EXIGE 8 + MAIÚSCULA + NÚMERO +
 * ESPECIAL. Com a rota antiga (inexistente) isso nunca aparecia. Ligando na
 * rota certa, "abc123" passaria na validação local, iria à rede e voltaria
 * 400 — ou 422 do Pydantic, que tem `min_length=8` no `new_password`. Repetir
 * a regra aqui é só para dizer o que falta ANTES de gastar a viagem; quem
 * decide continua sendo o backend, e por isso o erro dele ainda é exibido.
 */
function requisitosFaltando(senha: string): string[] {
  const faltando: string[] = [];
  if (senha.length < 8) faltando.push('pelo menos 8 caracteres');
  if (!/[A-Z]/.test(senha)) faltando.push('uma letra maiúscula');
  if (!/[0-9]/.test(senha)) faltando.push('um número');
  if (!/[^A-Za-z0-9]/.test(senha)) faltando.push('um caractere especial (@, #, !, %…)');
  return faltando;
}

export default function PasswordChangeForm({ token }: PasswordChangeFormProps) {

  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validações Básicas
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    const faltando = requisitosFaltando(passwords.newPassword);
    if (faltando.length > 0) {
      setMessage({ type: 'error', text: `A senha deve conter: ${faltando.join(', ')}.` });
      return;
    }

    setIsLoading(true);

    try {
      // ⚠️ ESTE FORMULÁRIO CHAMAVA UMA ROTA QUE NÃO EXISTE.
      // Era `PUT /api/users/update-password`. A string `update-password` não
      // aparece uma única vez no backend: `router_users` expõe `/me`,
      // `/avatar`, `/me/lgpd-consent` e `/me/export`, e nada mais. Toda
      // tentativa de trocar a senha pelo perfil batia num 404 do FastAPI,
      // cujo corpo é `{"detail":"Not Found"}` — o `mensagemDeErro` lia esse
      // `detail`, e o usuário via "Not Found" em inglês, sem pista nenhuma de
      // que a funcionalidade simplesmente não estava ligada em lugar algum.
      //
      // A rota que faz o trabalho sempre existiu e nunca era chamada:
      // `POST /api/auth/change-password`. Método, prefixo e verbo mudaram
      // juntos; só o corpo (`current_password` / `new_password`) já batia.
      const res = await apiFetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // `credentials: 'include'` porque a rota apaga o cookie HttpOnly
        // `bawzi_refresh` no sucesso. Sem enviar o cookie, o `Set-Cookie` de
        // remoção não tem o que remover e o refresh de 30 dias sobrevive à
        // troca de senha — que é exatamente o que ela existe para matar.
        credentials: 'include',
        body: JSON.stringify({
          current_password: passwords.currentPassword,
          new_password: passwords.newPassword,
        }),
      });

      // 429 do slowapi (teto de 5/min na rota) não vem com `detail`, e sim
      // `{"error": "Rate limit exceeded: ..."}` em inglês. Traduzir aqui.
      if (res.status === 429) {
        throw new Error('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
      }

      // Corpo pode não ser JSON (proxy, 502, resposta vazia). `res.json()`
      // cru estouraria com um SyntaxError renderizado como mensagem de erro.
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Erros reais desta rota: 400 (senha atual incorreta OU complexidade
        // insuficiente, com `detail` em texto), 401 (sessão sem e-mail),
        // 404 (usuário sumiu do banco), 422 (Pydantic: `new_password` tem
        // `min_length=8`, e aí o `detail` é uma LISTA — o `mensagemDeErro`
        // já cobre esse formato).
        throw new Error(mensagemDeErro(data.detail, 'Não foi possível atualizar a senha.'));
      }

      // ⚠️ SUCESSO AQUI SIGNIFICA QUE ESTA SESSÃO ACABOU DE MORRER.
      // A rota faz `$inc session_version` e apaga o cookie de refresh: todo
      // access token já emitido para a conta — inclusive o que este navegador
      // tem na memória neste instante — deixa de valer no próximo uso. É
      // proposital: é assim que a troca de senha expulsa uma sessão roubada.
      //
      // Sem deslogar aqui, a tela continuaria mostrando "senha atualizada" e a
      // próxima requisição levaria 401, o `apiFetch` tentaria renovar, o
      // refresh já não existiria, e a pessoa cairia numa tela de "sessão
      // expirada" sem entender por quê. Melhor mandar para o login dizendo o
      // motivo. A própria rota devolve `"Faça login novamente."`.
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Senha alterada. Entre novamente com a nova senha.' });

      // `encerrarSessao`, não `clearSession`: o segundo só limpa a memória do
      // navegador e deixa o cookie de refresh vivo.
      await encerrarSessao({ notifyExpired: false });
      window.setTimeout(() => { window.location.href = '/login'; }, 1800);
      return;   // sem `setIsLoading(false)`: o botão fica travado até o redirect
    } catch (error: any) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: error.message });
      setIsLoading(false);
    }
  };

  const inputStyle = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";
  const labelStyle = "mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      {/* MENSAGEM DE FEEDBACK */}
      {message && (
        <div className={`mb-6 flex items-start gap-3 rounded-lg border p-4 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
        }`}>
          <div className="mt-0.5">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <span className="text-xs font-bold leading-relaxed">{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* SENHA ATUAL */}
        <div className="w-full md:w-1/2 pr-0 md:pr-3">
          <div className="flex justify-between items-center mb-2">
            <label className={labelStyle}>Senha Atual</label>
          <button
            type="button" 
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 transition-colors hover:text-emerald-800"
          >
              {showPasswords ? <><EyeOff size={12} /> Ocultar</> : <><Eye size={12} /> Mostrar</>}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showPasswords ? "text" : "password"} 
              className={inputStyle}
              placeholder="••••••••"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
            />
          </div>
        </div>

        {/* LINHA DE NOVA SENHA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="w-full">
            <label className={labelStyle}>Nova Senha</label>
            <div className="relative">
              <input 
                type={showPasswords ? "text" : "password"} 
                className={inputStyle}
                placeholder="8+ com maiúscula, número e símbolo"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="w-full">
            <label className={labelStyle}>Confirmar Nova Senha</label>
            <div className="relative">
              <input 
                type={showPasswords ? "text" : "password"} 
                className={inputStyle}
                placeholder="Repita a nova senha"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-8 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 md:w-auto"
          >
            {isLoading ? 'Atualizando...' : <><Lock size={14} /> Atualizar senha</>}
          </button>
        </div>
      </div>
    </form>
  );
}
