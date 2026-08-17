const enxuto = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const chaveGrupo = (c) => `${enxuto(c.orgao_nome)}|${c.situacao}|${enxuto(c.objeto).slice(0,60)}`;
const MIN = 3;
function agrupar(cs) {
  const cont = new Map();
  for (const c of cs) { const k = chaveGrupo(c); cont.set(k, (cont.get(k)||0)+1); }
  const out = [], vistos = new Set();
  for (const c of cs) {
    const k = chaveGrupo(c);
    if ((cont.get(k)||0) < MIN) { out.push({tipo:'un', c}); continue; }
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({tipo:'grupo', chave:k, itens: cs.filter(x => chaveGrupo(x) === k)});
  }
  return out;
}

// Objetos REAIS da carteira, com as divergências que existem de verdade
const DP = 'DEFENSORIA PUBLICA DO ESTADO DE SAO PAULO';
const carteira = [
  {orgao_nome:'BAHIA SECRETARIA DA ADMINISTRACAO', situacao:'vencendo', objeto:'Administração, Operação, Desenv. de Sistemas', valor:3852000},
  {orgao_nome:'MINISTERIO DA JUSTICA', situacao:'renovar', objeto:'CONTRATAÇÃO DE SOLUÇÃO DE TIC', valor:55885500},
  ...Array.from({length: 20}, (_,i) => ({orgao_nome:DP, situacao:'encerrado',
    objeto:'INSTALAÇÃO DE EQUIPAMENTO - PRESTAÇÃO DE SERVIÇOS DE GERENCIAMENTO E EXECUÇÃO DE INSTALAÇÃO E SUBSTITUIÇÃO DE DESKTOPS', valor:10000})),
  // as variações reais: espaço a menos, e singular
  {orgao_nome:DP, situacao:'encerrado', objeto:'INSTALAÇÃO DE EQUIPAMENTO -PRESTAÇÃO DE SERVIÇOS DE GERENCIAMENTO E EXECUÇÃO DE INSTALAÇÃO E SUBSTITUIÇÃO DE DESKTOPS', valor:19294},
  {orgao_nome:DP, situacao:'encerrado', objeto:'INSTALAÇÃO DE EQUIPAMENTO -PRESTAÇÃO DE SERVIÇOS DE GERENCIAMENTO E EXECUÇÃO DE INSTALAÇÃO E SUBSTITUIÇÃO DE DESKTOP', valor:7657},
  // esta NÃO tem o prefixo "INSTALAÇÃO DE EQUIPAMENTO" — deve ficar de fora
  {orgao_nome:DP, situacao:'encerrado', objeto:'PRESTAÇÃO DE SERVIÇOS DE GERENCIAMENTO E EXECUÇÃO DE INSTALAÇÃO E SUBSTITUIÇÃO DE DESKTOPS', valor:9831},
  {orgao_nome:'CAIXA ECONOMICA FEDERAL', situacao:'encerrado', objeto:'WORKSHOP MANAGEMENT 3.0', valor:43538},
];

const r = agrupar(carteira);
let ok = true;
const checa = (rot, cond, extra='') => { ok = ok && cond; console.log(`${cond?'✅':'❌'} ${rot}${extra?'  '+extra:''}`); };

const grupos = r.filter(x => x.tipo === 'grupo');
checa('as 3 variações de grafia caíram no MESMO grupo',
      grupos.length === 1 && grupos[0].itens.length === 22, `(${grupos[0]?.itens.length} itens)`);
checa('linha com objeto diferente NÃO foi absorvida',
      r.some(x => x.tipo === 'un' && x.c.valor === 9831));
checa('a lista cai de 25 para ' + r.length + ' linhas', r.length === 5);
checa('o contrato que vence continua em primeiro',
      r[0].tipo === 'un' && r[0].c.valor === 3852000);
checa('a soma do grupo bate',
      grupos[0].itens.reduce((s,x)=>s+x.valor,0) === 20*10000 + 19294 + 7657);
checa('grupo com 2 iguais NÃO agrupa (mínimo 3)',
      agrupar([carteira[0], carteira[2], carteira[3]]).every(x => x.tipo === 'un'));

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
