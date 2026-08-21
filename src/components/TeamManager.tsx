'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, Save, ShieldCheck, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { apiFetch, SessionExpiredError, clearSession } from '@/lib/apiClient';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  is_me: boolean;
  is_owner: boolean;
  is_admin: boolean;
}

interface TeamManagerProps {
  userToken: string;
  tier: number;
  members: TeamMember[];
  is_admin: boolean;
  workspaceName?: string;
  /** Vagas do plano, vindas de `/workspace/details` (`vagas_totais`).
   *
   *  ⚠️ É O NÚMERO QUE O SERVIDOR APLICA. O `/invite` recusa com 402 usando
   *  `settings.WORKSPACE_USER_LIMITS`; se a tela usar outro, ela ou bloqueia
   *  quem podia convidar, ou deixa clicar para receber um erro. O mapa abaixo
   *  virou retaguarda, não fonte. */
  vagasTotais?: number;
  onUpdate: () => void;
}

/** ⚠️ RETAGUARDA, NÃO FONTE DA VERDADE. Estes números estavam cravados aqui e
 *  eram os únicos consultados pela tela, enquanto `/workspace/details` já
 *  devolve `vagas_totais` e o `/invite` recusa por
 *  `settings.WORKSPACE_USER_LIMITS`. É o mesmo defeito que já custou "1.000
 *  análises/mês" num plano de 90 créditos e "R$ 497/mês" numa assinatura
 *  anual: número de produto escrito em dois lugares diverge no primeiro
 *  ajuste. Só é usado se a API não responder. */
const WORKSPACE_LIMITS: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 10
};

