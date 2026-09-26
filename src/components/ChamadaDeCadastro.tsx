'use client';

// `React` no escopo: o vitest compila o JSX no modo clássico (ver os testes).
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { ReguaInfo } from '@/Contexts/TierContext';
import { unidadeCota } from '@/lib/unidadeCota';
import { ofertaDaCampanha, type Oferta } from '@/lib/promo';
import { usePromoPublica } from '@/lib/promoPublica';
import { publicoDaPromo } from '@/components/PromoModal';

/**
 * A coluna direita do herói da home: a chamada para criar a conta gratuita.
 *
 * ⚠️ AQUI MORAVA A DEGUSTAÇÃO — "1 análise grátis por dia · sem cadastro" —,
 * que saiu em 26/09/2026, da tela e do servidor. Marcelo: "essa análise aqui
 * não faz sentido, podemos remover". Sem ela, o caminho que sobra para quem
 * chega é o de verdade: criar a conta gratuita, sabendo o que ela dá, ou entrar.
 *
 * O que a conta dá sai das MESMAS fontes dos cards de plano, mais abaixo na
 * página: a cota vem de `/api/tiers/limites-publicos` (a home já busca e
 * repassa) e a lista é a do card Gratuito. Número e lista escritos de novo
 * aqui divergiriam no primeiro ajuste de plano — foi assim que o "5 análises
 * por mês" desta página virou mentira.
 */

/** A linha que o card Gratuito imprime para a cota, sem o que for de outro plano. */
export interface LimiteDoGratuito {
  monthly_limit: number;
  ilimitado: boolean;
  peso_profunda?: number;
}

/** "5 análises rápidas grátis por mês", na palavra que os cards usam
 *  (`unidadeCota`). `null` enquanto o servidor não responde: sem número
 *  escrito à mão, a linha simplesmente não aparece. */
export function cotaDoGratuito(
  lim: LimiteDoGratuito | null | undefined,
  regua: ReguaInfo | null | undefined,
): string | null {
  if (!lim) return null;
  if (lim.ilimitado) return 'Análises ilimitadas';
  const n = Number(lim.monthly_limit) || 0;
  if (n <= 0) return null;
  // Mesma montagem do card: o peso da profunda é o DESTE nível, não o do
  // menor plano pago que a régua global carrega.
  const reguaDoNivel: ReguaInfo = {
    tipo: regua?.tipo ?? 'fixa',
    caracteres_por_credito: regua?.caracteres_por_credito ?? null,
    peso_profunda: lim.peso_profunda ?? null,
    peso_por_plano: [],
  };
  return `${n.toLocaleString('pt-BR')} ${unidadeCota(reguaDoNivel, n)} grátis por mês`;
}

/** O link do cadastro, com a campanha junto.
 *
 *  ⚠️ SEM O CÓDIGO NA URL, A CAMPANHA SÓ CREDITA QUEM CHEGOU PELO LINK DELA.
 *  `campanhaAtual()` guarda o `?campanha=` da URL de entrada; quem veio de
 *  busca orgânica e viu a oferta AQUI não tem código guardado. Anunciar o
 *  bônus e não passar o código seria prometer na tela o que o cadastro nega. */
export function linkDeCadastro(codigoCampanha?: string): string {
  const q = new URLSearchParams({ view: 'register' });
  if (codigoCampanha) q.set('campanha', codigoCampanha);
  return `/login?${q.toString()}`;
}

export interface CorpoDaChamadaProps {
  /** De `cotaDoGratuito`; `null` esconde a linha. */
  cota: string | null;
  /** O que a conta gratuita inclui: a lista do card Gratuito. */
  itens: readonly string[];
  /** Campanha pública ativa para quem não tem sessão (`null` = nenhuma). */
  oferta: Oferta | null;
  codigoCampanha: string;
  vagasRestantes: number | null;
}

