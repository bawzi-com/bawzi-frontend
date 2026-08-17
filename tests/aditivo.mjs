function ganhoPorAditivo(c) {
  const inicial = c.valor_inicial ?? 0;
  if (!inicial || !c.valor || c.valor <= inicial) return 0;
  return c.valor - inicial;
}
const visiveis = (cs, {filtro=null, soAditivo=false, termo=''}={}) => cs.filter(c => {
  if (filtro && c.situacao !== filtro) return false;
  if (soAditivo && ganhoPorAditivo(c) <= 0) return false;
  if (!termo) return true;
  return `${c.objeto} ${c.orgao_nome}`.toLowerCase().includes(termo);
});

const C = (n, situacao, valor, valor_inicial) => ({n, situacao, valor, valor_inicial, objeto:n, orgao_nome:''});
const carteira = [
  C('MJ cresceu',  'renovar', 55885500, 52662838),   // +3.222.662, o da tela
  C('TJMG',        'renovar', 10246973, 10246973),   // não cresceu
  C('Bahia',       'vigente', 38800187, 0),          // sem valor inicial
  C('TJPR',        'vigente', 16277750, undefined),  // campo ausente
  C('Encolheu',    'vigente',  1000000,  1200000),   // valor MENOR que o inicial
];

let ok = true;
const checa = (r, c) => { ok = ok && c; console.log(`${c?'✅':'❌'} ${r}`); };

checa('acha o contrato que cresceu', ganhoPorAditivo(carteira[0]) === 3222662);
checa('valor igual ao inicial não é aditivo', ganhoPorAditivo(carteira[1]) === 0);
checa('sem valor_inicial não inventa aditivo', ganhoPorAditivo(carteira[2]) === 0);
checa('campo ausente não quebra', ganhoPorAditivo(carteira[3]) === 0);
checa('valor MENOR que o inicial não vira aditivo negativo',
      ganhoPorAditivo(carteira[4]) === 0);

const so = visiveis(carteira, {soAditivo:true});
checa('o filtro isola exatamente 1 contrato', so.length === 1 && so[0].n === 'MJ cresceu');
checa('soma do filtro bate com o resumo (+R$ 3.222.662)',
      so.reduce((s,c)=>s+ganhoPorAditivo(c),0) === 3222662);

// A interseção é o caso mais interessante: cresceu E precisa renovar
const inter = visiveis(carteira, {soAditivo:true, filtro:'renovar'});
checa('combina com o filtro de situação', inter.length === 1);
checa('situação sem aditivo devolve vazio, não tudo',
      visiveis(carteira, {soAditivo:true, filtro:'vigente'}).length === 0);

// ── Filtro por órgão, somado aos outros ─────────────────────────────────────
const visiveis2 = (cs, {filtro=null, soAditivo=false, filtroOrgao=null, termo=''}={}) =>
  cs.filter(c => {
    if (filtro && c.situacao !== filtro) return false;
    if (soAditivo && ganhoPorAditivo(c) <= 0) return false;
    if (filtroOrgao && c.orgao_nome !== filtroOrgao) return false;
    if (!termo) return true;
    return `${c.objeto} ${c.orgao_nome}`.toLowerCase().includes(termo);
  });

const MJ = 'MINISTERIO DA JUSTICA E SEGURANCA PUBLICA';
const carteira2 = [
  {n:'MJ grande', situacao:'renovar', valor:55885500, valor_inicial:52662838, orgao_nome:MJ, objeto:''},
  {n:'MJ pequeno',situacao:'vigente', valor:1000000,  valor_inicial:1000000,  orgao_nome:MJ, objeto:''},
  {n:'TJPR',      situacao:'vigente', valor:16277750, valor_inicial:16277750, orgao_nome:'PARANA TRIBUNAL DE JUSTICA', objeto:''},
];
let ok2 = true;
const ck = (r,c) => { ok2 = ok2 && c; console.log(`${c?'✅':'❌'} ${r}`); };

ck('filtro de órgão isola os 2 do MJ',
   visiveis2(carteira2, {filtroOrgao:MJ}).length === 2);
ck('órgão + aditivo devolve só o que cresceu no MJ',
   visiveis2(carteira2, {filtroOrgao:MJ, soAditivo:true}).map(c=>c.n).join() === 'MJ grande');
ck('órgão + situação combinam',
   visiveis2(carteira2, {filtroOrgao:MJ, filtro:'vigente'}).map(c=>c.n).join() === 'MJ pequeno');
ck('órgão sem correspondência devolve vazio, não tudo',
   visiveis2(carteira2, {filtroOrgao:'ORGAO QUE NAO EXISTE'}).length === 0);
ck('sem filtro de órgão, nada é escondido',
   visiveis2(carteira2).length === 3);
const tudo = ok && ok2;
console.log('\n' + (tudo ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(tudo ? 0 : 1);
