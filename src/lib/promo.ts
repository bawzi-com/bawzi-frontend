/**
 * A promoção: paleta compartilhada e a frase honesta da oferta.
 *
 * ⚠️ POR QUE ISTO SAIU DE DENTRO DO COMPONENTE. O mapa de cores morava em
 * `PromoBanner.tsx`. Com o pop-up, duas telas precisam da MESMA cor — e
 * `PromoModal` importar de `PromoBanner`, que importa `PromoModal`, é um ciclo.
 * Copiar o mapa resolveria hoje e divergiria na primeira vez que alguém
 * adicionasse uma cor em um só dos dois.
 */

export type CorPromo = 'emerald' | 'amber' | 'violet' | 'rose' | 'sky';

export interface PaletaPromo {
  // ── barra (banner) ──
  bar: string; badge: string; btn: string; text: string; subtext: string; copy: string;
  // ── cartão (pop-up) ── o modal é branco; a cor entra só nos acentos
  forte: string;   // botão primário
  tinta: string;   // texto de destaque
  suave: string;   // fundo do bloco da oferta
  trilho: string;  // preenchimento da barra de vagas
}

export const CORES_PROMO: Record<string, PaletaPromo> = {
  emerald: {
    bar:     'bg-gradient-to-r from-emerald-600 to-emerald-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-emerald-700 hover:bg-emerald-50',
    text:    'text-white',
    subtext: 'text-emerald-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
    forte:   'bg-emerald-600 hover:bg-emerald-700',
    tinta:   'text-emerald-700',
    suave:   'bg-emerald-50 border-emerald-200',
    trilho:  'bg-emerald-500',
  },
  amber: {
    bar:     'bg-gradient-to-r from-amber-500 to-amber-400',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-amber-700 hover:bg-amber-50',
    text:    'text-white',
    subtext: 'text-amber-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
    forte:   'bg-amber-500 hover:bg-amber-600',
    tinta:   'text-amber-700',
    suave:   'bg-amber-50 border-amber-200',
    trilho:  'bg-amber-500',
  },
  violet: {
    bar:     'bg-gradient-to-r from-violet-600 to-violet-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-violet-700 hover:bg-violet-50',
    text:    'text-white',
    subtext: 'text-violet-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
    forte:   'bg-violet-600 hover:bg-violet-700',
    tinta:   'text-violet-700',
    suave:   'bg-violet-50 border-violet-200',
    trilho:  'bg-violet-500',
  },
  rose: {
    bar:     'bg-gradient-to-r from-rose-600 to-rose-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-rose-700 hover:bg-rose-50',
    text:    'text-white',
    subtext: 'text-rose-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
    forte:   'bg-rose-600 hover:bg-rose-700',
    tinta:   'text-rose-700',
    suave:   'bg-rose-50 border-rose-200',
    trilho:  'bg-rose-500',
  },
  sky: {
    bar:     'bg-gradient-to-r from-sky-600 to-sky-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-sky-700 hover:bg-sky-50',
    text:    'text-white',
    subtext: 'text-sky-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
    forte:   'bg-sky-600 hover:bg-sky-700',
    tinta:   'text-sky-700',
    suave:   'bg-sky-50 border-sky-200',
    trilho:  'bg-sky-500',
  },
};

export function paletaPromo(cor?: string | null): PaletaPromo {
  return CORES_PROMO[cor || 'emerald'] ?? CORES_PROMO.emerald;
}

export interface DadosPromo {
  active: boolean;
  title?: string;
  description?: string;
  coupon_code?: string;
  discount_label?: string;
  color?: string;
  expires_at?: string | null;
  link_text?: string | null;
  link_url?: string | null;
  dismissible?: boolean;
  origem?: 'campanha' | 'cupom';
  bonus_creditos?: number;
  validade_dias?: number;
  vagas_restantes?: number;
  vagas_total?: number;
  modo?: string;
  duracao_meses?: number;
  tipo_valor?: string;
  bonus_percentual?: number;
}

export interface Oferta {
  /** O que entra na conta: "+50 créditos" ou "+20% de créditos". */
  valor: string;
  /** Com que frequência: "de uma vez só" ou "todo ciclo". */
  cadencia: string;
  /** Até quando: "para usar em 30 dias", "durante 12 meses", "enquanto for cliente". */
  prazo: string;
}

