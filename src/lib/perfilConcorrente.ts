/**
 * O que se sabe DE FATO sobre um concorrente, a partir dos contratos dele.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O QUE ESTE ARQUIVO SUBSTITUI
 * ═══════════════════════════════════════════════════════════════════════════
 * A tela do concorrente anunciava "~25% de ameaça competitiva". Aquele número
 * saía disto:
 *
 *     prob        = `~${Math.min(95, 18 + vitorias * 7)}%`
 *     threatScore = (scoreProbabilidade * 10) + scoreForca + min(vitorias,20) + regional
 *     threatPct   = round(threatScore / 60 * 100)
 *
 * É circular: a contagem de vitórias virava um percentual inventado, o
 * percentual voltava a ser balde 1/2/3, e o balde virava outro percentual. O 60
 * é arbitrário — o máximo real da fórmula é 59. O resultado não era
 * probabilidade de nada: nem de perder a disputa, nem de o concorrente
 * aparecer. Carregava UMA informação real — quantas vezes aquele CNPJ venceu na
 * amostra — vestida de medição.
 *
 * E isso é pior do que não ter número. Sem número o licitante abre a lista de
 * contratos; com "25%" ele confia e relaxa.
 *
 * Aqui não há fórmula: cada campo é uma contagem, uma data ou uma mediana de
 * valores observados. Quando não há observação, o campo é `null` e a tela não
 * mostra a linha — em vez de mostrar zero, que é uma afirmação.
 */

export interface ContratoDoConcorrente {
  orgao?: string;
  orgao_cnpj?: string;
  data?: string;
  dataAssinatura?: string;
  valor?: number;
  valorUnitario?: number | string | { valor?: number } | null;
  /** Deságio real do contrato, em %, calculado no backend a partir de
   *  `valorUnitarioEstimado` × `valorUnitarioHomologado`. Ausente quando o
   *  PNCP não publicou os dois lados. */
  desagio?: number | null;
  [k: string]: unknown;
}

export interface FaixaDesagio {
  mediana: number;
  amostra: number;
  min: number;
  max: number;
}

export interface PerfilConcorrente {
  vitorias: number;
  /** Quantas vitórias no órgão desta licitação. `null` = não deu para afirmar. */
  vitoriasNoOrgao: number | null;
  orgaosDistintos: number;
  ultimaVitoria: { iso: string; rotulo: string; mesesAtras: number } | null;
  /** Menor unitário com que ele JÁ venceu. Num pregão é o número que decide. */
  pisoUnitario: number | null;
  desagio: FaixaDesagio | null;
  /** Quantos contratos entraram em cada conta — a amostra é parte do dado. */
  amostra: number;
}

