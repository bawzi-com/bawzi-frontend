'use client';

/**
 * ErrorBoundary.tsx
 * ─────────────────────────────────────────────────────────────────
 * Componente React de classe que captura erros de renderização em
 * qualquer filho da árvore. Em vez de tela branca, exibe uma
 * mensagem de erro útil com botão de reload.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <AnalysisApp />
 *   </ErrorBoundary>
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Mensagem customizada exibida ao usuário (opcional) */
  mensagem?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro desconhecido',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Em produção, enviar para serviço de monitoramento (Sentry, etc.)
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
          {/* Ícone */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          {/* Título */}
          <h2 className="text-xl font-black text-slate-900 mb-2">
            Algo inesperado aconteceu
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
            {this.props.mensagem ||
              'Um erro interrompeu o carregamento desta página. Os seus dados estão seguros — tente recarregar.'}
          </p>

          {/* Detalhe técnico (colapsável) */}
          {this.state.errorMessage && (
            <details className="mb-6 text-left">
              <summary className="text-[11px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors">
                Detalhes técnicos
              </summary>
              <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all border border-slate-100">
                {this.state.errorMessage}
              </pre>
            </details>
          )}

          {/* CTA */}
          <button
            onClick={this.handleReload}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors text-sm shadow-sm"
          >
            Recarregar a página
          </button>

          <p className="mt-4 text-[10px] text-slate-400">
            Se o problema persistir, entre em contacto com o{' '}
            <a href="mailto:suporte@bawzi.com" className="underline hover:text-slate-600">
              suporte
            </a>
            .
          </p>
        </div>
      </div>
    );
  }
}
