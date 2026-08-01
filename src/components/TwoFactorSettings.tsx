'use client';

/**
 * TwoFactorSettings — gestão da autenticação em 2 fatores (TOTP) no perfil.
 *
 * Fluxo de ativação: gerar QR → escanear no app autenticador → confirmar o
 * primeiro código → guardar os códigos de backup (exibidos UMA única vez).
 * Desativação exige senha + código (TOTP ou backup).
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, QrCode, KeyRound, Smartphone } from 'lucide-react';
import { API_URL, apiFetch, SessionExpiredError, clearSession } from '@/lib/apiClient';

type Etapa = 'idle' | 'qr' | 'backup';

/** Quebra o segredo em grupos de 4 para leitura e digitação manual.
 *  "2XELYSG64TXEQMKT" numa linha só é uma parede de caracteres: quem digita à
 *  mão perde a posição e erra. Em blocos, o olho reencontra onde parou. */
const emGrupos = (s: string, tam = 4) => (s.match(new RegExp(`.{1,${tam}}`, 'g')) || []).join(' ');

export default function TwoFactorSettings() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [backupRestantes, setBackupRestantes] = useState(0);
  const [etapa, setEtapa] = useState<Etapa>('idle');
  const [qrBase64, setQrBase64] = useState('');
  const [segredoManual, setSegredoManual] = useState('');
  const [codigo, setCodigo] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [senhaDisable, setSenhaDisable] = useState('');
  const [codigoDisable, setCodigoDisable] = useState('');
  const [mostrarDisable, setMostrarDisable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [segredoCopiado, setSegredoCopiado] = useState(false);

  // Estado inicial
  useEffect(() => {
    apiFetch(`${API_URL}/api/auth/2fa/status`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) { setAtivo(!!d.ativo); setBackupRestantes(d.backup_codes_restantes ?? 0); }
        else setAtivo(false);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) { clearSession(); return; }
        setAtivo(false);
      });
  }, []);

  const iniciarSetup = async () => {
    setLoading(true); setErro('');
    try {
      const r = await apiFetch(`${API_URL}/api/auth/2fa/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Falha ao gerar o QR.');
      setQrBase64(d.qr_png_base64); setSegredoManual(d.segredo_manual); setCodigo('');
      setEtapa('qr');
    } catch (e) {
      if (e instanceof SessionExpiredError) { clearSession(); return; }
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    }
    finally { setLoading(false); }
  };

  const confirmarAtivacao = async () => {
    setLoading(true); setErro('');
    try {
      const r = await apiFetch(`${API_URL}/api/auth/2fa/activate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codigo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Código inválido.');
      setBackupCodes(d.backup_codes || []);
      setAtivo(true); setBackupRestantes((d.backup_codes || []).length);
      setEtapa('backup');
    } catch (e) {
      if (e instanceof SessionExpiredError) { clearSession(); return; }
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    }
    finally { setLoading(false); }
  };

  const desativar = async () => {
    setLoading(true); setErro('');
    try {
      const r = await apiFetch(`${API_URL}/api/auth/2fa/disable`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: senhaDisable, code: codigoDisable }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Falha ao desativar.');
      setAtivo(false); setMostrarDisable(false); setSenhaDisable(''); setCodigoDisable('');
      setEtapa('idle');
    } catch (e) {
      if (e instanceof SessionExpiredError) { clearSession(); return; }
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    }
    finally { setLoading(false); }
  };

  const copiarBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  const copiarSegredo = async () => {
    try {
      // Copia SEM os espaços dos grupos — o app autenticador rejeita o segredo
      // formatado. O agrupamento é só para o olho humano.
      await navigator.clipboard.writeText(segredoManual);
      setSegredoCopiado(true); setTimeout(() => setSegredoCopiado(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  if (ativo === null) {
    return <div className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando 2FA…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Status — quando inativo, usa tom âmbar de alerta para chamar atenção
          para a lacuna de segurança (antes era um cinza neutro, fácil de
          ignorar/confundir com um item "ok"). */}
      <div className={`relative flex items-center justify-between rounded-xl border-2 px-4 py-3.5 ${ativo ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50 shadow-sm shadow-amber-100'}`}>
        <div className="flex items-center gap-3">
          <span className="relative flex shrink-0">
            {ativo
              ? <ShieldCheck size={24} className="text-emerald-600" />
              : <ShieldOff size={24} className="text-amber-600" />}
            {!ativo && (
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            )}
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-slate-800">
              Autenticação em 2 fatores (TOTP)
              {!ativo && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Recomendado
                </span>
              )}
            </p>
            <p className={`text-xs font-medium ${ativo ? 'text-slate-500' : 'text-amber-800'}`}>
              {ativo
                ? `Ativa · ${backupRestantes} código(s) de backup restante(s)`
                : 'Inativa — proteja sua conta com um app autenticador (Google Authenticator, Authy…)'}
            </p>
          </div>
        </div>
        {ativo ? (
          <button onClick={() => { setMostrarDisable(!mostrarDisable); setErro(''); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 hover:bg-red-50 transition-colors">
            Desativar
          </button>
        ) : etapa === 'idle' && (
          <button onClick={iniciarSetup} disabled={loading} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {loading ? 'Gerando…' : 'Ativar agora'}
          </button>
        )}
      </div>

      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{erro}</p>}

      {/* Etapa: escanear QR + confirmar primeiro código.
          A versão anterior espremia as duas etapas numa linha de texto de 12px
          ("1. Escaneie … · 2. Digite …") e jogava o segredo manual — 32
          caracteres sem separação e sem botão de copiar — dentro de um
          parágrafo cinza. Aqui cada passo tem número, ícone e área própria, e
          o segredo virou um bloco copiável. */}
      {!ativo && etapa === 'qr' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Smartphone size={13} /> Configurar aplicativo autenticador
            </p>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-[auto,1fr]">
            {/* ── Passo 1: QR ── */}
            <div className="flex flex-col items-center gap-3">
              <span className="flex items-center gap-2 self-start text-[11px] font-black text-slate-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">1</span>
                Escaneie o código
              </span>
              {qrBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code para configurar a autenticação em 2 fatores"
                  className="h-44 w-44 rounded-xl border-4 border-white bg-white shadow-md ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-300">
                  <QrCode size={32} />
                </div>
              )}
              <p className="max-w-[11rem] text-center text-[10px] font-medium leading-snug text-slate-400">
                Google Authenticator, Authy, 1Password ou similar
              </p>
            </div>

            {/* ── Passo 2: código ── */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <span className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">2</span>
                  Digite o código de 6 dígitos que o app mostrar
                </span>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={codigo}
                  // Só dígitos, no máximo 6. Antes aceitava qualquer caractere:
                  // colar "123 456" do app deixava o botão travado sem explicar.
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-2xl font-black tracking-[0.4em] text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-emerald-400 focus:bg-white"
                />
                <p className="text-[10px] font-medium text-slate-400">
                  O código muda a cada 30 segundos — se expirar, use o próximo.
                </p>
              </div>

              {/* Segredo manual — bloco próprio, agrupado e copiável */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <KeyRound size={11} /> Sem câmera? Use a chave
                  </span>
                  <button
                    type="button" onClick={copiarSegredo}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    {segredoCopiado ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    {segredoCopiado ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
                <code className="block break-all font-mono text-[11px] font-bold leading-relaxed tracking-wide text-slate-700">
                  {emGrupos(segredoManual)}
                </code>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={confirmarAtivacao}
                  disabled={loading || codigo.length < 6}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Confirmando…</> : <><ShieldCheck size={14} /> Confirmar e ativar</>}
                </button>
                <button
                  onClick={() => setEtapa('idle')}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Etapa: códigos de backup (exibidos UMA vez) */}
      {etapa === 'backup' && backupCodes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">⚠️ Guarde seus códigos de backup agora</p>
          <p className="mt-1 text-xs font-medium text-amber-800/80">
            Cada um funciona UMA única vez se você perder o celular. Eles não serão exibidos novamente.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {backupCodes.map(c => (
              <code key={c} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-center font-mono text-xs font-bold text-slate-700">{c}</code>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={copiarBackup} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100 transition-colors">
              {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado!' : 'Copiar todos'}
            </button>
            <button onClick={() => setEtapa('idle')} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 transition-colors">
              Já guardei — concluir
            </button>
          </div>
        </div>
      )}

      {/* Desativação: senha + código */}
      {ativo && mostrarDisable && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <p className="mb-3 text-xs font-bold text-red-800">Para desativar, confirme sua senha e um código válido (app ou backup):</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="password" value={senhaDisable} onChange={e => setSenhaDisable(e.target.value)} placeholder="Senha" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-red-300" />
            <input type="text" value={codigoDisable} onChange={e => setCodigoDisable(e.target.value)} placeholder="Código (000000 ou XXXX-XXXX)" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-red-300" />
          </div>
          <button onClick={desativar} disabled={loading || !senhaDisable || !codigoDisable} className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? 'Desativando…' : 'Desativar 2FA'}
          </button>
        </div>
      )}
    </div>
  );
}