/** O bloco em si, sem hook: renderizável e testável fora do navegador. */
export function CorpoDaChamada({ cota, itens, oferta, codigoCampanha, vagasRestantes }: CorpoDaChamadaProps) {
  return (
    <div className="w-full min-w-0">
      {/* ⚠️ A COLUNA ESPELHA A DA ESQUERDA, LINHA A LINHA (26/09/2026).
          Marcelo: "deixe mais harmônico". Eram dois sistemas lado a lado: um
          selo em pílula contra o sobretítulo em texto, o cartão começando
          abaixo da manchete e terminando uns 100px depois do último texto da
          esquerda, um segundo título de 26px disputando com o H1, e um
          parágrafo que repetia o da esquerda ("lê o edital… devolve um
          veredito").

          Agora: o sobretítulo tem a MESMA classe e a mesma altura do da
          esquerda; o cartão entra com o mesmo `mt-5` do H1, então os dois
          começam na mesma linha; o título é um degrau abaixo do H1, na mesma
          família (black, tracking negativo); e, sem o parágrafo repetido, o
          cartão termina onde termina o último texto da esquerda — medido a
          1440px: 333px de cartão para 334px do H1 ao fim do texto. */}
      <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>
        Conta gratuita
      </p>

      <div
        className="mt-5 w-full rounded-3xl border border-[#EAE7E1] bg-white px-6 py-5"
        style={{ boxShadow: '0 1px 2px rgba(31,41,55,0.04), 0 14px 30px -16px rgba(31,41,55,0.18)' }}
      >
        <h2 className="text-[22px] font-black leading-[1.2] tracking-[-0.02em]" style={{ color: '#111827' }}>
          Comece pelo seu próximo edital.
        </h2>

        {(cota || oferta) && (
          <div className="mt-2 space-y-1">
            {cota && (
              <p className="text-[14px] font-bold" style={{ color: '#047857' }}>{cota}</p>
            )}
            {oferta && (
              <p className="text-[13px] font-medium leading-[1.5]" style={{ color: '#4B5563' }}>
                Com a campanha:{' '}
                <strong className="font-black" style={{ color: '#111827' }}>
                  {oferta.valor.replace(/^\+/, '')} de bônus
                </strong>{' '}
                {oferta.prazo}.
              </p>
            )}
          </div>
        )}

        {/* Filete em vez de mais espaço: separa "o que é" de "o que vem",
            como nos cards de plano mais abaixo. */}
        <ul className="mt-4 space-y-1.5 border-t pt-4" style={{ borderColor: '#EFECE6' }}>
          {itens.map((item) => (
            <li key={item} className="flex gap-2.5 text-[14px] font-medium leading-[22px]" style={{ color: '#4B5563' }}>
              <Check size={15} className="mt-[4px] shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>

        {/* h-12 e cantos de 12px: o botão de 56px e 16px era da caixa de
            análise, maior; dentro de um cartão de 24px de canto e 24px de
            respiro, o canto interno menor é o que fecha a geometria. */}
        <Link
          href={linkDeCadastro(codigoCampanha)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-black text-white transition-all hover:bg-emerald-500"
          style={{ background: '#059669', boxShadow: '0 8px 18px -8px rgba(5,150,105,0.55)' }}
        >
          {oferta ? 'Criar conta e resgatar' : 'Criar conta grátis'} <ArrowRight size={16} />
        </Link>
        {oferta && vagasRestantes !== null && (
          <p className="mt-2 text-center text-[11px] font-black tabular-nums" style={{ color: '#059669' }}>
            {vagasRestantes.toLocaleString('pt-BR')} {vagasRestantes === 1 ? 'vaga restante' : 'vagas restantes'}
          </p>
        )}

        <p className="mt-3 text-center text-[13px] font-medium" style={{ color: '#6B6559' }}>
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-bold underline decoration-emerald-300 underline-offset-4 transition-colors hover:decoration-emerald-600"
            style={{ color: '#047857' }}
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Com a campanha pública ativa, se houver — só a que é para quem não tem
 *  sessão, como no banner e no pop-up (`publicoDaPromo`). */
export default function ChamadaDeCadastro({ cota, itens }: { cota: string | null; itens: readonly string[] }) {
  const promo = usePromoPublica();
  const oferta = promo && publicoDaPromo(promo) !== 'logado' ? ofertaDaCampanha(promo) : null;
  const codigoCampanha = oferta ? (promo?.coupon_code || '') : '';
  const vagasRestantes = oferta && typeof promo?.vagas_restantes === 'number' ? promo.vagas_restantes : null;
  return (
    <CorpoDaChamada
      cota={cota}
      itens={itens}
      oferta={oferta}
      codigoCampanha={codigoCampanha}
      vagasRestantes={vagasRestantes}
    />
  );
}
