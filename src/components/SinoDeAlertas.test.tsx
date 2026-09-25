import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { agruparAlertas, contagensPorTipo, secoesDoRadar, type GrupoDeAlertas, type Notificacao } from '@/lib/radar';
import { CardDeAlerta, ChipsDoRadar, SecaoVencidos } from './SinoDeAlertas';

/* As peças do sino (25/09/2026), renderizadas no servidor e clicadas sem
 * navegador: nenhuma usa hook, então dá para chamá-las como função. */

const HOJE = new Date(2026, 8, 25, 10, 0);
const iso = (d: number, h = 9) => new Date(2026, 8, d, h).toISOString();

function todos(no: ReactNode, quer: (e: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap((n) => todos(n, quer));
  if (!isValidElement(no)) return [];
  if (typeof no.type === 'function') {
    return todos((no.type as (p: unknown) => ReactNode)(no.props), quer);
  }
  const filhos = todos((no.props as { children?: ReactNode }).children, quer);
  return quer(no) ? [no, ...filhos] : filhos;
}
const botoes = (no: ReactNode) => todos(no, (e) => e.type === 'button');
const texto = (e: ReactElement) => renderToStaticMarkup(e).replace(/<[^>]+>/g, '').trim();
const clicar = (b: ReactElement) => (b.props as { onClick: (e: { stopPropagation: () => void }) => void }).onClick({ stopPropagation: () => {} });

let seq = 0;
function alerta(o: Partial<Notificacao> & { tipo: Notificacao['tipo'] }): Notificacao {
  seq += 1;
  return { _id: `n${seq}`, prioridade: 1, icone: '⏱', titulo: 'Título', mensagem: 'Mensagem', url: '?tab=gestao', lida: false, criada_em: iso(25), ...o };
}
const grupoDe = (...itens: Notificacao[]): GrupoDeAlertas => agruparAlertas(itens)[0];

const prazoVencido = alerta({
  tipo: 'prazo', titulo: 'Prazo crítico vence hoje', criada_em: iso(19),
  mensagem: 'Abertura das Propostas do edital "REESTRUTURAÇÃO DO SITE" vence hoje. Decida, esclareça ou abandone antes de mobilizar proposta.',
  dados: { analysis_id: 'a1', prazo: 'Abertura das Propostas' },
});
const prazoAmanha = alerta({
  tipo: 'prazo', titulo: 'Prazo vence amanhã', mensagem: 'Encerramento das Propostas do edital "LAGO" vence amanhã.',
  dados: { analysis_id: 'a2', prazo: 'Encerramento das Propostas', data_iso: '2026-09-26', tipo_prazo: 'fim', titulo_edital: 'LAGO' },
});
const mudancas = [
  alerta({ tipo: 'pncp_mudanca', titulo: 'Edital mudou no PNCP', mensagem: 'MEDICAMENTOS recebeu novo documento ou alteração oficial. Revise antes de avançar.', criada_em: iso(13), dados: { analysis_id: 'x' } }),
  alerta({ tipo: 'pncp_mudanca', titulo: 'Edital mudou no PNCP', mensagem: 'MEDICAMENTOS recebeu novo documento ou alteração oficial. Revise antes de avançar.', criada_em: iso(3), dados: { analysis_id: 'x' } }),
  alerta({ tipo: 'pncp_mudanca', titulo: 'Edital mudou no PNCP', mensagem: 'MEDICAMENTOS recebeu novo documento ou alteração oficial. Revise antes de avançar.', criada_em: iso(3, 12), dados: { analysis_id: 'x' } }),
];
const certidoes = alerta({ tipo: 'compliance', titulo: 'Risco de Desclassificação', mensagem: 'Certidões vencidas resultam em desclassificação imediata.', url: '/profile' });

describe('ChipsDoRadar — os filtros do topo', () => {
  const outroPrazo = alerta({ ...prazoAmanha, _id: 'p2', dados: { ...prazoAmanha.dados, analysis_id: 'a3' } });
  const contagens = contagensPorTipo(secoesDoRadar([prazoAmanha, outroPrazo, ...mudancas, certidoes], HOJE).ativos);

  it('"Todos" com o total de grupos, um chip por tipo com a contagem, o ativo marcado; clicar filtra e clicar de novo limpa', () => {
    const onEscolher = vi.fn();
    const html = renderToStaticMarkup(createElement(ChipsDoRadar, { contagens, ativo: null, onEscolher }));
    expect(html).toMatch(/aria-selected="true"[^>]*>Todos <span[^>]*>4</);
    expect(html).toContain('2 Prazos');
    expect(html).toContain('1 Editais que mudaram');
    expect(html).toContain('1 Compliance');
    const chips = botoes(ChipsDoRadar({ contagens, ativo: null, onEscolher }));
    expect(chips.map(texto)).toEqual(['Todos 4', '2 Prazos', '1 Editais que mudaram', '1 Compliance']);
    clicar(chips[2]);
    expect(onEscolher).toHaveBeenCalledWith('pncp_mudanca');
    const comFiltro = renderToStaticMarkup(createElement(ChipsDoRadar, { contagens, ativo: 'pncp_mudanca', onEscolher }));
    expect(comFiltro).toMatch(/aria-selected="true"[^>]*>1 Editais que mudaram/);
    expect(comFiltro).toMatch(/aria-selected="false"[^>]*>Todos/);
    const [, , ativo] = botoes(ChipsDoRadar({ contagens, ativo: 'pncp_mudanca', onEscolher }));
    clicar(ativo);
    expect(onEscolher).toHaveBeenLastCalledWith(null);
    clicar(botoes(ChipsDoRadar({ contagens, ativo: 'pncp_mudanca', onEscolher }))[0]);
    expect(onEscolher).toHaveBeenLastCalledWith(null);
  });

  it('com um tipo só não há o que filtrar: nada', () => {
    expect(renderToStaticMarkup(createElement(ChipsDoRadar, { contagens: contagens.slice(0, 1), ativo: null, onEscolher: () => {} }))).toBe('');
  });
});

describe('CardDeAlerta — um card por grupo', () => {
  const base = { hoje: HOJE, onAbrir: () => {}, onRemover: () => {} };

  it('prazo vencido: título e mensagem recalculados, sem a frase repetida, sem "não lida", apagado', () => {
    const html = renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo: grupoDe(prazoVencido) }));
    expect(html).toContain('Propostas abriram há 6 dias');
    expect(html).toContain('Abertura das Propostas do edital &quot;Reestruturação do site&quot; foi há 6 dias.');
    expect(html).not.toContain('Decida, esclareça');
    expect(html).not.toContain('Não lida');
    expect(html).toContain('venceu há 6 dias');
    expect(html).toContain('opacity-70');
    expect(html).toContain('title="Alerta gerado há 6 dias">há 6 dias</span>');   // a idade do alerta
    expect(html).toContain('Abrir este edital');
  });

  it('prazo de amanhã: chip vermelho, sem apagar; disputa e certidões com o seu botão', () => {
    const html = renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo: grupoDe(prazoAmanha) }));
    expect(html).toContain('Prazo vence amanhã');
    expect(html).toMatch(/text-red-600[^>]*>vence amanhã/);
    expect(html).not.toContain('opacity-70');
    const disputa = alerta({ tipo: 'disputa_abrindo', titulo: 'Disputa em 30 dias: MJ', mensagem: 'O contrato de X em MJ vence em 26 dias.', criada_em: iso(5), url: '/workspace', dados: { ncp: 'c1', dias: 26 } });
    const htmlDisputa = renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo: grupoDe(disputa) }));
    expect(htmlDisputa).toContain('Disputa em 6 dias: MJ');   // sigla curta fica em caixa alta
    expect(htmlDisputa).toContain('vence em 6 dias.');
    expect(htmlDisputa).toContain('Ver contrato');
    expect(htmlDisputa).toMatch(/text-amber-700[^>]*>vence em 6 dias/);
    const htmlCertidoes = renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo: grupoDe(certidoes) }));
    expect(htmlCertidoes).toContain('Verificar certidões');
    expect(htmlCertidoes).not.toContain('venceu');
  });

  it('três alterações do mesmo edital viram um card, com o resumo e o remover dos três', () => {
    const onAbrir = vi.fn();
    const onRemover = vi.fn();
    const grupo = grupoDe(...mudancas);
    const props = { ...base, grupo, onAbrir, onRemover };
    const html = renderToStaticMarkup(createElement(CardDeAlerta, props));
    expect(html).toContain('3 alterações, a última há 12 dias');
    expect(html).toContain('Medicamentos recebeu novo documento');
    expect(html).toContain('title="Remover os 3 alertas"');
    expect(html).toContain('aria-label="Remover os 3 alertas"');
    const [remover, cta] = botoes(CardDeAlerta(props));
    clicar(remover);
    expect(onRemover).toHaveBeenCalledWith(grupo);
    expect(onAbrir).not.toHaveBeenCalled();
    clicar(cta);
    expect(onAbrir).toHaveBeenCalledWith(grupo);
    const topo = todos(CardDeAlerta(props), (e) => (e.props as { role?: string }).role === 'button')[0];
    (topo.props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledTimes(2);
  });

  it('o estado: aberto e lida ganham selo; pendente não', () => {
    const grupo = grupoDe(prazoAmanha);
    expect(renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo, estado: 'aberto' }))).toContain('Aberto');
    expect(renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo, estado: 'lida' }))).toContain('Lida');
    const pendente = renderToStaticMarkup(createElement(CardDeAlerta, { ...base, grupo }));
    expect(pendente).not.toContain('>Aberto');
    expect(pendente).not.toContain('Lida');
  });
});