/** Aceita "dd/mm/aaaa" (como o backend formata) e ISO. */
export function paraData(bruto: unknown): Date | null {
  if (!bruto) return null;
  const s = String(bruto).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Nome de órgão reduzido ao que o identifica.
 *
 * ⚠️ O QUE SAI E O QUE FICA — E POR QUE A LINHA É AQUI. Saem só as palavras
 * que MUDAM entre grafias da MESMA casa: "PREFEITURA MUNICIPAL DE X" e
 * "MUNICÍPIO DE X" são o mesmo comprador escrito de dois jeitos, e sem tirar
 * esses rótulos uma das vitórias desaparece da conta.
 *
 * Ficam "SECRETARIA", "INSTITUTO", "FUNDO", "ESTADO": essas palavras
 * DISTINGUEM órgãos de verdade. Tirá-las faria "Secretaria de Saúde de X" e
 * "Instituto de Saúde de X" virarem a mesma chave — e aí o erro seria o
 * oposto, afirmar que o rival já venceu num órgão onde nunca esteve.
 *
 * A primeira versão desta função tirava só "MUNICIPAL" e deixava "PREFEITURA"
 * e "MUNICIPIO", então não casava justamente o caso que ela existia para
 * casar. Foi o teste que mostrou; o comentário dizia o contrário do código.
 */
// `PREF` entrou depois: o PNCP publica "PREF MINEIROS" ao lado de "MUNICÍPIO
// DE MINEIROS", e sem a abreviação as duas viravam órgãos distintos — some a
// evidência mais forte que existe, "já venceu aqui". Descoberto por acidente,
// num fixture de teste que usei sem pensar e que não casou.
const _RUIDO_DE_ORGAO = /\b(DE|DA|DO|DAS|DOS|E|PREFEITURA|PREF|MUNICIPIO|MUNICIPAL)\b/g;

export function chaveDeOrgao(nome: unknown): string {
  const limpo = String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const reduzido = limpo.replace(_RUIDO_DE_ORGAO, ' ').replace(/\s+/g, ' ').trim();
  // "PREFEITURA MUNICIPAL" sozinha reduziria a nada; aí vale o nome original.
  return reduzido || limpo;
}

/**
 * As duas chaves apontam para o mesmo órgão?
 *
 * ⚠️ IGUALDADE, OU CONTENÇÃO COM PISO DE DUAS PALAVRAS. `a.includes(b)` solto
 * é perigoso: com sufixo de UF ("... MINEIROS GO") a contenção acerta, mas uma
 * chave de UMA palavra casaria com meio país — "BAHIA" dentro de "SECRETARIA
 * SAUDE ESTADO BAHIA". Exigir duas palavras mantém o caso real e corta o
 * acidente. Na dúvida o resultado é "não casou", que faz a tela calar em vez
 * de afirmar.
 */
function mesmoOrgao(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  if (menor.split(' ').length < 2) return false;
  return ` ${maior} `.includes(` ${menor} `);
}

function numeroUnitario(v: ContratoDoConcorrente['valorUnitario']): number {
  if (typeof v === 'number') return v > 0 ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (v && typeof v === 'object') {
    const n = Number((v as { valor?: number }).valor);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function rotuloDeData(d: Date, hoje: Date): { rotulo: string; mesesAtras: number } {
  const meses = Math.max(0,
    (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth()));
  if (meses === 0) return { rotulo: 'este mês', mesesAtras: 0 };
  if (meses === 1) return { rotulo: 'há 1 mês', mesesAtras: 1 };
  if (meses < 12) return { rotulo: `há ${meses} meses`, mesesAtras: meses };
  const anos = Math.floor(meses / 12);
  return { rotulo: anos === 1 ? 'há mais de 1 ano' : `há mais de ${anos} anos`, mesesAtras: meses };
}

export function perfilDoConcorrente(
  contratos: ContratoDoConcorrente[] | undefined | null,
  opcoes: { orgaoAlvo?: string | null; hoje?: Date } = {},
): PerfilConcorrente {
  const lista = Array.isArray(contratos) ? contratos : [];
  const hoje = opcoes.hoje ?? new Date();

  const vazio: PerfilConcorrente = {
    vitorias: lista.length, vitoriasNoOrgao: null, orgaosDistintos: 0,
    ultimaVitoria: null, pisoUnitario: null, desagio: null, amostra: lista.length,
  };
  if (!lista.length) return vazio;

  // ── Órgãos ────────────────────────────────────────────────────────────────
  // ⚠️ `null` QUANDO NÃO DÁ PARA AFIRMAR, E NUNCA ZERO. Nome de órgão é texto
  // livre: "PREFEITURA MUNICIPAL DE X" e "MUNICIPIO DE X" são a mesma casa
  // escrita de dois jeitos. Se a normalização não casar, o honesto é a tela
  // não falar do assunto — dizer "0 vitórias neste órgão" para quem venceu lá
  // três vezes é uma afirmação falsa, e é justamente a que faria o licitante
  // baixar a guarda. Ausência de prova não é prova de ausência.
  const chaves = lista.map((c) => chaveDeOrgao(c.orgao)).filter(Boolean);
  const orgaosDistintos = new Set(chaves).size;

  const alvo = chaveDeOrgao(opcoes.orgaoAlvo);
  let vitoriasNoOrgao: number | null = null;
  if (alvo) {
    const n = chaves.filter((k) => mesmoOrgao(k, alvo)).length;
    // Só afirma quando encontrou. Zero vira `null` pelo motivo acima.
    vitoriasNoOrgao = n > 0 ? n : null;
  }

  // ── Última vitória ────────────────────────────────────────────────────────
  const datas = lista.map((c) => paraData(c.data ?? c.dataAssinatura)).filter((d): d is Date => !!d);
  const maisRecente = datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null;
  const ultimaVitoria = maisRecente
    ? { iso: maisRecente.toISOString().slice(0, 10), ...rotuloDeData(maisRecente, hoje) }
    : null;

  // ── Piso unitário ─────────────────────────────────────────────────────────
  const unitarios = lista.map((c) => numeroUnitario(c.valorUnitario)).filter((v) => v > 0);
  const pisoUnitario = unitarios.length ? Math.min(...unitarios) : null;

  // ── Deságio ───────────────────────────────────────────────────────────────
  // Só entra contrato em que o PNCP publicou estimado E homologado. O backend
  // já descartou os pares implausíveis (unitário confundido com total).
  const ds = lista
    .map((c) => (typeof c.desagio === 'number' && Number.isFinite(c.desagio) ? c.desagio : null))
    .filter((d): d is number => d !== null);
  const desagio: FaixaDesagio | null = ds.length
    ? {
        // Mediana, não média: com amostra pequena um item torto move a média
        // inteira, e a decisão de lance sai errada junto.
        mediana: Math.round(mediana(ds) * 10) / 10,
        amostra: ds.length,
        min: Math.round(Math.min(...ds) * 10) / 10,
        max: Math.round(Math.max(...ds) * 10) / 10,
      }
    : null;

  return {
    vitorias: lista.length,
    vitoriasNoOrgao,
    orgaosDistintos,
    ultimaVitoria,
    pisoUnitario,
    desagio,
    amostra: lista.length,
  };
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * As frases da tela, na ordem em que decidem um lance.
 *
 * ⚠️ CADA ITEM SÓ EXISTE SE HOUVER OBSERVAÇÃO POR TRÁS. A lista vem vazia
 * quando não se sabe nada — e aí a tela diz que não sabe, em vez de preencher
 * o espaço com um indicador.
 */
export function evidenciasDoPerfil(p: PerfilConcorrente): { rotulo: string; valor: string; detalhe?: string }[] {
  const out: { rotulo: string; valor: string; detalhe?: string }[] = [];

  // ⚠️ SEM CONTRATO, SEM LISTA — e não uma lista com "0". "Contratos vencidos:
  // 0" lê-se como "este concorrente nunca venceu", que é uma afirmação sobre a
  // empresa. O que se sabe é bem menos: não há contrato dele NA BASE. Quem
  // chama isto mostra o vazio explicando isso.
  if (p.amostra === 0) return out;

  out.push({
    rotulo: 'Contratos vencidos',
    valor: String(p.vitorias),
    detalhe: p.orgaosDistintos > 1 ? `em ${p.orgaosDistintos} órgãos` : undefined,
  });

  if (p.vitoriasNoOrgao !== null) {
    out.push({
      rotulo: 'Neste órgão',
      valor: `${p.vitoriasNoOrgao}×`,
      detalhe: 'já venceu aqui',
    });
  }

  if (p.desagio) {
    out.push({
      rotulo: 'Deságio mediano',
      valor: `${p.desagio.mediana.toFixed(1)}%`,
      // A amostra vai junto do número, não numa nota de rodapé: "18% em 2
      // contratos" e "18% em 40" pedem decisões diferentes.
      detalhe: p.desagio.amostra === 1
        ? '1 contrato medido'
        : `${p.desagio.amostra} contratos · ${p.desagio.min.toFixed(0)}% a ${p.desagio.max.toFixed(0)}%`,
    });
  }

  if (p.pisoUnitario !== null) {
    out.push({
      rotulo: 'Menor unitário que já aceitou',
      valor: BRL.format(p.pisoUnitario),
      detalhe: 'piso observado',
    });
  }

  if (p.ultimaVitoria) {
    out.push({
      rotulo: 'Última vitória',
      valor: p.ultimaVitoria.rotulo,
      // Um concorrente parado há dois anos não é o mesmo risco de um que
      // venceu mês passado, mesmo com a mesma contagem de vitórias.
      detalhe: p.ultimaVitoria.mesesAtras >= 18 ? 'pode ter saído do segmento' : undefined,
    });
  }

  return out;
}

/**
 * Uma URL só vira `href` se for absoluta e http(s).
 *
 * ⚠️ O CASO REAL: um contrato exibia "Link Oficial" apontando para
 * `http://localhost:3000/contratos/13925994000107/2025/100`. O valor guardado
 * era `/contratos/13925994000107/2025/100` — caminho relativo vindo do campo
 * `linkSistemaOrigem` do PNCP —, e o navegador resolve isso contra o NOSSO
 * domínio. Em produção vira `app.bawzi.com/contratos/...`, uma página
 * inexistente, justamente no botão que promete levar à fonte primária.
 *
 * Também barra `javascript:` e `data:`: o valor é texto de terceiro indo
 * direto para um `href`, e aceitar só http(s) fecha isso sem precisar listar
 * o que bloquear.
 */
export function linkExternoValido(bruto: unknown): string {
  if (typeof bruto !== 'string') return '';
  const url = bruto.trim();
  if (!url) return '';
  const min = url.toLowerCase();
  return min.startsWith('http://') || min.startsWith('https://') ? url : '';
}

/**
 * A ação sugerida, derivada do que se OBSERVOU sobre o concorrente.
 *
 * ⚠️ ANTES SAÍA DA POSIÇÃO NA LISTA. Eram quatro frases fixas escolhidas por
 * `posicao === 0` e por ser regional — então o #2, o #3, o #4 e o #5 recebiam
 * a MESMA sentença, palavra por palavra. Embaixo de cada CNPJ, com o rótulo
 * "Resposta sugerida", aquilo parecia análise individual e era preenchimento.
 *
 * E a posição era o pior insumo possível: quando os concorrentes empatam em
 * vitórias — cinco empresas com 1 vitória cada, o caso corriqueiro — o #1 é só
 * quem o `sort` deixou na frente. A recomendação "mais forte" ia para uma
 * empresa sorteada, e o licitante vigiava a errada.
 *
 * A ordem abaixo é a ordem em que os fatos mudam um lance: presença no órgão >
 * piso de preço > deságio medido > sumiço do segmento. Duas empresas com os
 * mesmos fatos recebem o mesmo texto — o que é correto, e é diferente de duas
 * empresas DIFERENTES receberem o mesmo texto por ficarem em posições vizinhas.
 */
export function acaoSugerida(p: PerfilConcorrente, opcoes: { regional?: boolean } = {}): string {
  if (p.vitoriasNoOrgao !== null) {
    return `Trate a presença dele como provável: já venceu ${p.vitoriasNoOrgao}× neste mesmo órgão. `
      + 'Cheque atestados e simule margem antes de entrar.';
  }

  if (p.pisoUnitario !== null) {
    // ⚠️ "JÁ FECHOU", NÃO "VAI COBRAR". O piso vem dos contratos DELE, que
    // podem ser de objetos diferentes deste edital — é referência para o
    // cálculo de margem, não previsão de lance. Prometer o segundo com o dado
    // do primeiro é exatamente o erro que esta tela vinha cometendo.
    return `Ele já fechou a ${BRL.format(p.pisoUnitario)} por unidade em contrato anterior. `
      + 'Leve esse número para o cálculo de margem antes de definir o lance.';
  }

  if (p.desagio) {
    const n = p.desagio.amostra;
    return `Historicamente corta ${p.desagio.mediana.toFixed(0)}% do estimado `
      + `(${n} contrato${n > 1 ? 's' : ''} medido${n > 1 ? 's' : ''}). `
      + 'Simule sua margem nesse nível de desconto.';
  }

  // Parado há mais de um ano e meio: esforço de impugnação contra ele custa
  // caro e provavelmente não se paga.
  if ((p.ultimaVitoria?.mesesAtras ?? 0) >= 18) {
    return `Última vitória ${p.ultimaVitoria!.rotulo} — pode ter saído do segmento. `
      + 'Monitore, sem consumir esforço de impugnação.';
  }

  if (opcoes.regional) {
    return 'Tem sede na UF do edital, mas não há histórico na base para medir preço. '
      + 'Abra o Dossiê PNCP antes de assumir qualquer coisa.';
  }

  // ⚠️ SEM FATO, SEM CONSELHO. A versão anterior sempre tinha uma frase pronta
  // — inclusive para concorrentes sobre os quais não se sabia absolutamente
  // nada. Recomendação sem base é ruído com aparência de orientação.
  return 'Sem contrato deste CNPJ na base para embasar uma recomendação. '
    + 'O Dossiê PNCP é o caminho para conferir manualmente.';
}
