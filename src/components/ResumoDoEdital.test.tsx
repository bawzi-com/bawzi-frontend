import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DecisionQueueTask } from '@/lib/decisionQueue';
import type { DataDoEdital, SituacaoDoEdital } from '@/lib/gestao';
import { DatasDoEdital, LinhaDeEtapas, ProximaAcaoCard, SeletorDeDesfecho, SituacaoDoEditalBanner } from './ResumoDoEdital';

/* As peças do resumo do edital (25/09/2026), renderizadas no servidor e
 * clicadas sem navegador: nenhuma usa hook, então dá para chamá-las como
 * função e procurar os botões na árvore que devolvem. */

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
const clicar = (b: ReactElement) => (b.props as { onClick: () => void }).onClick();
const texto = (b: ReactElement) => renderToStaticMarkup(b).replace(/<[^>]+>/g, '').trim();

function tarefa(extra: Partial<DecisionQueueTask> = {}): DecisionQueueTask {
  return { id: 't2', acao: 'Montar a proposta comercial', prazo: '30/09/2026', responsavel: 'Comercial', resultado_esperado: 'Proposta pronta para envio', origem: 'Decisão', prioridade: 'Normal', ...extra };
}

describe('SituacaoDoEditalBanner — a situação em uma frase', () => {
  const vencido: SituacaoDoEdital = { tom: 'vermelho', titulo: 'Prazo venceu há 43 dias', texto: 'Nenhuma das 3 ações do plano foi feita.', sugestao: 'registrar_resultado' };

  it('título, texto, o tom na caixa e o botão com o rótulo da sugestão; clicar devolve a sugestão', () => {
    const onSugestao = vi.fn();
    const html = renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: vencido, onSugestao }));
    expect(html).toContain('Prazo venceu há 43 dias');
    expect(html).toContain('Nenhuma das 3 ações do plano foi feita.');
    expect(html).toContain('border-red-200 bg-red-50');
    expect(html).toContain('Registrar resultado');
    const [botao] = botoes(SituacaoDoEditalBanner({ situacao: vencido, onSugestao }));
    clicar(botao);
    expect(onSugestao).toHaveBeenCalledWith('registrar_resultado');
  });

  it('cada sugestão tem o seu rótulo; cada tom, a sua cor', () => {
    const rotulos: Array<[SituacaoDoEdital['sugestao'], string]> = [
      ['concluir_acao', 'Concluir a próxima ação'], ['avancar', 'Avançar a etapa'], ['conferir_prazo', 'Ver no PNCP'],
    ];
    for (const [sugestao, rotulo] of rotulos) {
      const html = renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: { ...vencido, sugestao }, onSugestao: () => {} }));
      expect(html).toContain(rotulo);
    }
    const cores: Array<[SituacaoDoEdital['tom'], string]> = [
      ['ambar', 'border-amber-200 bg-amber-50'], ['azul', 'border-sky-200 bg-sky-50'], ['verde', 'border-emerald-200 bg-emerald-50'], ['neutro', 'border-slate-200 bg-slate-50'],
    ];
    for (const [tom, classe] of cores) {
      expect(renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: { ...vencido, tom } }))).toContain(classe);
    }
  });

  it('sem sugestão, sem quem a receba ou sem com o que fazer: nenhum botão', () => {
    const semSugestao = renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: { ...vencido, sugestao: null }, onSugestao: () => {} }));
    const semReceptor = renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: vencido }));
    const indisponivel = renderToStaticMarkup(createElement(SituacaoDoEditalBanner, { situacao: vencido, onSugestao: () => {}, sugestaoDisponivel: false }));
    for (const html of [semSugestao, semReceptor, indisponivel]) {
      expect(html).not.toContain('<button');
      expect(html).toContain('Prazo venceu há 43 dias');
    }
  });
});

