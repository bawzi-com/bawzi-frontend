'use client';

/**
 * TwoFactorSettings — gestão da autenticação em 2 fatores (TOTP) no perfil.
 *
 * Fluxo de ativação: gerar QR → escanear no app autenticador → confirmar o
 * primeiro código → guardar os códigos de backup (exibidos UMA única vez).
 * Desativação exige senha + código (TOTP ou backup).
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { API_URL, apiFetch, SessionExpiredError, clearSession } from '@/lib/apiClient';

type Etapa = 'idle' | 'qr' | 'backup';

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

  if (ativo === null) {
    return <div className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando 2FA…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${ativo ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          {ativo
            ? <ShieldCheck size={20} className="text-emerald-600" />
            : <ShieldOff size={20} className="text-slate-400" />}
          <div>
            <p className="text-sm font-black text-slate-800">Autenticação em 2 fatores (TOTP)</p>
            <p className="text-xs font-medium text-slate-500">
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
          <button onClick={iniciarSetup} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {loading ? 'Gerando…' : 'Ativar'}
          </button>
        )}
      </div>

      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{erro}</p>}

      {/* Etapa: escanear QR + confirmar primeiro código */}
      {!ativo && etapa === 'qr' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-bold text-slate-600">
            1. Escaneie o QR no app autenticador &nbsp;·&nbsp; 2. Digite o código de 6 dígitos para confirmar
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {qrBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code 2FA" className="h-40 w-40 rounded-lg border border-slate-200" />
            )}
            <div className="flex-1 space-y-3">
              <p className="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
                Sem câmera? Digite manualmente: <strong className="text-slate-700">{segredoManual}</strong>
              </p>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code"
                value={codigo} onChange={e => setCodigo(e.target.value)}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-400"
              />
              <div className="flex gap-2">
                <button onClick={confirmarAtivacao} disabled={loading || codigo.trim().length < 6} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Confirmando…' : 'Confirmar e ativar'}
                </button>
                <button onClick={() => setEtapa('idle')} className="rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
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
