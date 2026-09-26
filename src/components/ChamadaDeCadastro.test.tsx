import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReguaInfo } from '@/Contexts/TierContext';
import type { DadosPromo } from '@/lib/promo';
import ChamadaDeCadastro, {
  CorpoDaChamada, cotaDoGratuito, linkDeCadastro, type CorpoDaChamadaProps,
} from './ChamadaDeCadastro';

// A campanha pública chega por hook (fetch no navegador). Aqui ela é servida
// na hora, para o componente de verdade decidir o que mostrar.
const estado = vi.hoisted(() => ({ promo: null as DadosPromo | null }));
vi.mock('@/lib/promoPublica', () => ({ usePromoPublica: () => estado.promo }));

/* A coluna direita do herói depois que a análise gratuita sem cadastro saiu
 * (26/09/2026): uma chamada para a conta gratuita, dizendo o que ela dá. */

const FIXA: ReguaInfo = { tipo: 'fixa', caracteres_por_credito: null, peso_profunda: 4, peso_por_plano: [] };
const ITENS = ['Análise completa de edital', 'Veredito Go/No-Go com justificativa',
  'Histórico de análises salvo', 'Sem cartão de crédito'];

function props(o: Partial<CorpoDaChamadaProps> = {}): CorpoDaChamadaProps {
  return { cota: '5 análises rápidas grátis por mês', itens: ITENS, oferta: null,
    codigoCampanha: '', vagasRestantes: null, ...o };
}
const html = (o: Partial<CorpoDaChamadaProps> = {}) => renderToStaticMarkup(createElement(CorpoDaChamada, props(o)));

describe('cotaDoGratuito', () => {
  it('a palavra dos cards: análise rápida quando a profunda pesa mais', () => {
    expect(cotaDoGratuito({ monthly_limit: 5, ilimitado: false, peso_profunda: 4 }, FIXA))
      .toBe('5 análises rápidas grátis por mês');
    expect(cotaDoGratuito({ monthly_limit: 1, ilimitado: false, peso_profunda: 4 }, FIXA))
      .toBe('1 análise rápida grátis por mês');
  });

  it('o peso é o do nível, não o da régua global', () => {
    expect(cotaDoGratuito({ monthly_limit: 5, ilimitado: false, peso_profunda: 1 }, FIXA))
      .toBe('5 análises grátis por mês');
  });

  it('na régua por custo a palavra volta a ser crédito', () => {
    expect(cotaDoGratuito({ monthly_limit: 1200, ilimitado: false, peso_profunda: 4 }, { ...FIXA, tipo: 'custo' }))
      .toBe('1.200 créditos grátis por mês');
  });

  it('sem resposta do servidor não inventa número', () => {
    expect(cotaDoGratuito(null, FIXA)).toBeNull();
    expect(cotaDoGratuito(undefined, null)).toBeNull();
    expect(cotaDoGratuito({ monthly_limit: 0, ilimitado: false }, FIXA)).toBeNull();
    expect(cotaDoGratuito({ monthly_limit: 0, ilimitado: true }, FIXA)).toBe('Análises ilimitadas');
  });
});

describe('linkDeCadastro', () => {
  it('abre o cadastro, e leva a campanha quando há uma', () => {
    expect(linkDeCadastro()).toBe('/login?view=register');
    expect(linkDeCadastro('')).toBe('/login?view=register');
    expect(linkDeCadastro('LANCAMENTO')).toBe('/login?view=register&campanha=LANCAMENTO');
  });
});

