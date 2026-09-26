import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SavedAnalysis } from '@/lib/types';
import type { DecisionQueueKey, DecisionQueueTask } from '@/lib/decisionQueue';
import type { CartaoDaGestao } from '@/lib/gestao';
import {
  CabecalhoDaGestao, CartaoDoEdital, ChipDeEtapa, ColunaDoQuadro, FaixaDeControles, linhaDoCartao, PainelDeFiltros, selosDoCartao,
} from './QuadroDaGestao';

/* O quadro redesenhado (25/09/2026), renderizado no servidor e clicado sem
 * navegador: nenhuma peça usa hook, então dá para chamá-las como função. */

const HOJE = new Date(2026, 8, 25, 10, 0);

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
const evento = { stopPropagation: () => {}, preventDefault: () => {} };
const clicar = (b: ReactElement) => (b.props as { onClick: (e: typeof evento) => void }).onClick(evento);

function tarefa(id: string, acao: string, extra: Partial<DecisionQueueTask> = {}): DecisionQueueTask {
  return { id, acao, prazo: 'Hoje', responsavel: 'Licitações', resultado_esperado: '', origem: 'Decisão', prioridade: 'Normal', ...extra };
}

function cartao(o: {
  id?: string; titulo?: string; stage?: DecisionQueueKey; orgao?: string; uf?: string; valor?: unknown; score?: number | null;
  datas?: Array<{ label: string; data_iso: string | null }>; tasks?: DecisionQueueTask[]; status?: CartaoDaGestao['statusMap'];
  veredito?: 'GO' | 'GO_CONDICIONADO' | 'NO_GO'; created?: string;
} = {}): CartaoDaGestao {
  const tasks = o.tasks || [];
  const statusMap = o.status || {};
  const done = tasks.filter((t) => statusMap[t.id]?.done).length;
  const analysis = {
    id: o.id || 'a1', title: o.titulo ?? 'CONTRATAÇÃO DE EMPRESA PARA MANUTENÇÃO DO LAGO', orgao_nome: o.orgao ?? 'Prefeitura de Campinas',
    uf: o.uf ?? 'SP', estimated_value: o.valor ?? 'R$ 120.000,00', score: o.score === undefined ? 72 : o.score,
    datas_criticas: o.datas ?? [{ label: 'Encerramento das propostas', data_iso: '2026-09-28' }],
    decisao: { veredito: o.veredito || 'GO' }, created_at: o.created ?? '2026-09-20T12:00:00Z',
  } as unknown as SavedAnalysis;
  return { analysis, tasks, statusMap, done, total: tasks.length, nextTask: tasks.find((t) => !statusMap[t.id]?.done) || null, stage: o.stage || 'triage' };
}

describe('CabecalhoDaGestao — uma linha', () => {
  it('nome, contagem, os alertas de prazo e a tela cheia; sem selo, gradiente ou frase de ensino', () => {
    const onVencidos = vi.fn();
    const onHojeAmanha = vi.fn();
    const onVerTodos = vi.fn();
    const onTelaCheia = vi.fn();
    const props = { total: 7, vencidos: 5, hojeAmanha: 1, urgencia: 'all' as const, telaCheia: false, onVencidos, onHojeAmanha, onVerTodos, onTelaCheia };
    const html = renderToStaticMarkup(createElement(CabecalhoDaGestao, props));
    expect(html).toContain('Gestão de execução');
    expect(html).toContain('7 editais em acompanhamento');
    expect(html).toContain('prazos vencidos');
    expect(html).toContain('vence hoje ou amanhã');
    expect(html).not.toContain('Ver todos');
    expect(html).not.toContain('aria-pressed="true"');           // nenhum filtro de prazo ligado
    expect(html).not.toContain('Fluxo completo');
    expect(html).not.toContain('uppercase');
    expect(html).not.toContain('gradient');
    const [vencidos, hojeAmanha, telaCheia] = botoes(CabecalhoDaGestao(props));
    expect(texto(vencidos)).toBe('5prazos vencidos');
    clicar(vencidos); clicar(hojeAmanha); clicar(telaCheia);
    expect(onVencidos).toHaveBeenCalledTimes(1);
    expect(onHojeAmanha).toHaveBeenCalledTimes(1);
    expect(onTelaCheia).toHaveBeenCalledTimes(1);
  });

  it('com o filtro de prazo ligado, o botão fica marcado e "Ver todos" aparece; sem alertas, só o nome', () => {
    const onVerTodos = vi.fn();
    const props = { total: 1, vencidos: 1, hojeAmanha: 0, urgencia: 'late' as const, telaCheia: true, onVencidos: () => {}, onHojeAmanha: () => {}, onVerTodos, onTelaCheia: () => {} };
    const html = renderToStaticMarkup(createElement(CabecalhoDaGestao, props));
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*prazo vencido/);
    expect(html).toContain('1 edital em acompanhamento');
    expect(html).toContain('Sair da tela cheia');
    const [, verTodos] = botoes(CabecalhoDaGestao(props));
    expect(texto(verTodos)).toBe('Ver todos');
    clicar(verTodos);
    expect(onVerTodos).toHaveBeenCalledTimes(1);
    const vazio = renderToStaticMarkup(createElement(CabecalhoDaGestao, { ...props, total: 0, vencidos: 0, urgencia: 'all' }));
    expect(vazio).not.toContain('em acompanhamento');
    expect(vazio).not.toContain('vencido');
  });
});

