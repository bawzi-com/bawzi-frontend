import type { AnalysisResult } from '@/components/analysis-types';

export function exportPdf(result: AnalysisResult, onError: (msg: string) => void): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    onError('Permita pop-ups no browser para gerar o PDF.');
    return;
  }

  const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const scoreColor = result.score >= 70 ? '#16a34a' : result.score >= 45 ? '#d97706' : '#dc2626';
  const scoreBg    = result.score >= 70 ? '#f0fdf4' : result.score >= 45 ? '#fffbeb' : '#fef2f2';
  const decision = result.decisao;
  const decisionVerdict = String(decision?.veredito || '').toUpperCase();
  const decisionColor = decisionVerdict === 'GO'
    ? '#16a34a'
    : decisionVerdict === 'NO_GO'
      ? '#dc2626'
      : '#d97706';
  const decisionBg = decisionVerdict === 'GO'
    ? '#f0fdf4'
    : decisionVerdict === 'NO_GO'
      ? '#fef2f2'
      : '#fffbeb';
  const decisionLabel = decision?.rotulo || (
    decisionVerdict === 'GO' ? 'Participar' : decisionVerdict === 'NO_GO' ? 'Não participar agora' : 'Participar somente após validações'
  );

  const semaforoIcon = (status: string) =>
    status === 'ok' ? '✅' : status === 'alerta' ? '⚠️' : '❌';

  const listHtml = (items: string[] | undefined, fallback = '') =>
    items?.length
      ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
      : fallback ? `<p style="color:#999;font-style:italic">${fallback}</p>` : '';

  const section = (num: string, title: string, body: string) =>
    body.trim()
      ? `<div class="section"><h3>${num}. ${esc(title)}</h3>${body}</div>`
      : '';

  const dateLabel = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
  };

  const datasHtml = (() => {
    const datas = result.datas_criticas || [];
    if (!datas.length) return '';
    const rows = datas.map(d =>
      `<tr>
        <td>${esc(d.label)}</td>
        <td style="font-weight:bold;${d.urgente ? 'color:#dc2626' : ''}">
          ${dateLabel(d.data_iso)}${d.urgente ? ' ⚠️' : ''}
        </td>
      </tr>`
    ).join('');
    return `<table><thead><tr><th>Prazo</th><th>Data</th></tr></thead><tbody>${rows}</tbody></table>`;
  })();

  const semaforoHtml = (() => {
    const s = result.semaforo;
    if (!s) return '';
    const dims = [
      ['Técnica',      s.tecnica],
      ['Financeira',   s.financeira],
      ['Jurídica',     s.juridica],
      ['Documentação', s.documentacao],
    ] as const;
    const rows = dims.map(([label, sig]) =>
      sig ? `<tr>
        <td>${esc(label)}</td>
        <td>${semaforoIcon(sig.status)} ${esc(sig.status.toUpperCase())}</td>
        <td>${esc(sig.motivo)}</td>
      </tr>` : ''
    ).join('');
    return `<table><thead><tr><th>Dimensão</th><th>Status</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>`;
  })();

  const riscosHtml = (() => {
    const risks = result.risks || [];
    if (!risks.length) return '';
    return risks.map(r => `<div style="margin-bottom:10px;border-left:3px solid #dc2626;padding:6px 10px;background:#fef2f2;">
      <strong style="font-size:11px">${esc(r.titulo)}</strong>
      ${r.impacto ? `<span style="font-size:9px;text-transform:uppercase;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;margin-left:6px">${esc(r.impacto)}</span>` : ''}
      <p style="margin:4px 0 0 0;font-size:11px;color:#444">${esc(r.descricao)}</p>
    </div>`).join('');
  })();

  const checklistHtml = (() => {
    const cl = result.checklist || [];
    if (!cl.length) return '';
    return `<ul>${cl.map((item: Record<string, unknown>) => {
      const label = esc(item.label || item.item || item.descricao || item);
      const done  = item.done || item.checked || item.ok;
      return `<li style="list-style:none;margin-bottom:4px">
        <span style="margin-right:6px">${done ? '☑' : '☐'}</span>${label}
      </li>`;
    }).join('')}</ul>`;
  })();

  const decisionHtml = (() => {
    if (!decision?.veredito && !decision?.resumo_decisao && !decision?.decisao_executiva) return '';
    return `
      <div class="decision-card">
        <div>
          <span class="decision-pill">${esc(String(decision?.veredito || 'GO_CONDICIONADO').replace('_', ' '))}</span>
          <h2>${esc(decisionLabel)}</h2>
          <p>${esc(decision?.resumo_decisao || decision?.decisao_executiva || result.recommendation || '')}</p>
        </div>
        <div class="decision-metrics">
          <div><strong>${result.score}/100</strong><span>Viabilidade</span></div>
          <div><strong>${esc(decision?.confianca ?? '—')}%</strong><span>Confiança</span></div>
        </div>
      </div>
    `;
  })();

  const evidenceHtml = (() => {
    const evidencias = decision?.evidencias || [];
    if (!evidencias.length) return '';
    return evidencias.map((ev) => `
      <div class="evidence">
        <div class="evidence-head">
          <strong>${esc(ev.titulo || 'Evidência')}</strong>
          <span>${esc(ev.referencia || ev.fonte || ev.categoria || 'Fonte analisada')}</span>
        </div>
        ${ev.detalhe ? `<p>${esc(ev.detalhe)}</p>` : ''}
        ${ev.trecho ? `<blockquote>"${esc(ev.trecho)}"</blockquote>` : ''}
        ${ev.impacto ? `<p class="impact"><b>Impacto:</b> ${esc(ev.impacto)}</p>` : ''}
        ${ev.fonte ? `<p class="source"><b>Fonte:</b> ${esc(ev.fonte)}</p>` : ''}
      </div>
    `).join('');
  })();

  const confidenceHtml = (() => {
    const fatores = decision?.fatores_confianca || [];
    if (!fatores.length) return '';
    const rows = fatores.map((f) => `
      <tr>
        <td>${esc(f.criterio)}</td>
        <td><span class="status ${esc(String(f.status || 'parcial'))}">${esc(f.status || 'parcial')}</span></td>
        <td>${esc(f.detalhe || '')}</td>
      </tr>
    `).join('');
    return `<table><thead><tr><th>Critério</th><th>Status</th><th>Detalhe</th></tr></thead><tbody>${rows}</tbody></table>`;
  })();

  const actionPlanHtml = (() => {
    const acoes = decision?.proximas_acoes || [];
    if (!acoes.length) return '';
    const rows = acoes.map((acao, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(acao.prazo || 'Hoje')}</td>
        <td>${esc(acao.acao)}</td>
        <td>${esc(acao.responsavel || 'Licitações')}</td>
        <td>${esc(acao.resultado_esperado || '')}</td>
      </tr>
    `).join('');
    return `<table><thead><tr><th>#</th><th>Prazo</th><th>Ação</th><th>Responsável</th><th>Resultado esperado</th></tr></thead><tbody>${rows}</tbody></table>`;
  })();

  const aderenciaHtml = (() => {
    const fit = result.aderencia_negocio;
    if (!fit) return '';
    const rows = [
      `<tr><td>Status</td><td>${esc(fit.status || '—')}</td></tr>`,
      fit.score != null && `<tr><td>Match CNAE</td><td>${esc(fit.score)}/100</td></tr>`,
      fit.cnae_principal && `<tr><td>CNAE</td><td>${esc(fit.cnae_principal)}${fit.cnae_descricao ? ` — ${esc(fit.cnae_descricao)}` : ''}</td></tr>`,
      fit.objeto_detectado && `<tr><td>Objeto do edital</td><td>${esc(fit.objeto_detectado)}</td></tr>`,
    ].filter(Boolean).join('');
    const just = fit.justificativa ? `<p>${esc(fit.justificativa)}</p>` : '';
    return `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>${just}`;
  })();

  const parametrosHtml = (() => {
    const params = result.avaliacao_parametros || [];
    if (!params.length) return '';
    const pesoLabel: Record<string, string> = { alto: 'Crítico', medio: 'Importante', baixo: 'Desejável' };
    const statusLabel: Record<string, string> = { ok: 'Atende', alerta: 'Atenção', bloqueio: 'Não atende' };
    const rows = params.map(p => `
      <tr>
        <td>${esc(p.nome)}</td>
        <td>${esc(pesoLabel[p.peso] || p.peso)}</td>
        <td>${esc(statusLabel[p.status] || p.status)}</td>
        <td>${esc(p.score)}/10</td>
      </tr>
    `).join('');
    return `<table><thead><tr><th>Critério</th><th>Peso</th><th>Status</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
  })();

  const redFlagsHtml = (() => {
    const flags = result.red_flags || [];
    if (!flags.length) return '';
    return `<ul>${flags.map(f => `<li><strong>[${esc((f.gravidade || 'media').toUpperCase())}]</strong> ${esc(f.descricao)}${f.base_legal ? ` (${esc(f.base_legal)})` : ''}</li>`).join('')}</ul>`;
  })();

  const habilitacaoHtml = (() => {
    const itens = result.habilitacao_checklist || [];
    if (!itens.length) return '';
    return `<ul>${itens.map(h => `<li>${esc(h.exigencia)}${h.criticidade === 'eliminatoria' ? ' <strong>(eliminatória)</strong>' : ''}</li>`).join('')}</ul>`;
  })();

  const oportunidadesHtml = listHtml(result.oportunidades);

  const fichaTecnicaHtml = (() => {
    const ficha = result.ficha_tecnica || [];
    if (!ficha.length) return '';
    const rows = ficha.map(item => `
      <tr>
        <td style="font-weight:bold;white-space:nowrap">${esc(item.campo)}</td>
        <td>${esc(item.valor || 'Não localizado')}</td>
      </tr>
    `).join('');
    return `<table><tbody>${rows}</tbody></table>`;
  })();

  const scoreBreakdownHtml = (() => {
    const itens = result.score_breakdown || [];
    if (!itens.length) return '';
    const rows = itens.map(item => `
      <tr>
        <td>${esc(item.fator)}</td>
        <td style="text-align:right;font-weight:bold">${item.pontos > 0 ? '+' : ''}${esc(item.pontos)}</td>
      </tr>
    `).join('');
    return `<table><tbody>${rows}</tbody></table>`;
  })();

  const concorrentesHtml = (() => {
    const lista = [...(result.concorrentes_provaveis || []), ...(result.concorrentes_regionais || [])];
    if (!lista.length) return '';
    return `<ul>${lista.slice(0, 10).map((c: Record<string, unknown>) => {
      const nome = esc(c?.nome || c?.razao_social || c?.name || 'Concorrente identificado');
      const uf = c?.uf ? ` — ${esc(c.uf)}` : '';
      return `<li>${nome}${uf}</li>`;
    }).join('')}</ul>`;
  })();

  const pricingHtml = (() => {
    const p = result.pricing_intelligence;
    if (!p) return '';
    const rows = [
      p.desagioPreditivoOrgao != null && `<tr><td>Deságio Preditivo do Órgão</td><td>${p.desagioPreditivoOrgao}%</td></tr>`,
      p.nivelAmeaca            && `<tr><td>Nível de Ameaça</td><td>${esc(p.nivelAmeaca)}</td></tr>`,
      p.perfilVencedor         && `<tr><td>Perfil do Vencedor</td><td>${esc(p.perfilVencedor)}</td></tr>`,
      p.financial_verdict      && `<tr><td>Veredito Financeiro</td><td>${esc(p.financial_verdict)}</td></tr>`,
      p.estimated_discount != null && `<tr><td>Desconto Estimado</td><td>${p.estimated_discount}%</td></tr>`,
      p.valorMedioMercado      && `<tr><td>Valor Médio de Mercado</td><td>${esc(String(p.valorMedioMercado))}</td></tr>`,
      p.engenharia_reversa?.setor_identificado && `<tr><td>Setor Identificado</td><td>${esc(p.engenharia_reversa.setor_identificado)}</td></tr>`,
      p.engenharia_reversa?.margem_media_setor_pct != null && `<tr><td>Margem Média do Setor</td><td>${p.engenharia_reversa.margem_media_setor_pct}%</td></tr>`,
    ].filter(Boolean).join('');
    return rows ? `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>` : '';
  })();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Laudo de Decisão Bawzi — Bawzi Intelligence</title>
  <style>
    @page { size: A4; margin: 2cm 2.2cm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.65; color: #111; margin: 0; padding: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .header-brand h1 { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-brand p  { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 3px 0 0; }
    .header-meta { text-align: right; font-size: 9px; color: #64748b; }
    .header-meta strong { color: #0f172a; display: block; font-size: 10px; }
    .warning { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 8px 12px; font-size: 10px; color: #475569; margin-bottom: 20px; border-radius: 4px; }
    .score-card { display: flex; align-items: center; gap: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; background: ${scoreBg}; }
    .score-circle { width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: ${scoreColor}; flex-shrink: 0; }
    .score-info h2 { font-size: 15px; font-weight: 900; margin: 0 0 4px; color: #0f172a; }
    .score-info .class { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 2px 10px; border-radius: 20px; background: ${scoreColor}; color: #fff; margin-bottom: 4px; }
    .score-info p { font-size: 10px; color: #475569; margin: 0; }
    .decision-card { display: flex; justify-content: space-between; gap: 20px; border: 1px solid #e2e8f0; border-left: 5px solid ${decisionColor}; border-radius: 8px; padding: 14px 16px; background: ${decisionBg}; margin-bottom: 12px; }
    .decision-card h2 { font-size: 17px; margin: 6px 0 6px; color: #0f172a; }
    .decision-card p { margin: 0; text-align: left; }
    .decision-pill { display: inline-block; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #fff; background: ${decisionColor}; border-radius: 999px; padding: 2px 9px; }
    .decision-metrics { display: flex; gap: 8px; min-width: 170px; }
    .decision-metrics div { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; background: rgba(255,255,255,0.78); padding: 8px; text-align: center; }
    .decision-metrics strong { display: block; font-size: 17px; color: ${decisionColor}; line-height: 1; }
    .decision-metrics span { display: block; margin-top: 4px; font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .evidence { border: 1px solid #e2e8f0; border-radius: 7px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; }
    .evidence-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 5px; }
    .evidence-head strong { font-size: 11px; color: #0f172a; }
    .evidence-head span { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    blockquote { margin: 7px 0; border-left: 3px solid #94a3b8; background: #f8fafc; padding: 6px 9px; color: #334155; font-size: 10px; }
    .impact, .source { font-size: 10px; color: #475569; margin: 4px 0 0; }
    .status { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: #f1f5f9; color: #475569; }
    .status.confirmado { background: #dcfce7; color: #166534; }
    .status.parcial { background: #fef3c7; color: #92400e; }
    .status.ausente { background: #f1f5f9; color: #475569; }
    .status.risco { background: #fee2e2; color: #991b1b; }
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    h3 { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px; }
    p  { font-size: 11px; text-align: justify; margin: 0 0 8px; white-space: pre-wrap; color: #1e293b; }
    ul { margin: 0 0 8px; padding-left: 18px; }
    li { font-size: 11px; margin-bottom: 4px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; }
    th { background: #f1f5f9; font-weight: 800; text-align: left; padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .col-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .col-box h4 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 6px; }
    .signature { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sig-box { text-align: center; }
    .sig-line { width: 160px; border-top: 1px solid #0f172a; margin: 0 auto 6px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .sig-sub   { font-size: 9px; color: #94a3b8; margin-top: 2px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <h1>Bawzi Intelligence</h1>
      <p>Laudo de Decisão — Go / No-Go de Licitação</p>
    </div>
    <div class="header-meta">
      <strong>${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
      Score Bawzi: ${result.score}/100
    </div>
  </div>
  <div class="warning">
    NOTA DE RESPONSABILIDADE: Este laudo foi gerado por Inteligência Artificial para apoiar decisão interna de participação. A revisão, validação e assinatura por profissional habilitado continua indispensável antes do uso oficial.
  </div>
  <div class="score-card">
    <div class="score-circle">${result.score}</div>
    <div class="score-info">
      <h2>${esc(result.title || 'Análise de Edital')}</h2>
      <span class="class">${esc(result.classification || '—')}</span>
      <p>${esc(result.recommendation || result.rationale || '')}</p>
    </div>
  </div>
  ${decisionHtml ? section('1', 'Veredito Executivo', decisionHtml) : ''}
  ${aderenciaHtml ? section('2', 'Aderência ao Negócio (CNAE)', aderenciaHtml) : ''}
  ${evidenceHtml ? section('3', 'Evidências que Sustentam a Decisão', evidenceHtml) : ''}
  ${confidenceHtml ? section('4', 'Base da Confiança', confidenceHtml) : ''}
  ${decision?.lacunas?.length ? section('5', 'Lacunas e Pontos Não Confirmados', listHtml(decision.lacunas)) : ''}
  ${decision?.o_que_mudaria_decisao?.length ? section('6', 'O que Mudaria a Decisão', listHtml(decision.o_que_mudaria_decisao)) : ''}
  ${actionPlanHtml ? section('7', 'Cockpit de Execução', actionPlanHtml) : ''}
  ${section('8', 'Resumo Executivo do Edital', `<p>${esc(result.summary)}</p>`)}
  ${fichaTecnicaHtml ? section('9', 'Ficha Técnica do Edital', fichaTecnicaHtml) : ''}
  ${semaforoHtml ? section('10', 'Semáforo de Viabilidade', semaforoHtml) : ''}
  ${datasHtml ? section('11', 'Cronograma Crítico', datasHtml) : ''}
  ${parametrosHtml ? section('12', 'Critérios Configurados', parametrosHtml) : ''}
  ${redFlagsHtml ? section('13', 'Red Flags do Edital', redFlagsHtml) : ''}
  ${(result.vantagens?.length || result.desvantagens?.length) ? `
  <div class="two-col">
    ${result.vantagens?.length ? `<div class="col-box"><h4>✅ Pontos Favoráveis</h4>${listHtml(result.vantagens)}</div>` : ''}
    ${result.desvantagens?.length ? `<div class="col-box"><h4>❌ Pontos Desfavoráveis</h4>${listHtml(result.desvantagens)}</div>` : ''}
  </div>` : ''}
  ${habilitacaoHtml ? section('14', 'Checklist de Habilitação', habilitacaoHtml) : ''}
  ${riscosHtml ? section('15', 'Matriz de Riscos', riscosHtml) : ''}
  ${oportunidadesHtml ? section('16', 'Oportunidades Estratégicas', oportunidadesHtml) : ''}
  ${section('17', 'Fundamentação Legal e Parecer Especialista',
    `<p>${esc(result.parecer_especialista || result.rationale || 'Sem parecer detalhado disponível para esta análise.')}</p>`
  )}
  ${result.exigencias_criticas?.length ? section('18', 'Exigências Críticas', listHtml(result.exigencias_criticas)) : ''}
  ${result.documentos_necessarios?.length ? section('19', 'Documentos Necessários', listHtml(result.documentos_necessarios)) : ''}
  ${checklistHtml ? section('20', 'Checklist de Participação', checklistHtml) : ''}
  ${scoreBreakdownHtml ? section('21', 'Composição do Score', scoreBreakdownHtml) : ''}
  ${pricingHtml ? section('22', 'Inteligência de Preços', pricingHtml) : ''}
  ${concorrentesHtml ? section('23', 'Concorrência', concorrentesHtml) : ''}
  ${result.criterios_de_julgamento?.length ? section('24', 'Critérios de Julgamento', listHtml(result.criterios_de_julgamento)) : ''}
  <div class="signature">
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Responsável Técnico</p>
      <p class="sig-sub">Nome / Cargo</p>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Validação Jurídica</p>
      <p class="sig-sub">OAB/UF nº _________</p>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Aprovação Diretoria</p>
      <p class="sig-sub">Data: ___/___/______</p>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
}