export default function TeamManager({ userToken, tier, members = [], is_admin, workspaceName = 'Meu Workspace', vagasTotais, onUpdate }: TeamManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState(workspaceName);
  const [loading, setLoading] = useState(false);
  const [savingWorkspaceName, setSavingWorkspaceName] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  // Link de convite: o caminho que funciona para quem AINDA NÃO tem conta.
  const [convite, setConvite] = useState<{ link: string; expira_em: string; usos: number } | null>(null);
  const [convitePronto, setConvitePronto] = useState(false);   // já consultamos o servidor
  const [conviteOcupado, setConviteOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const maxUsers = vagasTotais ?? WORKSPACE_LIMITS[tier] ?? 1;
  const currentUsers = members.length;
  const lotado = currentUsers >= maxUsers;
  const vagasLivres = Math.max(0, maxUsers - currentUsers);
  const corDaOcupacao = lotado ? 'text-red-600' : vagasLivres === 1 ? 'text-amber-600' : 'text-slate-900';
  const trimmedWorkspaceName = workspaceNameDraft.trim();
  const workspaceNameChanged = trimmedWorkspaceName !== workspaceName.trim();

  useEffect(() => {
    setWorkspaceNameDraft(workspaceName);
  }, [workspaceName]);

  // Só admin gerencia convite; para os demais o bloco nem aparece.
  useEffect(() => {
    if (!is_admin) { setConvitePronto(true); return; }
    apiFetch(`${API_URL}/api/workspace/convite-link`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ativo) setConvite({ link: d.link, expira_em: d.expira_em, usos: d.usos }); })
      .catch(() => { /* sem link ativo é estado normal, não erro */ })
      .finally(() => setConvitePronto(true));
  }, [is_admin, API_URL]);

  const gerarConvite = async () => {
    setConviteOcupado(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/convite-link`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showNotice('error', data.detail || 'Não foi possível gerar o link.'); return; }
      setConvite({ link: data.link, expira_em: data.expira_em, usos: data.usos ?? 0 });
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    } finally {
      setConviteOcupado(false);
    }
  };

  const revogarConvite = async () => {
    setConviteOcupado(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/convite-link`, { method: 'DELETE' });
      if (!res.ok) { showNotice('error', 'Não foi possível desligar o link.'); return; }
      setConvite(null);
      showNotice('success', 'Link desligado. Quem já entrou continua no workspace.');
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    } finally {
      setConviteOcupado(false);
    }
  };

  /** ⚠️ `navigator.clipboard` NÃO EXISTE EM TODO LUGAR: exige contexto seguro
   *  (https ou localhost) e alguns navegadores móveis o negam. Sem retaguarda,
   *  o botão de copiar não faria nada e não diria nada — o pior resultado
   *  possível para o único botão que a pessoa veio usar. */
  const copiarLink = async () => {
    if (!convite) return;
    try {
      await navigator.clipboard.writeText(convite.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      showNotice('error', 'Não foi possível copiar. Selecione o link e copie à mão.');
    }
  };

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSaveWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceNameChanged || savingWorkspaceName) return;

    if (trimmedWorkspaceName.length < 3) {
      showNotice('error', 'Informe um nome com pelo menos 3 caracteres.');
      return;
    }

    setSavingWorkspaceName(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedWorkspaceName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showNotice('success', data.message || 'Workspace atualizado com sucesso.');
        setWorkspaceNameDraft(data.workspace_name || trimmedWorkspaceName);
        onUpdate();
      } else {
        showNotice('error', data.detail || 'Erro ao atualizar workspace.');
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    } finally {
      setSavingWorkspaceName(false);
    }
  };

  // ==========================================
  // ADICIONAR NOVO MEMBRO
  // ==========================================
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        // ⚠️ SUCESSO SILENCIOSO ERA O PIOR ESTADO DESTA TELA. O modal fechava
        // e nada mais acontecia: o `notice` só era usado para erro. Quem
        // clicava não sabia se tinha funcionado — e o membro nem sempre
        // aparece na lista no mesmo instante.
        showNotice('success', data.message || `${newEmail} agora faz parte do workspace.`);
        setNewEmail('');
        onUpdate();
      } else {
        showNotice('error', data.detail || 'Erro ao adicionar colaborador.');
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // REMOVER MEMBRO
  // ==========================================
  const handleRemoveUser = async (email: string) => {
    if (!confirm(`Tem certeza que deseja remover ${email} do workspace?`)) return;
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) onUpdate();
      else showNotice('error', 'Erro ao remover usuário.');
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    }
  };

  // ==========================================
  // PROMOVER/DESPROMOVER ADMIN
  // ==========================================
  const handleToggleAdmin = async (email: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        onUpdate();
      } else {
        const data = await res.json();
        showNotice('error', data.detail || 'Erro ao alterar privilégios.');
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      showNotice('error', 'Erro de ligação ao servidor.');
    }
  };

  return (
    <div className="relative">
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[200] max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {notice.msg}
        </div>
      )}
      
      {/* CONFIGURAÇÕES DO WORKSPACE */}
      <form onSubmit={handleSaveWorkspaceName} className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
              <UsersRound size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="workspace-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nome do workspace
              </label>
              {is_admin ? (
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceNameDraft}
                  onChange={(e) => setWorkspaceNameDraft(e.target.value)}
                  maxLength={80}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Ex: Equipe Bawzi Licitações"
                />
              ) : (
                <p className="mt-2 truncate text-lg font-black text-slate-950">{workspaceName}</p>
              )}
              <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                Esse nome identifica o ambiente compartilhado para membros, análises e empresas monitoradas.
              </p>
            </div>
          </div>

          {is_admin && (
            <button
              type="submit"
              disabled={!workspaceNameChanged || savingWorkspaceName}
              /* ⚠️ `self-start`: abaixo de `sm` o botão é filho de um
                 `flex-col`, e `align-items: stretch` o esticava de ponta a
                 ponta — uma barra cinza gigante para uma ação secundária que,
                 na maior parte do tempo, está desabilitada. */
              className="inline-flex h-10 shrink-0 self-start items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:self-auto"
            >
              <Save size={14} />
              {savingWorkspaceName ? 'Salvando...' : 'Salvar nome'}
            </button>
          )}
        </div>
      </form>

      {/* HEADER DA SECÇÃO
          ⚠️ AS VAGAS VIRARAM MEDIDOR. "1/10 vagas utilizadas" no meio de uma
          frase é um número que se lê e não se sente — e vaga é cota, igual à de
          créditos, que esta mesma tela já mostra em barra. A barra responde de
          relance a única pergunta que importa aqui ("dá para chamar mais
          alguém?") e fica âmbar quando falta uma, vermelha quando lota. */}
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900">Membros do workspace</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Quem entra aqui vê as análises, as empresas e o histórico do workspace.
          </p>
        </div>

        {is_admin && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={lotado}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-slate-950 px-3.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:-translate-y-px hover:bg-emerald-700 hover:shadow disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <UserPlus size={13} />
            {lotado ? 'Sem vagas' : 'Convidar membro'}
          </button>
        )}
      </div>

      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold text-slate-500">
            <span className={`text-sm font-black ${corDaOcupacao}`}>{currentUsers}</span>
            <span className="text-slate-400"> de {maxUsers} {maxUsers === 1 ? 'vaga' : 'vagas'}</span>
          </p>
          {vagasLivres > 0 ? (
            <p className="text-[10px] font-bold text-slate-400">
              {vagasLivres} {vagasLivres === 1 ? 'livre' : 'livres'}
            </p>
          ) : (
            /* Sem vaga, o caminho é o plano — dizer só "limite atingido"
               deixa a pessoa sem próximo passo. */
            <p className="text-[10px] font-bold text-amber-600">
              Limite do plano — suba de plano para abrir mais vagas
            </p>
          )}
        </div>
        <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${lotado ? 'bg-red-500' : vagasLivres === 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, (currentUsers / Math.max(1, maxUsers)) * 100)}%` }}
          />
        </div>
      </div>

      {/* ── LINK DE CONVITE ────────────────────────────────────────────────
          ⚠️ ESTE É O CAMINHO QUE FUNCIONA PARA QUEM AINDA NÃO TEM CONTA. O
          botão "Convidar membro" ao lado só aceita e-mail de quem já é
          cadastrado — para todo o resto ele devolve "usuário não encontrado" e
          a conversa morre. O link não depende disso, nem de o nosso e-mail
          estar entregando: vai por WhatsApp, Slack, chamado, onde a pessoa
          estiver.
          E é ele que torna a palavra "convite" verdadeira: quem decide entrar
          é quem clica. */}
      {is_admin && convitePronto && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Link2 size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900">Link de convite</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  Quem abrir o link entra no workspace — inclusive quem ainda não tem conta na
                  Bawzi, criando a dela na hora. Ocupa uma vaga por pessoa.
                </p>
              </div>
            </div>
            {!convite && (
              <button
                type="button"
                onClick={gerarConvite}
                disabled={conviteOcupado || lotado}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[11px] font-black text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Link2 size={12} />
                {conviteOcupado ? 'Gerando...' : lotado ? 'Sem vagas' : 'Gerar link'}
              </button>
            )}
          </div>

          {convite && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* ⚠️ `readOnly` NUM INPUT, e não um `<p>`: dá seleção com um
                    toque, teclado e leitura por leitor de tela — e é a
                    retaguarda de copiar à mão quando a área de transferência
                    não está disponível. */}
                <input
                  readOnly
                  value={convite.link}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Link de convite do workspace"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] text-slate-600 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={copiarLink}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition ${
                    copiado
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-white hover:bg-slate-800'
                  }`}
                >
                  {copiado ? <Check size={12} /> : <Copy size={12} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={revogarConvite}
                  disabled={conviteOcupado}
                  aria-label="Desligar o link de convite"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={12} />
                  Desligar
                </button>
              </div>
              <p className="mt-2 text-[10px] font-medium text-slate-400">
                Vale até {new Date(convite.expira_em).toLocaleDateString('pt-BR')}
                {convite.usos > 0 && <> · {convite.usos} {convite.usos === 1 ? 'pessoa entrou' : 'pessoas entraram'} por ele</>}
                {' · '}quem já entrou continua no workspace mesmo depois de desligar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* LISTA DE MEMBROS */}
      {members.length === 0 && (
        /* ⚠️ NÃO EXISTIA ESTADO VAZIO. Com a lista vazia a secção terminava no
           medidor, sem nada — e "nada" tanto pode ser "você está sozinho" como
           "não carregou". */
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
          <p className="text-sm font-bold text-slate-500">Nenhum membro para mostrar.</p>
          <p className="mt-1 text-xs text-slate-400">
            Se você acabou de entrar, recarregue a página.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30">

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-tr from-emerald-600 to-sky-600 text-sm font-black text-white shadow-sm">
                {member.avatar_url ? (
                  <img src={`${API_URL}${member.avatar_url}`} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  member.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-slate-900">{member.name}</span>
                  {/* "Você" separado do nome: colado, virava parte dele. */}
                  {member.is_me && (
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">você</span>
                  )}
                  
                  {/* 🟢 TAG: PROPRIETÁRIO */}
                  {member.is_owner && (
                    <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                      Proprietário
                    </span>
                  )}

                  {/* 🟢 TAG: ADMIN */}
                  {member.is_admin && !member.is_owner && (
                    <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                      Admin
                    </span>
                  )}

                  {/* 🟢 TAG: MEMBRO (Se não for nenhum dos acima) */}
                  {!member.is_admin && !member.is_owner && (
                    <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Membro
                    </span>
                  )}
                </div>
                <span className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{member.email}</span>
              </div>
            </div>

            {/* AÇÕES (Só visíveis para admins) */}
            {/* ⚠️ AS AÇÕES ERAM `sm:opacity-0 sm:group-hover:opacity-100` — ou
                seja, INVISÍVEIS de 640px para cima até alguém passar o mouse.
                Num tablet, que é ≥640 e não tem hover, promover e remover
                simplesmente não existiam: o admin não tinha como descobrir que
                a função estava ali. Esconder controle atrás de hover só funciona
                onde hover existe, e o breakpoint não sabe disso.
                Agora ficam sempre visíveis, discretos, e ganham realce no
                hover — que é o papel do hover: reforçar, não revelar. */}
            {is_admin && !member.is_owner && !member.is_me && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleToggleAdmin(member.email)}
                  aria-label={member.is_admin
                    ? `Remover privilégios de admin de ${member.name}`
                    : `Tornar ${member.name} admin do workspace`}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700"
                >
                  <ShieldCheck size={12} />
                  {member.is_admin ? 'Despromover' : 'Promover'}
                </button>
                <button
                  onClick={() => handleRemoveUser(member.email)}
                  aria-label={`Remover ${member.name} do workspace`}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-red-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={12} />
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL DE ADICIONAR UTILIZADOR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-lg border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="mb-2 text-lg font-black text-slate-900">Adicionar ao workspace</h3>
            {/* ⚠️ O TEXTO DIZIA "dar acesso à plataforma", QUE NÃO É O QUE
                ACONTECE. `/workspace/invite` não manda convite para aceitar: ele
                move na hora a conta indicada para este workspace — e, com isso,
                tira a pessoa do workspace em que ela estava. Chamar isso de
                "convite" faz o admin achar que existe um passo de aceite do
                outro lado, e que nada muda até lá. Muda tudo, no clique. */}
            <p className="mb-5 text-xs font-medium leading-5 text-slate-500">
              A pessoa precisa <strong className="text-slate-700">já ter conta na Bawzi</strong>. Ela entra
              na hora, sem precisar aceitar — e <strong className="text-slate-700">sai do workspace em que
              estiver</strong> hoje.
            </p>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-900">E-mail de quem já tem conta</label>
                <input 
                  type="email" 
                  placeholder="exemplo@empresa.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 rounded-lg py-3 text-[10px] font-black uppercase text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !newEmail}
                  className="flex-1 rounded-lg bg-slate-950 py-3 text-[10px] font-black uppercase text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
