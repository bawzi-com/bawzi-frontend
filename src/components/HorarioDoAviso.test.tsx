import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HorarioDoAviso } from './HorarioDoAviso';

/* A hora dos resumos diários (26/09/2026): "pode ser parametrizável?",
 * renderizada no servidor e escolhida sem navegador. */

type Props = Parameters<typeof HorarioDoAviso>[0];

/** Os <select> da árvore, descendo pelos componentes internos. */
function seletores(no: ReactNode): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap(seletores);
  if (!isValidElement(no)) return [];
  if (typeof no.type === 'function') {
    return seletores((no.type as (p: unknown) => ReactNode)(no.props));
  }
  const filhos = seletores((no.props as { children?: ReactNode }).children);
  return no.type === 'select' ? [no, ...filhos] : filhos;
}

const HORAS = Array.from({ length: 17 }, (_, i) => i + 6);

function props(o: Partial<Props> = {}): Props {
  return {
    ligado: true,
    quando: 'todo dia, 07h20',
    agenda: { hora: 18, minuto: 20, frequencia: 'dias_uteis' },
    padrao: { hora: 7, minuto: 20, frequencia: 'todo_dia' },
    horas: HORAS,
    onTrocar: () => {},
    ...o,
  };
}

describe('HorarioDoAviso', () => {
  it('resumo diário: os dias e a hora viram seletores, com a escolha marcada', () => {
    const html = renderToStaticMarkup(createElement(HorarioDoAviso, props()));
    expect(html).toContain('Quando:');
    expect(html).toContain('aria-label="Dias deste aviso"');
    expect(html).toContain('aria-label="Horário deste aviso"');
    expect(html).toMatch(/<option value="dias_uteis" selected="">Dias úteis<\/option>/);
    expect(html).toMatch(/<option value="todo_dia">Todo dia<\/option>/);
    expect(html).toMatch(/<option value="18" selected="">18h20<\/option>/);
    // As horas são as do servidor, com o minuto do job; o padrão vai no title.
    expect(html).toMatch(/<option value="6">06h20<\/option>/);
    expect(html).toMatch(/<option value="7">07h20<\/option>/);
    expect(html).toMatch(/<option value="22">22h20<\/option>/);
    expect(html).toContain('aria-label="Horário deste aviso" title="Padrão: 07h20"');
    expect(html).not.toMatch(/aria-label="Dias deste aviso" title=/);
    // "às" e a hora quebram juntos.
    expect(html).toMatch(/<span class="inline-flex items-center gap-1.5">às<span class="relative inline-flex"><select aria-label="Horário/);
    expect(html).not.toContain('value="5"');
    expect(html).not.toContain('value="23"');
    expect(html).not.toContain('opacity-50');
  });

  it('escolher chama de volta com a mudança — a hora como número', () => {
    const onTrocar = vi.fn();
    const [dias, hora] = seletores(HorarioDoAviso(props({ onTrocar, agenda: { hora: 7, minuto: 20, frequencia: 'todo_dia' } })));
    (hora.props as { onChange: (e: unknown) => void }).onChange({ target: { value: '9' } });
    (dias.props as { onChange: (e: unknown) => void }).onChange({ target: { value: 'dias_uteis' } });
    expect(onTrocar.mock.calls).toEqual([[{ hora: 9 }], [{ frequencia: 'dias_uteis' }]]);
    expect((hora.props as { disabled: boolean }).disabled).toBe(false);
  });

  it('aviso desligado ou salvando: nada a escolher', () => {
    const desligado = seletores(HorarioDoAviso(props({ ligado: false })));
    expect(desligado.every((s) => (s.props as { disabled: boolean }).disabled)).toBe(true);
    expect((desligado[0].props as { title?: string }).title).toBe('Ligue o aviso para escolher quando ele chega.');
    expect(renderToStaticMarkup(createElement(HorarioDoAviso, props({ ligado: false })))).toContain('opacity-50');
    const salvando = seletores(HorarioDoAviso(props({ salvando: true })));
    expect(salvando.every((s) => (s.props as { disabled: boolean }).disabled)).toBe(true);
    expect((salvando[0].props as { title?: string }).title).toBeUndefined();
    expect((desligado[1].props as { title?: string }).title).toBe('Ligue o aviso para escolher quando ele chega.');
    expect((seletores(HorarioDoAviso(props({ padrao: undefined })))[1].props as { title?: string }).title).toBeUndefined();
    expect(renderToStaticMarkup(createElement(HorarioDoAviso, props({ salvando: true })))).toContain('animate-spin');
    expect(renderToStaticMarkup(createElement(HorarioDoAviso, props()))).not.toContain('animate-spin');
  });

  it('o que mais faz o aviso sair aparece depois da hora', () => {
    const html = renderToStaticMarkup(createElement(HorarioDoAviso, props({ tambem: 'e ao abrir o sino' })));
    expect(html).toMatch(/22h20<\/option><\/select>[^]*e ao abrir o sino/);
  });

  it('aviso de hora fixa, ou servidor sem a lista de horas: fica o texto', () => {
    const fixo = renderToStaticMarkup(createElement(HorarioDoAviso, props({ agenda: undefined, quando: 'ao abrir o sino' })));
    expect(fixo).toContain('Quando:');
    expect(fixo).toContain('Ao abrir o sino');
    expect(fixo).not.toContain('<select');
    const semHoras = renderToStaticMarkup(createElement(HorarioDoAviso, props({ horas: [] })));
    expect(semHoras).toContain('Todo dia, 07h20');
    expect(semHoras).not.toContain('<select');
  });
});