describe('SecaoVencidos — recolhida, com limpar', () => {
  const grupos = secoesDoRadar([prazoVencido, alerta({ ...prazoVencido, _id: 'outro', dados: { analysis_id: 'a7', prazo: 'Sessão pública' }, mensagem: 'Sessão pública do edital "Z" vence hoje.' })], HOJE).vencidos;
  const base = { grupos, aberta: false, onAlternar: () => {}, onLimpar: () => {}, estadoDe: () => 'pendente' as const, hoje: HOJE, onAbrir: () => {}, onRemover: () => {} };

  it('fechada mostra só a contagem e o limpar; aberta lista os cards; os cliques chamam quem grava', () => {
    const onAlternar = vi.fn();
    const onLimpar = vi.fn();
    const fechada = renderToStaticMarkup(createElement(SecaoVencidos, { ...base, onAlternar, onLimpar }));
    expect(fechada).toMatch(/Vencidos <span[^>]*>2</);
    expect(fechada).toContain('aria-expanded="false"');
    expect(fechada).not.toContain('Abrir este edital');
    const [alternar, limpar] = botoes(SecaoVencidos({ ...base, onAlternar, onLimpar }));
    expect(texto(limpar)).toBe('Limpar vencidos');
    clicar(alternar);
    clicar(limpar);
    expect(onAlternar).toHaveBeenCalledTimes(1);
    expect(onLimpar).toHaveBeenCalledTimes(1);
    const aberta = renderToStaticMarkup(createElement(SecaoVencidos, { ...base, aberta: true }));
    expect(aberta).toContain('aria-expanded="true"');
    expect((aberta.match(/Abrir este edital/g) || []).length).toBe(2);
    expect(aberta).toContain('Sessão foi há 6 dias');
  });

  it('sem vencidos, nada', () => {
    expect(renderToStaticMarkup(createElement(SecaoVencidos, { ...base, grupos: [] }))).toBe('');
  });
});
