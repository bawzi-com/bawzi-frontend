import { describe, expect, it } from 'vitest';
import {
  alternarAviso, alternarCanal, canalLigado, corpoDasPreferencias, fraseDosCanais, horario, trocarAgenda,
  type TipoAlerta,
} from './alertas';

/* A tela de Alertas (26/09/2026): o que vai para o servidor e o que muda na
 * lista quando se liga ou desliga um aviso ou um canal. */

function tipo(o: Partial<TipoAlerta> & { tipo: string }): TipoAlerta {
  return { nome: o.tipo, descricao: '', porque: '', quando: '', origem: 'agendado', grupo: 'x', ativo: true, ...o };
}

const lista = [
  tipo({ tipo: 'radar_alerta', canais: ['push', 'email'], canais_ativos: { push: true, email: true } }),
  tipo({ tipo: 'disputa_abrindo', canais: ['push'], canais_ativos: {} }),
  tipo({ tipo: 'prazo', canais: [] }),
  tipo({ tipo: 'decisao' }),                                // cliente velho do servidor: sem `canais`
];

describe('lib/alertas', () => {
  it('canal ligado: ausência é ligado, só `false` desliga', () => {
    expect(canalLigado(lista[0], 'email')).toBe(true);
    expect(canalLigado(lista[1], 'push')).toBe(true);
    expect(canalLigado(tipo({ tipo: 'x', canais: ['email'], canais_ativos: { email: false } }), 'email')).toBe(false);
  });

  it('o corpo do PUT leva os dois mapas completos, e só os avisos com canal entram em `canais`', () => {
    expect(corpoDasPreferencias(lista)).toEqual({
      tipos: { radar_alerta: true, disputa_abrindo: true, prazo: true, decisao: true },
      canais: { radar_alerta: { push: true, email: true }, disputa_abrindo: { push: true } },
    });
  });

  it('alternar o aviso não mexe nos canais; alternar um canal não mexe no aviso nem nos outros', () => {
    const semRadar = alternarAviso(lista, 'radar_alerta');
    expect(semRadar[0].ativo).toBe(false);
    expect(semRadar[0].canais_ativos).toEqual({ push: true, email: true });
    expect(semRadar.slice(1)).toEqual(lista.slice(1));
    const semEmail = alternarCanal(lista, 'radar_alerta', 'email');
    expect(semEmail[0]).toMatchObject({ ativo: true, canais_ativos: { push: true, email: false } });
    expect(semEmail.slice(1)).toEqual(lista.slice(1));
    expect(alternarCanal(semEmail, 'radar_alerta', 'email')[0].canais_ativos).toEqual({ push: true, email: true });
    // Canal que o aviso não usa: nada muda (não existe interruptor para ele).
    expect(alternarCanal(lista, 'prazo', 'email')).toEqual(lista);
    expect(alternarCanal(lista, 'disputa_abrindo', 'email')).toEqual(lista);
    expect(corpoDasPreferencias(semEmail).canais.radar_alerta).toEqual({ push: true, email: false });
  });

  it('a hora dos resumos diários vai no corpo, e só quando existe', () => {
    const comHora = [
      tipo({ tipo: 'radar_alerta', agenda: { hora: 18, minuto: 0, frequencia: 'dias_uteis' } }),
      tipo({ tipo: 'disputa_abrindo', agenda: { hora: 7, minuto: 20, frequencia: 'todo_dia' } }),
      tipo({ tipo: 'prazo' }),
    ];
    // O minuto é do job: não vai para o servidor.
    expect(corpoDasPreferencias(comHora).agenda).toEqual({
      radar_alerta: { hora: 18, frequencia: 'dias_uteis' },
      disputa_abrindo: { hora: 7, frequencia: 'todo_dia' },
    });
    // Servidor anterior (nenhum aviso com hora): o campo nem vai — um mapa
    // vazio apagaria as horas salvas.
    expect('agenda' in corpoDasPreferencias(lista)).toBe(false);
  });

  it('trocar a hora ou os dias mexe só naquele resumo', () => {
    const comHora = [
      tipo({ tipo: 'radar_alerta', agenda: { hora: 7, minuto: 0, frequencia: 'todo_dia' } }),
      tipo({ tipo: 'disputa_abrindo', agenda: { hora: 7, minuto: 20, frequencia: 'todo_dia' } }),
      tipo({ tipo: 'prazo' }),
    ];
    const as18 = trocarAgenda(comHora, 'radar_alerta', { hora: 18 });
    expect(as18[0].agenda).toEqual({ hora: 18, minuto: 0, frequencia: 'todo_dia' });
    expect(as18.slice(1)).toEqual(comHora.slice(1));
    expect(trocarAgenda(as18, 'radar_alerta', { frequencia: 'dias_uteis' })[0].agenda)
      .toEqual({ hora: 18, minuto: 0, frequencia: 'dias_uteis' });
    // Aviso sem hora própria: nada muda (não existe seletor para ele).
    expect(trocarAgenda(comHora, 'prazo', { hora: 9 })).toEqual(comHora);
  });

  it('a grafia da hora é a do catálogo', () => {
    expect(horario(7)).toBe('07h00');
    expect(horario(9, 20)).toBe('09h20');
    expect(horario(22, 0)).toBe('22h00');
  });

  it('a frase de por onde chega', () => {
    expect(fraseDosCanais(lista[0])).toBe('Sino, push e e-mail');
    expect(fraseDosCanais(alternarCanal(lista, 'radar_alerta', 'push')[0])).toBe('Sino e e-mail');
    expect(fraseDosCanais(lista[1])).toBe('Sino e push');
    expect(fraseDosCanais(lista[2])).toBe('Só no sino');
    expect(fraseDosCanais(lista[3])).toBe('Só no sino');
    expect(fraseDosCanais({ ...lista[0], ativo: false })).toBe('Desligado');
  });
});
