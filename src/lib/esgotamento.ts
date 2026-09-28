/**
 * O que acontece quando o saldo E a margem de cortesia acabam (28/09/2026).
 *
 * A regra mora no servidor (`/api/analyze`) e a cota a devolve pronta
 * (`/api/analyses/quota`): no plano Gratuito as análises PARAM — o portão
 * responde 403 —; nos planos pagos elas seguem no motor simples, sem auditoria
 * profunda, até um teto por dia. Antes disso toda tela prometia "as análises
 * continuam, sem limite", e para o Gratuito a promessa virou mentira: o botão
 * convidaria a um clique que o servidor recusa.
 *
 * Uma função pura por frase, para as três telas que falam do assunto (barra de
 * cota, seletor de modo, carteira) não voltarem a dizer coisas diferentes.
 */

export interface CotaDeEsgotamento {
  /** O plano PARA quando saldo e cortesia acabam (Gratuito). */
  para_ao_esgotar?: boolean;
  /** Teto diário do motor simples para quem paga; `null` no Gratuito. */
  limite_diario_motor_simples?: number | null;
  /** Saldo zerado E cortesia do período esgotada. */
  profunda_pausada?: boolean;
  dias_para_reset?: number;
}

export interface AvisoDeEsgotamento {
  tom: 'pausado' | 'motor';
  rotulo: string;
  texto: string;
}

function ateARenovacao(dias?: number): string {
  const n = Math.max(0, Number(dias ?? 0));
  return `${n} dia${n !== 1 ? 's' : ''} até a renovação`;
}

/** `, até 30 por dia` quando o servidor manda o teto; vazio quando não manda. */
export function tetoDoMotorSimples(q?: CotaDeEsgotamento | null): string {
  const teto = Number(q?.limite_diario_motor_simples ?? 0);
  return teto > 0 ? `, até ${teto} por dia` : '';
}

/** As análises vão ser RECUSADAS? `alemDaCortesia` é o pedido da tela passando
 *  do teto de cortesia; `profunda_pausada` é o período que já passou dele. */
export function analisesPausadas(q: CotaDeEsgotamento | null | undefined, alemDaCortesia: boolean): boolean {
  return !!q?.para_ao_esgotar && (alemDaCortesia || !!q?.profunda_pausada);
}

/** O aviso da barra de cota quando saldo e cortesia acabaram; `null` antes disso. */
export function avisoDeEsgotamento(q?: CotaDeEsgotamento | null): AvisoDeEsgotamento | null {
  if (!q?.profunda_pausada) return null;
  if (q.para_ao_esgotar) {
    return {
      tom: 'pausado',
      rotulo: '⛔ Análises pausadas',
      texto: 'Os créditos deste mês e a margem de cortesia acabaram. No plano Gratuito as '
        + 'análises param aqui: adicione créditos ou escolha um plano para seguir agora, ou '
        + `aguarde ${ateARenovacao(q.dias_para_reset)}.`,
    };
  }
  return {
    tom: 'motor',
    rotulo: '🆓 Rodando no motor gratuito',
    texto: 'As análises continuam funcionando, agora no motor gratuito e sem auditoria '
      + `profunda${tetoDoMotorSimples(q)}. Adicione créditos para voltar ao motor completo, `
      + `ou aguarde ${ateARenovacao(q.dias_para_reset)}.`,
  };
}

/** A frase curta da carteira para o Gratuito pausado; `null` em qualquer outro
 *  estado (cada tela mantém a sua frase para a cortesia e o motor simples). */
export function pausaDoGratuito(q?: CotaDeEsgotamento | null): string | null {
  if (!q?.profunda_pausada || !q.para_ao_esgotar) return null;
  return 'O saldo e a margem de cortesia acabaram — no plano Gratuito as análises estão '
    + 'pausadas até a renovação ou até você adicionar créditos.';
}