describe('FaixaDeControles — abas, busca e filtros numa linha', () => {
  const base = { abas: createElement('div', { 'data-abas': true }, 'abas'), busca: '', onBusca: () => {}, filtrosAbertos: false, filtrosAtivos: false, visiveis: 7, total: 7, onAlternarFiltros: () => {} };

  it('fechada: abas, busca e o botão com "7 de 7"; nenhum Limpar na linha', () => {
    const html = renderToStaticMarkup(createElement(FaixaDeControles, base));
    expect(html).toContain('data-abas');
    expect(html).toContain('placeholder="Buscar por título');
    expect(html).toContain('7 de 7');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Limpar');
    expect(html).toContain('pl-9 pr-8');                       // o espaço do × já reservado na busca
  });

  it('com filtro ativo: botão verde e "3 de 7", e o Limpar continua fora da linha; a busca ganha o ×', () => {
    const onAlternarFiltros = vi.fn();
    const onBusca = vi.fn();
    const props = { ...base, busca: 'lago', onBusca, filtrosAbertos: true, filtrosAtivos: true, visiveis: 3, onAlternarFiltros };
    const html = renderToStaticMarkup(createElement(FaixaDeControles, props));
    expect(html).toContain('3 de 7');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('value="lago"');
    expect(html).toMatch(/bg-emerald-50 text-emerald-800[^>]*>(?:(?!<\/button>).)*Filtros/);
    expect(html).not.toContain('Limpar filtros');
    expect(html).toContain('aria-label="Limpar a busca"');
    expect(html).toContain('pl-9 pr-8');                       // mesmo padding com e sem o × — a busca não muda de largura
    const [limparBusca, filtros] = botoes(FaixaDeControles(props));
    clicar(limparBusca); clicar(filtros);
    expect(onBusca).toHaveBeenCalledWith('');
    expect(onAlternarFiltros).toHaveBeenCalledTimes(1);
    const input = todos(FaixaDeControles(props), (e) => e.type === 'input')[0];
    (input.props as { onChange: (e: { target: { value: string } }) => void }).onChange({ target: { value: 'novo' } });
    expect(onBusca).toHaveBeenLastCalledWith('novo');
    expect(botoes(FaixaDeControles({ ...props, busca: '' }))).toHaveLength(1);   // sem busca, sem ×
  });

  it('o painel: fechado não renderiza; aberto tem a linha fixa "Etapa" e o "Limpar filtros" só com filtro ativo', () => {
    const onLimpar = vi.fn();
    const filho = createElement('p', null, 'painel');
    expect(renderToStaticMarkup(createElement(PainelDeFiltros, { aberto: false, filtrosAtivos: true, onLimpar, children: filho }))).toBe('');
    const semFiltro = renderToStaticMarkup(createElement(PainelDeFiltros, { aberto: true, filtrosAtivos: false, onLimpar, children: filho }));
    expect(semFiltro).toContain('painel');
    expect(semFiltro).toMatch(/class="mb-1\.5 flex h-6 [^"]*"><span[^>]*>Etapa<\/span><\/div>/);   // a linha existe, com altura fixa
    expect(semFiltro).not.toContain('Limpar');
    const comFiltro = renderToStaticMarkup(createElement(PainelDeFiltros, { aberto: true, filtrosAtivos: true, onLimpar, children: filho }));
    expect(comFiltro).toMatch(/class="mb-1\.5 flex h-6 [^"]*"><span[^>]*>Etapa<\/span><button[^>]*h-6[^>]*>[^]*?Limpar filtros<\/button><\/div>/);
    const [limpar] = botoes(PainelDeFiltros({ aberto: true, filtrosAtivos: true, onLimpar, children: filho }));
    clicar(limpar);
    expect(onLimpar).toHaveBeenCalledTimes(1);
  });
});