describe('LinhaDeEtapas — as cinco etapas como passos', () => {
  it('a atual marcada e travada, as passadas com ✓, as próximas numeradas; clicar numa move', () => {
    const onEscolher = vi.fn();
    const html = renderToStaticMarkup(createElement(LinhaDeEtapas, { stage: 'pending', onEscolher }));
    expect(html).toMatch(/aria-current="step"[^>]*>(?:(?!<button).)*Pendência/);
    expect((html.match(/aria-current="step"/g) || []).length).toBe(1);
    expect((html.match(/✓/g) || []).length).toBe(2);
    expect(html).toMatch(/>4<[^]*?Proposta/);
    expect(html).toMatch(/>5<[^]*?Enviado/);
    expect(html).not.toContain('animate-spin');
    const passos = botoes(LinhaDeEtapas({ stage: 'pending', onEscolher }));
    expect(passos.map(texto)).toEqual(['✓Não iniciado', '✓Em triagem', '3Pendência', '4Proposta', '5Enviado']);
    expect(passos.map((b) => (b.props as { disabled: boolean }).disabled)).toEqual([false, false, true, false, false]);
    expect((passos[3].props as { title: string }).title).toBe('Mover para Proposta');
    clicar(passos[3]);
    expect(onEscolher).toHaveBeenCalledWith('proposal');
    clicar(passos[0]);
    expect(onEscolher).toHaveBeenLastCalledWith('not_started');
  });

  it('num desfecho a linha fica apagada, o desfecho aparece ao fim e qualquer passo reabre', () => {
    const html = renderToStaticMarkup(createElement(LinhaDeEtapas, { stage: 'won', onEscolher: () => {} }));
    expect(html).not.toContain('aria-current');
    expect(html).not.toContain('✓');
    expect(html).toMatch(/Enviado<\/button><span[^>]*>[^]*?Ganho<\/span><\/div>$/);
    const passos = botoes(LinhaDeEtapas({ stage: 'won', onEscolher: () => {} }));
    expect(passos).toHaveLength(5);
    expect(passos.every((b) => !(b.props as { disabled: boolean }).disabled)).toBe(true);
  });

  it('salvando: tudo travado e o giro aparece', () => {
    const html = renderToStaticMarkup(createElement(LinhaDeEtapas, { stage: 'triage', salvando: true, onEscolher: () => {} }));
    expect(html).toContain('animate-spin');
    const passos = botoes(LinhaDeEtapas({ stage: 'triage', salvando: true, onEscolher: () => {} }));
    expect(passos.every((b) => (b.props as { disabled: boolean }).disabled)).toBe(true);
  });
});

describe('SeletorDeDesfecho — o caminho direto para um desfecho', () => {
  const selectDe = (no: ReactNode) => todos(no, (e) => e.type === 'select')[0];
  const mudar = (sel: ReactElement, value: string) => (sel.props as { onChange: (e: { target: { value: string } }) => void }).onChange({ target: { value } });

  it('numa etapa do fluxo fica no vazio; os quatro desfechos são as opções; escolher move', () => {
    const onEscolher = vi.fn();
    const html = renderToStaticMarkup(createElement(SeletorDeDesfecho, { stage: 'triage', onEscolher }));
    expect(html).toMatch(/<option value="" selected="">Desfecho direto…/);
    for (const r of ['Ganho', 'Perdido', 'Abandonado', 'Executado']) expect(html).toContain(`>${r}</option>`);
    expect(html).not.toContain('Em triagem');
    const sel = selectDe(SeletorDeDesfecho({ stage: 'triage', onEscolher }));
    mudar(sel, 'executed');
    expect(onEscolher).toHaveBeenCalledWith('executed');
    mudar(sel, '');
    expect(onEscolher).toHaveBeenCalledTimes(1);
  });

  it('num desfecho mostra o atual, e escolher o mesmo não grava; salvando trava', () => {
    const onEscolher = vi.fn();
    const html = renderToStaticMarkup(createElement(SeletorDeDesfecho, { stage: 'won', onEscolher }));
    expect(html).toMatch(/<option value="won" selected="">Ganho/);
    const sel = selectDe(SeletorDeDesfecho({ stage: 'won', onEscolher }));
    mudar(sel, 'won');
    mudar(sel, '');
    expect(onEscolher).not.toHaveBeenCalled();
    mudar(sel, 'lost');
    expect(onEscolher).toHaveBeenCalledWith('lost');
    expect(onEscolher).toHaveBeenCalledTimes(1);
    expect((selectDe(SeletorDeDesfecho({ stage: 'won', salvando: true, onEscolher })).props as { disabled: boolean }).disabled).toBe(true);
  });
});