const plural = (n: number, um: string, muitos: string) =>
  `${n.toLocaleString('pt-BR')} ${n === 1 ? um : muitos}`;

/**
 * A oferta, montada a partir dos campos que o backend REALMENTE honra.
 *
 * ⚠️ POR QUE NÃO BASTA O `title` QUE O ADMIN DIGITOU. O título e a descrição
 * são texto livre — quem escreve pode errar, ou a campanha pode ser editada
 * depois sem alguém lembrar de reescrever a frase. Estes campos (`modo`,
 * `tipo_valor`, `bonus_creditos`, `validade_dias`, `duracao_meses`) são os
 * MESMOS que `conceder_bonus` lê na hora de creditar. O texto derivado deles
 * não pode divergir do que a conta vai receber.
 *
 * ⚠️ E A COERÇÃO ABAIXO É OBRIGATÓRIA, NÃO ZELO. `conceder_bonus` rebaixa
 * `percentual` para `fixo` quando o modo não é recorrente — um POTE é uma
 * quantidade entregue, e resolver a porcentagem a cada leitura faria o saldo
 * pular quando a pessoa mudasse de plano. Se esta função não repetisse a mesma
 * regra, uma campanha `unico` + `percentual` anunciaria "+20% de créditos" no
 * pop-up e depositaria `bonus_creditos` na conta. A tela prometeria uma coisa
 * e o sistema entregaria outra — exatamente o defeito que o banner de cupom
 * tem e que a campanha existe para não ter.
 */
export function ofertaDaCampanha(d: DadosPromo): Oferta | null {
  if (d.origem !== 'campanha') return null;

  const recorrente = String(d.modo || 'unico').toLowerCase() === 'recorrente';
  const tipoBruto = String(d.tipo_valor || 'fixo').toLowerCase();
  const percentual = tipoBruto === 'percentual' && recorrente;   // ← a coerção

  const creditos = Math.max(0, Number(d.bonus_creditos) || 0);
  const pct = Math.max(0, Number(d.bonus_percentual) || 0);

  // Sem número não há oferta para anunciar — melhor mostrar só o título do
  // que inventar "+0 créditos".
  if (percentual ? pct <= 0 : creditos <= 0) return null;

  const valor = percentual
    ? `+${pct}% de créditos`
    : `+${plural(creditos, 'crédito', 'créditos')}`;

  if (recorrente) {
    const meses = Math.max(0, Number(d.duracao_meses) || 0);
    return {
      valor,
      cadencia: 'todo ciclo, junto com a cota do seu plano',
      // `duracao_meses = 0` é "sem data de fim" no backend, e ali isso quer
      // dizer "enquanto o workspace for pagante" — não "para sempre".
      prazo: meses > 0 ? `durante ${plural(meses, 'mês', 'meses')}` : 'enquanto você for cliente',
    };
  }

  const dias = Math.max(1, Number(d.validade_dias) || 30);
  return {
    valor,
    cadencia: 'de uma vez só, na criação da conta',
    prazo: `para usar em ${plural(dias, 'dia', 'dias')}`,
  };
}

/**
 * Rotas em que o pop-up NÃO interrompe.
 *
 * ⚠️ CADA UMA DESTAS É ALGUÉM NO MEIO DE UMA TAREFA. O pior caso é
 * `/convite`: a pessoa foi convidada para um workspace que já existe e está a
 * um clique de entrar nele — receber ali um modal dizendo "crie uma conta e
 * ganhe créditos" empurra para o caminho ERRADO, porque aceitar o convite e
 * criar conta nova são coisas diferentes e ela sai do workspace se escolher
 * errado. Recuperar senha é o mesmo tipo de momento: ninguém está avaliando
 * uma oferta, está tentando voltar para dentro.
 */
export const ROTAS_SEM_POPUP = [
  '/convite',
  '/reset-password',
  '/forgot-password',
  '/promo',
  '/swagger',
  '/docs',
];

export function rotaAceitaPopup(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !ROTAS_SEM_POPUP.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}
