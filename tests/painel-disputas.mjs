// Quando o painel de disputas deve aparecer, e com o quê.
function visivel({oportunidades, filtro}) {
  return oportunidades.length > 0 && filtro !== 'encerrado';
}
function filtrar(ops, {prazoMax=null, ocultarProrrogaveis=false, orgaoDisputa=null, filtroOrgao=null}={}) {
  return ops.filter(o => {
    if (prazoMax !== null && (o.dias === null || o.dias > prazoMax)) return false;
    if (ocultarProrrogaveis && o.prorrogavel) return false;
    if (orgaoDisputa && o.orgao_nome !== orgaoDisputa) return false;
    if (filtroOrgao && o.orgao_nome !== filtroOrgao) return false;
    return true;
  });
}
const MJ = 'MINISTERIO DA JUSTICA';
const TJ = 'PARANA TRIBUNAL DE JUSTICA';
const OPS = [
  {orgao_nome:MJ, dias:20,  prorrogavel:false},
  {orgao_nome:MJ, dias:120, prorrogavel:true},
  {orgao_nome:TJ, dias:45,  prorrogavel:false},
];
let ok = true;
const ck = (r,c) => { ok = ok && c; console.log(`${c?'✅':'❌'} ${r}`); };

ck('sem filtro → painel visível', visivel({oportunidades:OPS, filtro:null}));
ck('filtro "vigente" → painel visível', visivel({oportunidades:OPS, filtro:'vigente'}));
ck('filtro "vencendo" → painel visível', visivel({oportunidades:OPS, filtro:'vencendo'}));
ck('filtro "ENCERRADO" → painel OCULTO', !visivel({oportunidades:OPS, filtro:'encerrado'}));
ck('sem oportunidades → oculto', !visivel({oportunidades:[], filtro:null}));

ck('lista filtrada por MJ → painel só mostra MJ',
   filtrar(OPS, {filtroOrgao:MJ}).length === 2);
ck('MJ + prazo 30 → só a de 20 dias',
   filtrar(OPS, {filtroOrgao:MJ, prazoMax:30}).length === 1);
ck('MJ + só prováveis → tira a prorrogável',
   filtrar(OPS, {filtroOrgao:MJ, ocultarProrrogaveis:true}).length === 1);
ck('órgão da lista e do painel se combinam (interseção vazia)',
   filtrar(OPS, {filtroOrgao:MJ, orgaoDisputa:TJ}).length === 0);
ck('sem filtro de lista → todos os órgãos', filtrar(OPS).length === 3);

console.log('\n' + (ok ? 'TODOS PASSARAM' : 'FALHOU'));
process.exit(ok ? 0 : 1);