describe('CorpoDaChamada', () => {
  it('as duas portas: criar a conta gratuita ou entrar', () => {
    const h = html();
    expect(h).toContain('Criar conta grátis');
    expect(h).toContain('href="/login?view=register"');
    expect(h).toMatch(/href="\/login"[^>]*>Entrar<\/a>/);
  });

  it('diz o que a conta dá: a cota e a lista do card Gratuito', () => {
    const h = html();
    expect(h).toContain('5 análises rápidas grátis por mês');
    for (const item of ITENS) expect(h).toContain(item);
  });

  it('sem cota do servidor, a linha some', () => {
    expect(html({ cota: null })).not.toContain('grátis por mês');
  });

  it('não promete mais nada sem cadastro', () => {
    const h = html().toLowerCase();
    expect(h).not.toContain('sem cadastro');
    expect(h).not.toContain('por dia');
    expect(h).not.toContain('analisar gratuitamente');
  });

  it('com campanha: o bônus, o código no link e as vagas', () => {
    const h = html({
      oferta: { valor: '+50 créditos', cadencia: 'de uma vez só', prazo: 'para usar em 30 dias' },
      codigoCampanha: 'LANCAMENTO', vagasRestantes: 137,
    });
    expect(h).toContain('Criar conta e resgatar');
    expect(h).toContain('href="/login?view=register&amp;campanha=LANCAMENTO"');
    expect(h).toContain('50 créditos de bônus');
    expect(h).toContain('para usar em 30 dias');
    expect(h).toContain('137 vagas restantes');
    expect(html({
      oferta: { valor: '+50 créditos', cadencia: '', prazo: 'para usar em 30 dias' },
      codigoCampanha: 'LANCAMENTO', vagasRestantes: 1,
    })).toContain('1 vaga restante');
  });

  it('sem campanha, nada de bônus nem vagas', () => {
    const h = html({ vagasRestantes: 137 });
    expect(h).not.toContain('bônus');
    expect(h).not.toContain('vagas restantes');
  });
});

describe('a home sem a análise gratuita', () => {
  const home = readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf8');

  it('não analisa nem pergunta a cota do visitante', () => {
    expect(home).not.toContain('/api/analyze');
    expect(home).not.toContain('guest-limit');
    expect(home).not.toContain('TasterSection');
  });

  it('a coluna direita do herói é a chamada, com a cota e a lista do card Gratuito', () => {
    expect(home).toMatch(/<ChamadaDeCadastro[\s\S]*?cota=\{cotaDoGratuito\(limitesHome\?\.\['1'\], reguaHome\)\}/);
    expect(home).toMatch(/<ChamadaDeCadastro[\s\S]*?itens=\{PLANOS\[0\]\.itens\}/);
    expect(home).toMatch(/nome: 'Gratuito',[\s\S]*?itens: \[/);
  });
});

describe('ChamadaDeCadastro (com a campanha pública)', () => {
  const CAMPANHA = {
    active: true, origem: 'campanha', bonus_creditos: 50, validade_dias: 30,
    coupon_code: 'LANCAMENTO', vagas_restantes: 137,
  } as DadosPromo;
  const render = () => renderToStaticMarkup(createElement(ChamadaDeCadastro, { cota: null, itens: ITENS }));

  it('campanha para quem não tem sessão: o bônus, o código no link e as vagas', () => {
    estado.promo = CAMPANHA;
    const h = render();
    expect(h).toContain('href="/login?view=register&amp;campanha=LANCAMENTO"');
    expect(h).toContain('50 créditos de bônus');
    expect(h).toContain('para usar em 30 dias');
    expect(h).toContain('137 vagas restantes');
  });

  it('campanha só para quem já tem sessão não aparece aqui', () => {
    estado.promo = { ...CAMPANHA, exibir_para: 'logado' } as DadosPromo;
    const h = render();
    expect(h).toContain('href="/login?view=register"');
    expect(h).not.toContain('campanha=');
    expect(h).not.toContain('bônus');
  });

  it('cupom não é campanha: sem bônus e sem código no cadastro', () => {
    estado.promo = { ...CAMPANHA, origem: 'cupom' } as DadosPromo;
    const h = render();
    expect(h).not.toContain('campanha=');
    expect(h).not.toContain('vagas restantes');
  });

  it('sem promoção nenhuma: as duas portas, e só', () => {
    estado.promo = null;
    const h = render();
    expect(h).toContain('Criar conta grátis');
    expect(h).toContain('href="/login?view=register"');
  });
});
