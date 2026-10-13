import { describe, expect, it } from 'vitest';
import { avisoDeCnpjIncompleto, mensagemSemResultado, tipoDaBusca } from './buscaDeEmpresa';

describe('tipoDaBusca', () => {
  it('reconhece CNPJ com e sem máscara — antes de confundir os pontos com domínio', () => {
    expect(tipoDaBusca('00.000.000/0001-00')).toBe('cnpj');
    expect(tipoDaBusca('00000000000100')).toBe('cnpj');
    expect(tipoDaBusca(' 11.222.333/0001-81 ')).toBe('cnpj');
  });

  it('CNPJ com dígitos de menos ou de mais não vai ao servidor como nome', () => {
    expect(tipoDaBusca('12.345.678')).toBe('cnpj_incompleto');
    expect(tipoDaBusca('123456789012345')).toBe('cnpj_incompleto');
  });

  it('domínio e e-mail corporativo', () => {
    expect(tipoDaBusca('bawzi.com.br')).toBe('dominio');
    expect(tipoDaBusca('www.bawzi.com')).toBe('dominio');
    expect(tipoDaBusca('marcelo@bawzi.com.br')).toBe('dominio');
  });

  it('o caso que gerou a correção: "bawzi" é nome', () => {
    expect(tipoDaBusca('bawzi')).toBe('nome');
    expect(tipoDaBusca('Supremo Farmacêutica')).toBe('nome');
  });
});

describe('mensagemSemResultado', () => {
  it('para nome sem login, não diz que a empresa não existe — manda digitar o CNPJ', () => {
    const m = mensagemSemResultado('nome', false);
    expect(m).not.toMatch(/Nenhuma empresa encontrada/);
    expect(m).toMatch(/CNPJ/);
  });

  it('para nome com login, diz que procurou só no workspace', () => {
    const m = mensagemSemResultado('nome', true);
    expect(m).toMatch(/workspace/);
    expect(m).toMatch(/CNPJ/);
  });

  it('CNPJ e domínio sem resultado mantêm a frase de sempre', () => {
    expect(mensagemSemResultado('cnpj', false)).toMatch(/Nenhuma empresa encontrada/);
    expect(mensagemSemResultado('dominio', true)).toMatch(/Nenhuma empresa encontrada/);
  });
});

describe('avisoDeCnpjIncompleto', () => {
  it('conta os dígitos que a pessoa digitou', () => {
    expect(avisoDeCnpjIncompleto('12.345.678')).toBe('O CNPJ tem 14 dígitos — aqui há 8.');
  });
});