describe('ChipDeEtapa e ColunaDoQuadro', () => {
  it('o chip: nome em frase, contagem, escuro quando marcado, desabilitado com zero, apagado fora do recorte', () => {
    const onClick = vi.fn();
    const marcado = renderToStaticMarkup(createElement(ChipDeEtapa, { stage: 'triage', n: 2, selecionada: true, onClick }));
    const desmarcado = renderToStaticMarkup(createElement(ChipDeEtapa, { stage: 'triage', n: 2, selecionada: false, onClick }));
    expect(marcado).toContain('Em triagem');
    expect(marcado).toMatch(/aria-pressed="true"/);
    expect(desmarcado).toMatch(/aria-pressed="false"/);
    expect(marcado).toContain('border-slate-900 bg-slate-900 text-white');
    expect(marcado).toMatch(/>Em triagem<span[^>]*bg-white\/20 text-white[^>]*>2</);
    expect(desmarcado).not.toContain('bg-slate-900');
    // ⚠️ Marcar não muda o tamanho: nada de ✓, nada de anel, mesmo padding.
    for (const html of [marcado, desmarcado]) {
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('ring-');
      expect(html).toContain('rounded-full border py-1 pl-2.5 pr-1.5');
      expect(html).toMatch(/>Em triagem<span class="rounded-full px-1\.5 py-0\.5 text-\[10px\] font-bold leading-none tabular-nums /);
    }
    expect(marcado).not.toContain('uppercase');
    const zero = renderToStaticMarkup(createElement(ChipDeEtapa, { stage: 'pending', n: 0, selecionada: false, onClick }));
    expect(zero).toContain('disabled=""');
    expect(zero).toContain('cursor-not-allowed');
    const fora = renderToStaticMarkup(createElement(ChipDeEtapa, { stage: 'won', n: 3, selecionada: false, noRecorte: false, onClick }));
    expect(fora).toContain('opacity-40 hover:opacity-100');
    expect(fora).not.toContain('<svg');
    clicar(botoes(ChipDeEtapa({ stage: 'won', n: 3, selecionada: false, onClick }))[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a coluna: ponto, nome, contagem, sem número de ordem; vazia diz "Nenhum edital"; final em zinco', () => {
    const html = renderToStaticMarkup(createElement(ColunaDoQuadro, { stage: 'proposal', n: 2, children: createElement('p', null, 'card') }));
    expect(html).toMatch(/<h4[^>]*title="[^"]+"[^>]*>Proposta<\/h4><span[^>]*>2<\/span>/);
    expect(html).toContain('card');
    expect(html).not.toContain('Nenhum edital');
    expect(html).toContain('bg-slate-100/70');
    const vazia = renderToStaticMarkup(createElement(ColunaDoQuadro, { stage: 'won', n: 0, children: createElement('p', null, 'card') }));
    expect(vazia).toContain('Nenhum edital');
    expect(vazia).not.toContain('card');
    expect(vazia).toContain('bg-zinc-100/70');
  });
});

describe('CartaoDoEdital — calmo', () => {
  const t1 = tarefa('t1', 'Conferir habilitação e certidões');
  const t2 = tarefa('t2', 'Montar proposta');
  const base = { hoje: HOJE, onAbrir: () => {}, onAbrirPlano: () => {}, onConcluir: () => {}, onAvancar: () => {}, onLaudo: () => {} };

  it('os selos: score pelo veredito, prazo pela urgência, nada de prazo nos desfechos', () => {
    expect(selosDoCartao(cartao(), HOJE)).toEqual({
      score: { texto: '72', classe: 'bg-emerald-50 text-emerald-700', titulo: 'Score 72 · Go' },
      prazo: { texto: 'Vence em 3 dias', classe: 'bg-amber-50 text-amber-700', titulo: 'Encerramento das propostas: 28 de set.' },
      noGo: false,
    });
    expect(selosDoCartao(cartao({ score: 40, veredito: 'NO_GO', datas: [{ label: 'Sessão pública', data_iso: '2026-09-12' }] }), HOJE)).toMatchObject({
      score: { texto: '40', classe: 'bg-red-50 text-red-700', titulo: 'Score 40 · No-Go' },
      prazo: { texto: 'Venceu há 13 dias', classe: 'bg-red-50 text-red-700 ring-1 ring-red-100' },
      noGo: true,
    });
    expect(selosDoCartao(cartao({ score: 60, veredito: 'GO_CONDICIONADO', datas: [{ label: 'Abertura', data_iso: '2026-09-26' }] }), HOJE)).toMatchObject({
      score: { classe: 'bg-amber-50 text-amber-700', titulo: 'Score 60 · Go com ressalvas' },
      prazo: { texto: 'Vence amanhã', classe: 'bg-red-50 text-red-700' },
    });
    expect(selosDoCartao(cartao({ datas: [{ label: 'Sessão', data_iso: '2026-09-25' }] }), HOJE).prazo?.texto).toBe('Vence hoje');
    expect(selosDoCartao(cartao({ datas: [{ label: 'Sessão', data_iso: '2026-10-20' }] }), HOJE).prazo).toMatchObject({ texto: 'Vence em 25 dias', classe: 'bg-slate-100 text-slate-600' });
    expect(selosDoCartao(cartao({ datas: [{ label: 'Sessão', data_iso: '2026-10-02' }] }), HOJE).prazo).toMatchObject({ texto: 'Vence em 7 dias', classe: 'bg-amber-50 text-amber-700' });
    expect(selosDoCartao(cartao({ datas: [{ label: 'Sessão', data_iso: '2026-10-03' }] }), HOJE).prazo).toMatchObject({ texto: 'Vence em 8 dias', classe: 'bg-slate-100 text-slate-600' });
    expect(selosDoCartao(cartao({ score: null, datas: [] }), HOJE)).toMatchObject({
      score: { texto: '—', classe: 'bg-slate-100 text-slate-500', titulo: 'Sem score · Go' },
      prazo: { texto: 'Sem prazo' },
    });
    expect(selosDoCartao(cartao({ stage: 'won' }), HOJE).prazo).toBeNull();
    expect(selosDoCartao(cartao({ stage: 'lost', veredito: 'NO_GO' }), HOJE).noGo).toBe(false);
  });

  it('a linha sob o título: órgão · UF · valor, só com o que existe', () => {
    expect(linhaDoCartao(cartao())).toBe('Prefeitura de Campinas · SP · R$ 120 mil');
    expect(linhaDoCartao(cartao({ orgao: '', uf: '', valor: 'Não informado' }))).toBe('Órgão não identificado');
    expect(linhaDoCartao(cartao({ valor: 2_500_000 }))).toBe('Prefeitura de Campinas · SP · R$ 2,5 mi');
  });

  it('renderiza: título em frase, a linha, os selos, a próxima ação com "2 de 3", o rodapé; sem caixa "Resumo do edital" nem chip da etapa', () => {
    const c = cartao({ tasks: [t1, t2, tarefa('t3', 'Enviar')], status: { t1: { done: true } } });
    const html = renderToStaticMarkup(createElement(CartaoDoEdital, { ...base, card: c }));
    expect(html).toContain('Contratação de empresa para manutenção do lago');
    expect(html).toContain('Prefeitura de Campinas · SP · R$ 120 mil');
    expect(html).toMatch(/title="Score 72 · Go">72</);
    expect(html).toContain('Vence em 3 dias');
    expect(html).toContain('Próxima ação · 2 de 3');
    expect(html).toContain('Montar proposta');
    expect(html).toContain('1/3 ações');
    expect(html).toContain('title="Analisado em 20 de set."');
    expect(html).toContain('Laudo');
    expect(html).toContain('title="Avançar para Pendência"');
    expect(html).not.toContain('Resumo do edital');
    expect(html).not.toContain('Em triagem');                  // a coluna já diz
    expect(html).not.toContain('uppercase');
    expect((html.match(/1\/3|2 de 3/g) || []).length).toBe(2);   // cada número uma vez
  });

  it('os cliques: o corpo abre o resumo; concluir e o texto da ação não vazam para o corpo; Avançar manda a etapa seguinte', () => {
    const onAbrir = vi.fn();
    const onAbrirPlano = vi.fn();
    const onConcluir = vi.fn();
    const onAvancar = vi.fn();
    const onLaudo = vi.fn();
    const c = cartao({ tasks: [t1, t2] });
    const arvore = CartaoDoEdital({ ...base, card: c, onAbrir, onAbrirPlano, onConcluir, onAvancar, onLaudo });
    const corpo = todos(arvore, (e) => (e.props as { role?: string }).role === 'button')[0];
    (corpo.props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledTimes(1);
    const [concluir, plano, laudo, avancar] = botoes(arvore);
    clicar(concluir); clicar(plano); clicar(laudo); clicar(avancar);
    expect(onConcluir).toHaveBeenCalledTimes(1);
    expect(onAbrirPlano).toHaveBeenCalledTimes(1);
    expect(onLaudo).toHaveBeenCalledTimes(1);
    expect(onAvancar).toHaveBeenCalledWith('pending');
    expect(onAbrir).toHaveBeenCalledTimes(1);                 // os botões internos não propagam
    (corpo.props as { onKeyDown: (e: { key: string; preventDefault: () => void }) => void }).onKeyDown({ key: 'Enter', preventDefault: () => {} });
    expect(onAbrir).toHaveBeenCalledTimes(2);
  });

  it('sem plano, plano concluído, desfecho com resultado e vigência, mudança no PNCP, salvando', () => {
    const semPlano = renderToStaticMarkup(createElement(CartaoDoEdital, { ...base, card: cartao() }));
    expect(semPlano).toContain('Sem plano de ações no laudo');
    expect(semPlano).toContain('Sem ações');
    const concluido = renderToStaticMarkup(createElement(CartaoDoEdital, { ...base, card: cartao({ tasks: [t1], status: { t1: { done: true } } }) }));
    expect(concluido).toContain('Plano concluído');
    expect(concluido).toContain('1/1 ações');
    const ganho = renderToStaticMarkup(createElement(CartaoDoEdital, { ...base, card: cartao({ stage: 'won', veredito: 'NO_GO' }), sinais: { resultado: 'Ganho', resultadoAutomatico: true, vigencia: { label: 'Vigência até 12/2027', className: 'border-emerald-100 bg-emerald-50 text-emerald-800' }, mudouNoPncp: true } }));
    expect(ganho).toContain('Ganho · PNCP');
    expect(ganho).toContain('Vigência até 12/2027');
    expect(ganho).toContain('Mudou no PNCP');
    expect(ganho).not.toContain('Vence');
    expect(ganho).not.toContain('>No-Go<');                    // no desfecho o veredito não grita
    expect(ganho).not.toContain('Avançar');                    // etapa final
    const noGo = renderToStaticMarkup(createElement(CartaoDoEdital, { ...base, card: cartao({ veredito: 'NO_GO', score: 30 }) }));
    expect(noGo).toContain('>No-Go<');
    const salvando = CartaoDoEdital({ ...base, card: cartao({ tasks: [t1] }), salvandoTarefa: true, salvandoEtapa: true, abrindoLaudo: true });
    const html = renderToStaticMarkup(salvando);
    expect((html.match(/animate-spin/g) || []).length).toBe(3);
    expect(botoes(salvando).filter((b) => (b.props as { disabled?: boolean }).disabled)).toHaveLength(3);
  });
});
