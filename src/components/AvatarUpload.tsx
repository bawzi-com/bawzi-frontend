'use client';

/**
 * A foto do perfil: escolher, ver antes de enviar, e remover.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A ROTA JÁ EXISTIA E NÃO TINHA PORTA
 * ═══════════════════════════════════════════════════════════════════════════
 * `POST /api/users/avatar` estava no backend desde sempre, e `avatar_url` já
 * era lido na lista de membros da equipe — mas não havia UM lugar no app para
 * enviar a imagem. O campo existia, o endpoint existia, e todo mundo continuava
 * sendo uma inicial colorida.
 *
 * ⚠️ POR QUE PRÉ-VISUALIZAR ANTES DE ENVIAR. O servidor recorta o QUADRADO
 * CENTRAL e reduz para 256px. Numa foto na horizontal isso corta as laterais —
 * quem escolheu uma foto de corpo inteiro precisa ver o enquadramento antes de
 * ela virar o seu rosto público na equipe. A prévia usa `object-cover` num
 * círculo do mesmo tamanho, que é geometricamente o mesmo recorte central do
 * backend: o que aparece aqui é o que fica gravado.
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, SessionExpiredError, clearSession, API_URL } from '@/lib/apiClient';

/** Espelha `_AVATAR_MAX_BYTES` do backend.
 *
 *  ⚠️ VALIDAR AQUI TAMBÉM NÃO É REDUNDÂNCIA ÚTIL POR SEGURANÇA — o servidor é
 *  quem decide — mas evita subir 5 MB por uma conexão de celular para receber
 *  413 no fim. O erro chega antes do upload, não depois. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Avisa o resto do app (o cabeçalho, sobretudo) que a foto mudou.
 *
 *  ⚠️ SEM ISTO A TROCA PARECE NÃO TER FUNCIONADO. O `Header` é montado no
 *  layout e só busca `/users/me` quando o `pathname` muda: quem troca a foto
 *  no perfil continuaria vendo a inicial colorida no canto — mesma tela, dois
 *  avatares diferentes — até navegar para outra página. Passa `null` para
 *  remoção, que é informação diferente de "não mencionei a foto". */
function avisarAvatar(url: string | null) {
  try {
    if (url) localStorage.setItem('user_avatar', url);
    else localStorage.removeItem('user_avatar');
  } catch { /* modo privado/quota: o evento abaixo ainda resolve a sessão */ }
  window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { avatar_url: url } }));
}

interface Props {
  nome?: string;
  avatarUrl?: string | null;
  /** Chamado depois de enviar ou remover, para a tela recarregar os dados. */
  onUpdate?: () => void | Promise<void>;
}

export default function AvatarUpload({ nome, avatarUrl, onUpdate }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const inicial = (nome || 'B').charAt(0).toUpperCase();
  // `avatar_url` vem com `?v=` do servidor — é o que faz a troca aparecer em
  // vez de o navegador continuar mostrando a foto antiga do cache.
  const atual = avatarUrl ? `${API_URL}${avatarUrl}` : null;

  // Object URLs vazam se não forem revogados; um por escolha de arquivo.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const escolher = (f: File | null) => {
    setErro('');
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (f.size > MAX_BYTES) {
      setErro(`A imagem tem ${(f.size / 1024 / 1024).toFixed(1)} MB. O limite é 5 MB.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setArquivo(f);
  };

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true); setErro('');
    try {
      const form = new FormData();
      form.append('file', arquivo);
      // ⚠️ SEM `Content-Type` À MÃO. O navegador precisa montar o
      // `multipart/form-data` com o `boundary`; declarar o cabeçalho aqui
      // quebra o parse no servidor com um erro que não diz o motivo.
      const r = await apiFetch(`${API_URL}/api/users/avatar`, { method: 'POST', body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || 'Não foi possível enviar a imagem.');
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null); setArquivo(null);
      if (inputRef.current) inputRef.current.value = '';
      if (d.avatar_url) avisarAvatar(d.avatar_url);
      await onUpdate?.();
    } catch (e) {
      if (e instanceof SessionExpiredError) { clearSession(); return; }
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setEnviando(false);
    }
  };

  const remover = async () => {
    setEnviando(true); setErro('');
    try {
      const r = await apiFetch(`${API_URL}/api/users/avatar`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Não foi possível remover a foto.');
      avisarAvatar(null);
      await onUpdate?.();
    } catch (e) {
      if (e instanceof SessionExpiredError) { clearSession(); return; }
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setEnviando(false);
    }
  };

  const mostrando = preview || atual;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* ⚠️ O CÍRCULO É O MESMO DO CABEÇALHO — mesmo gradiente, mesma inicial.
          Se a prévia aqui fosse um quadrado ou outra cor, a pessoa não saberia
          o que está configurando até sair da tela e olhar o menu. */}
      <div className="relative shrink-0 self-start">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-emerald-600 to-sky-600 text-2xl font-black text-white shadow-md">
          {mostrando
            ? <img src={mostrando} alt="" className="h-full w-full object-cover" />
            : inicial}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Escolher foto de perfil"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition-colors hover:bg-emerald-700"
        >
          <Camera size={14} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-900">Foto de perfil</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          Aparece para o seu time na Equipe e no menu da conta. JPG, PNG ou WebP, até 5 MB —
          {/* Dizer o recorte ANTES evita a surpresa de ver o rosto cortado. */}
          {' '}usamos o quadrado central da imagem.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        />

        {erro && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {arquivo ? (
            <>
              <button
                type="button" onClick={enviar} disabled={enviando}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[11px] font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {enviando ? 'Enviando…' : 'Usar esta foto'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null); setArquivo(null); setErro('');
                  if (inputRef.current) inputRef.current.value = '';
                }}
                disabled={enviando}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={13} />
                Descartar
              </button>
            </>
          ) : (
            <>
              <button
                type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[11px] font-black text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
              >
                <Camera size={13} />
                {atual ? 'Trocar foto' : 'Escolher foto'}
              </button>
              {/* Só aparece quando há o que remover — botão que não faz nada
                  ensina a ignorar botões. */}
              {atual && (
                <button
                  type="button" onClick={remover} disabled={enviando}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-60"
                >
                  {enviando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Remover
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
