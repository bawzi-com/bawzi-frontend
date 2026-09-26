import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanaisDoAviso } from './CanaisDoAviso';

/* Os canais de um aviso (26/09/2026), renderizados no servidor e clicados
 * sem navegador. */

function botoes(no: ReactNode): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap(botoes);
  if (!isValidElement(no)) return [];
  const filhos = botoes((no.props as { children?: ReactNode }).children);
  return no.type === 'button' ? [no, ...filhos] : filhos;
}

describe('CanaisDoAviso', () => {
  it('o sino sempre, e só os canais que o aviso usa; cada um é um interruptor', () => {
    const onAlternar = vi.fn();
    const props = { ligado: true, canais: ['push', 'email'] as const, ativos: { push: true, email: false }, onAlternar };
    const html = renderToStaticMarkup(createElement(CanaisDoAviso, { ...props, canais: [...props.canais] }));
    expect(html).toContain('Chega por:');
    expect(html).toMatch(/<\/svg>Sino<\/span>/);
    expect(html).toMatch(/role="switch" aria-checked="true" aria-label="Push deste aviso"/);
    expect(html).toMatch(/role="switch" aria-checked="false" aria-label="E-mail deste aviso"/);
    expect(html).toMatch(/line-through[^>]*><svg[^]*?<\/svg>E-mail/);             // desligado: riscado
    expect(html).toMatch(/bg-amber-100 text-amber-900[^>]*><svg[^]*?<\/svg>Push/);  // ligado: aceso
    const [push, email] = botoes(CanaisDoAviso({ ...props, canais: [...props.canais] }));
    (email.props as { onClick: () => void }).onClick();
    (push.props as { onClick: () => void }).onClick();
    expect(onAlternar.mock.calls).toEqual([['email'], ['push']]);
    expect((push.props as { disabled: boolean }).disabled).toBe(false);
  });

  it('aviso só de sino: nenhum interruptor; ausência de escolha é ligado', () => {
    const soSino = renderToStaticMarkup(createElement(CanaisDoAviso, { ligado: true, canais: [], ativos: {}, onAlternar: () => {} }));
    expect(soSino).toContain('Sino');
    expect(soSino).not.toContain('<button');
    const semEscolha = renderToStaticMarkup(createElement(CanaisDoAviso, { ligado: true, canais: ['email'], ativos: {}, onAlternar: () => {} }));
    expect(semEscolha).toContain('aria-checked="true"');
  });

  it('aviso desligado: canais travados e apagados, mostrando a escolha guardada; salvando trava o canal e gira', () => {
    const desligado = CanaisDoAviso({ ligado: false, canais: ['push', 'email'], ativos: { push: true, email: false }, onAlternar: () => {} });
    const html = renderToStaticMarkup(desligado);
    expect(html).toContain('opacity-50');
    expect(html).toMatch(/aria-checked="true" aria-label="Push/);                 // a escolha não se perde
    expect(html).toContain('Ligue o aviso para escolher o push.');
    expect(html).toMatch(/border-slate-200 bg-slate-50 text-slate-400[^>]*><svg[^]*?<\/svg>Sino/);
    expect(botoes(desligado).every((b) => (b.props as { disabled: boolean }).disabled)).toBe(true);
    const salvando = CanaisDoAviso({ ligado: true, canais: ['push', 'email'], ativos: {}, salvando: 'email', onAlternar: () => {} });
    const [push, email] = botoes(salvando);
    expect((email.props as { disabled: boolean }).disabled).toBe(true);
    expect((push.props as { disabled: boolean }).disabled).toBe(false);
    expect(renderToStaticMarkup(salvando)).toContain('animate-spin');
  });
});
