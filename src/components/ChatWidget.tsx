'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { apiFetch, API_URL, getAccessToken, initSession, SessionExpiredError } from '@/lib/apiClient';
import AuthModal from './AuthModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cta?: boolean; // mensagem com botão de login
  // Mensagem gerada pela própria UI (saudação inicial, convite de login) —
  // não é uma troca real da conversa, então não deve virar "histórico"
  // enviado ao modelo (poluiria o contexto com texto de marketing).
  uiOnly?: boolean;
}

/** Renderiza markdown básico: **negrito**, listas com -, quebras de linha */
function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <span className="block space-y-1">
      {lines.map((line, i) => {
        if (line.trim() === '') return <span key={i} className="block h-1" />;
        const isBullet = /^[-•]\s/.test(line.trim());
        const content = isBullet ? line.trim().slice(2) : line;
        const parts = content.split(/\*\*(.+?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
        );
        if (isBullet) {
          return (
            <span key={i} className="flex gap-1.5 items-start">
              <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
              <span>{rendered}</span>
            </span>
          );
        }
        return <span key={i} className="block">{rendered}</span>;
      })}
    </span>
  );
}

const CTA_MESSAGE: Message = {
  role: 'assistant',
  cta: true,
  uiOnly: true,
  content: 'Para receber respostas personalizadas, você precisa ter uma conta na Bawzi.\n\nCom ela você terá acesso a:\n- Análise de editais com IA (score GO/NO-GO)\n- Busca de oportunidades no PNCP\n- Radar de alertas e monitoramento de concorrentes',
};

// Requisições ao chat esperam no máximo 30s — sem isso, uma trava na API da
// OpenAI deixava o loading do widget preso indefinidamente, sem forma de
// cancelar.
const CHAT_TIMEOUT_MS = 30_000;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      uiOnly: true,
      content: 'Olá! Sou o assistente da Bawzi.\n\nComo posso te ajudar com a plataforma hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mostra hint após 3s a cada visita; some automaticamente em 6s ou ao clicar
  useEffect(() => {
    const show = setTimeout(() => setShowHint(true), 3000);
    const hide = setTimeout(() => setShowHint(false), 9000); // 3s delay + 6s visível
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  // Detecta se o usuário está logado
  useEffect(() => {
    const check = () => setIsLoggedIn(!!getAccessToken());
    initSession().then(check);

    const onUpdate = () => check();
    const onExpired = () => setIsLoggedIn(false);
    window.addEventListener('bawzi_update', onUpdate);
    window.addEventListener('bawzi_session_expired', onExpired);
    return () => {
      window.removeEventListener('bawzi_update', onUpdate);
      window.removeEventListener('bawzi_session_expired', onExpired);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const openAuthModal = () => setShowAuthModal(true);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Usuário não logado: mostra CTA sem chamar a API
    if (!isLoggedIn) {
      setMessages((prev) => [...prev, CTA_MESSAGE]);
      return;
    }

    setLoading(true);
    // Exclui mensagens uiOnly (saudação, CTA de login) — são só interface,
    // não trocas reais da conversa, e não devem virar contexto pro modelo.
    const history = [...messages, userMsg].filter((m) => !m.uiOnly);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const res = await apiFetch(`${API_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody: { detail?: string } | null = await res.json().catch(() => null);
        throw new Error(errBody?.detail || undefined);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      let content = 'Desculpe, ocorreu um erro. Tente novamente em instantes.';
      if (err instanceof SessionExpiredError) {
        content = 'Sua sessão expirou. Faça login novamente para continuar a conversa.';
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        content = 'A resposta demorou demais e foi cancelada. Tente novamente em instantes.';
      } else if (err instanceof Error && err.message) {
        // Mensagem específica devolvida pelo backend (ex.: "chave de API não
        // configurada", "consentimento LGPD revogado") em vez do genérico.
        content = err.message;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [input, loading, messages, isLoggedIn]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const BawziAvatar = () => (
    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
      <Image src="/icon.png" alt="Bawzi" width={18} height={18} className="object-contain" />
    </div>
  );

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{ width: 368, height: 500, boxShadow: '0 20px 60px -10px rgba(5,150,105,0.18), 0 4px 16px rgba(0,0,0,0.08)', border: '1px solid #d1fae5' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 text-white bg-emerald-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                <Image src="/icon.png" alt="Bawzi" width={26} height={26} className="object-contain" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Bawzi Assistant</p>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <p className="text-xs text-emerald-100 leading-tight">Online agora</p>
                </span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <BawziAvatar />}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-sm shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm'
                  }`}
                >
                  <MessageContent text={msg.content} />
                  {msg.cta && (
                    <button
                      onClick={openAuthModal}
                      className="mt-3 w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors active:scale-95"
                    >
                      Entrar / Criar conta grátis →
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <BawziAvatar />
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <span className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 bg-white">
            <div
              className="flex gap-2 items-center bg-slate-50 rounded-xl border px-3 py-1.5 transition"
              style={{ borderColor: '#e2e8f0' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#059669')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                placeholder="Digite sua dúvida..."
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400 disabled:opacity-50 py-1"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95 shrink-0"
                aria-label="Enviar"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">Powered by Bawzi AI</p>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultView="login"
        onSuccess={() => {
          setShowAuthModal(false);
          setIsLoggedIn(true);
        }}
      />

      {/* Hint flutuante — aparece uma vez sozinho, some após interação, e
          volta a aparecer sempre que o mouse passar por cima do ícone. */}
      <div
        className="fixed bottom-[82px] right-5 z-50 pointer-events-none"
        style={{
          opacity: (showHint || isHovering) && !open ? 1 : 0,
          transform: (showHint || isHovering) && !open ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <div className="bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg">
          Precisa de ajuda?
          {/* Seta apontando para baixo */}
          <span
            className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #047857' }}
          />
        </div>
      </div>

      {/* Botão flutuante */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          setShowHint(false);
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 8px 24px rgba(5,150,105,0.35)' }}
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <Image src="/icon.png" alt="Bawzi" width={30} height={30} className="object-contain" />
        )}
      </button>
    </>
  );
}
