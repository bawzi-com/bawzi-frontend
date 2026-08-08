'use client';

/**
 * ComprarCreditosModal — escolha do valor da compra avulsa de créditos.
 *
 * Substituiu um `window.prompt`. O prompt do navegador falhava em três coisas
 * que aqui são o ponto: não mostra quantos créditos o valor vira ENQUANTO a
 * pessoa digita, não traduz crédito em algo reconhecível ("19 auditorias"),
 * e não valida a faixa antes de o servidor recusar.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Coins, X, Loader2, ArrowRight } from 'lucide-react';

export interface PacoteInfo {
  preco_credito_brl: number;
  minimo_brl: number;
  maximo_brl: number;
  sugestoes_brl: number[];
  creditos_por_auditoria?: number;
  creditos_por_rapida?: number;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export default function ComprarCreditosModal({
  info, aberto, enviando, onFechar, onConfirmar,
}: {
  info: PacoteInfo | null;
  aberto: boolean;
  enviando: boolean;
  onFechar: () => void;
  onConfirmar: (valorBRL: number) => void;
}) {
  const [valor, setValor] = useState<string>('');

  // Abre já com uma sugestão preenchida: campo vazio obriga a pessoa a
  // inventar um número antes de ver qualquer coisa acontecer.
  useEffect(() => {
    if (aberto && info) setValor(String(info.sugestoes_brl?.[1] ?? info.minimo_brl));
  }, [aberto, info]);

  const numero = useMemo(() => {
    const limpo = valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = Number(limpo);
    return Number.isFinite(n) ? n : 0;
  }, [valor]);

  const creditos = info && info.preco_credito_brl > 0
    ? Math.floor(numero / info.preco_credito_brl) : 0;

  const foraDaFaixa = !!info && numero > 0 && (numero < info.minimo_brl || numero > info.maximo_brl);
  const podeConfirmar = !!info && !enviando && creditos >= 1 && !foraDaFaixa;

  // Fecha no Esc — modal que só fecha no clique é modal que prende.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto || !info) return null;

  const porAuditoria = info.creditos_por_auditoria || 0;
  const porRapida = info.creditos_por_rapida || 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar créditos"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-violet-50 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <Coins size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black leading-tight text-slate-950">Adicionar créditos</h3>
              <p className="text-[11px] font-bold text-violet-700">
                {brl(info.preco_credito_brl)} por crédito · sem assinatura, compra única
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-900"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {/* Sugestões */}
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Valores sugeridos
          </p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {info.sugestoes_brl.map((v) => {
              const ativo = numero === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValor(String(v))}
                  className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                    ativo
                      ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-200'
                      : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                  }`}
                >
                  <span className={`block text-[13px] font-black ${ativo ? 'text-violet-800' : 'text-slate-700'}`}>
                    {v}
                  </span>
                  <span className="block text-[9px] font-bold text-slate-400">
                    {Math.floor(v / info.preco_credito_brl)} cr
                  </span>
                </button>
              );
            })}
          </div>

          {/* Valor livre */}
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Ou digite o valor
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
              R$
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && podeConfirmar) onConfirmar(numero); }}
              autoFocus
              className={`w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-4 text-lg font-black text-slate-900 outline-none transition-all focus:bg-white ${
                foraDaFaixa
                  ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-500/10'
                  : 'border-slate-200 focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10'
              }`}
            />
          </div>
          {foraDaFaixa ? (
            <p className="mt-1.5 text-[11px] font-bold text-red-600">
              Valor entre {brl(info.minimo_brl)} e {brl(info.maximo_brl)}.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] font-medium text-slate-400">
              Entre {brl(info.minimo_brl)} e {brl(info.maximo_brl)}
            </p>
          )}

          {/* O que este valor compra — a tradução que faz o número significar algo */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Você recebe
              </span>
              <span className="text-2xl font-black tabular-nums text-slate-950">
                {creditos.toLocaleString('pt-BR')}
                <span className="ml-1 text-sm font-bold text-slate-500">créditos</span>
              </span>
            </div>
            {(porAuditoria > 0 || porRapida > 0) && creditos > 0 && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                Dá para aproximadamente{' '}
                {porAuditoria > 0 && (
                  <strong className="text-slate-700">
                    {Math.floor(creditos / porAuditoria)} auditoria(s) profunda(s)
                  </strong>
                )}
                {porAuditoria > 0 && porRapida > 0 && ' ou '}
                {porRapida > 0 && (
                  <strong className="text-slate-700">
                    {Math.floor(creditos / porRapida)} análise(s) rápida(s)
                  </strong>
                )}
                {' '}de um edital típico.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => onConfirmar(numero)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-black text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <><Loader2 size={16} className="animate-spin" /> Abrindo pagamento…</>
            ) : (
              <>Pagar {brl(numero || 0)} <ArrowRight size={16} /></>
            )}
          </button>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
            Pagamento seguro pelo Stripe · os créditos entram assim que o pagamento confirmar
          </p>
        </div>
      </div>
    </div>
  );
}