describe('ProximaAcaoCard — a próxima ação em destaque', () => {
  const base = { responsavel: 'Ana', prazo: '30/09/2026', feitas: 1, total: 3, onConcluir: () => {}, onEditar: () => {} };

  it('qual é, de quantas, quem faz e até quando; Concluir e Editar chamam quem grava', () => {
    const onConcluir = vi.fn();
    const onEditar = vi.fn();
    const props = { ...base, tarefa: tarefa({ prioridade: 'Alta' }), onConcluir, onEditar };
    const html = renderToStaticMarkup(createElement(ProximaAcaoCard, props));
    expect(html).toContain('Próxima ação · 2 de 3');
    expect(html).toContain('Montar a proposta comercial');
    expect(html).toContain('Proposta pronta para envio');
    expect(html).toContain('Ana');
    expect(html).toContain('30/09/2026');
    expect(html).toContain('prioridade alta');
    expect(html).not.toContain('animate-spin');
    const [editar, concluir] = botoes(ProximaAcaoCard(props));
    expect(texto(editar)).toBe('Editar no plano');
    expect(texto(concluir)).toBe('Concluir');
    clicar(editar);
    clicar(concluir);
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onConcluir).toHaveBeenCalledTimes(1);
  });

  it('prioridade normal não ganha selo; salvando trava o Concluir e mostra o giro', () => {
    const normal = renderToStaticMarkup(createElement(ProximaAcaoCard, { ...base, tarefa: tarefa() }));
    expect(normal).not.toContain('prioridade alta');
    const salvando = renderToStaticMarkup(createElement(ProximaAcaoCard, { ...base, tarefa: tarefa(), salvando: true }));
    expect(salvando).toContain('animate-spin');
    // Pelo elemento, não pelo HTML: a classe `disabled:opacity-60` faria um
    // `toContain('disabled')` passar com o botão destravado.
    const [, concluirTravado] = botoes(ProximaAcaoCard({ ...base, tarefa: tarefa(), salvando: true }));
    expect((concluirTravado.props as { disabled: boolean }).disabled).toBe(true);
    const [, concluirLivre] = botoes(ProximaAcaoCard({ ...base, tarefa: tarefa() }));
    expect((concluirLivre.props as { disabled: boolean }).disabled).toBe(false);
  });

  it('sem ação pendente: diz se o plano acabou ou se nunca existiu, sem botão', () => {
    const acabou = renderToStaticMarkup(createElement(ProximaAcaoCard, { ...base, tarefa: null, feitas: 3, total: 3 }));
    expect(acabou).toContain('As 3 ações do plano estão concluídas.');
    expect(acabou).not.toContain('<button');
    const nunca = renderToStaticMarkup(createElement(ProximaAcaoCard, { ...base, tarefa: null, feitas: 0, total: 0 }));
    expect(nunca).toContain('O laudo não trouxe plano de ações para este edital.');
  });
});

describe('DatasDoEdital — todas as datas', () => {
  const data = (rotulo: string, dias: number | null, decisivo: boolean, extra: Partial<DataDoEdital> = {}): DataDoEdital => ({
    rotulo, dias, decisivo, data: dias === null ? null : new Date(2026, 8, 25 + dias), bruto: dias === null ? 'a definir' : '', ...extra,
  });

  it('vencido decisivo em vermelho, decisivo futuro em verde, informativo apagado, só texto sem contagem', () => {
    const datas = [data('Abertura das propostas', -43, true), data('Sessão pública', 2, true), data('Publicação', -60, false), data('Visita técnica', null, false)];
    const html = renderToStaticMarkup(createElement(DatasDoEdital, { datas }));
    expect(html).toMatch(/bg-red-500[^]*?Abertura das propostas[^]*?venceu há 43 dias/);
    expect(html).toMatch(/bg-emerald-500[^]*?Sessão pública[^]*?27 de set\.[^]*?em 2 dias/);
    expect(html).toMatch(/bg-slate-300[^]*?Publicação[^]*?venceu há 60 dias/);
    expect(html).toMatch(/Visita técnica[^]*?a definir/);
    expect((html.match(/<li/g) || []).length).toBe(4);
    expect(html).toContain('text-amber-700');
  });

  it('vencido informativo não grita; sem datas, nada', () => {
    const html = renderToStaticMarkup(createElement(DatasDoEdital, { datas: [data('Publicação', -60, false)] }));
    expect(html).not.toContain('bg-red-500');
    expect(html).not.toContain('text-red-700');
    expect(renderToStaticMarkup(createElement(DatasDoEdital, { datas: [] }))).toBe('');
  });
});
