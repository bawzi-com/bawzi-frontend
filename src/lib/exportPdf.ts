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
  <title>Parecer Técnico-Jurídico — Bawzi Intelligence</title>
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
      <p>Parecer Técnico-Jurídico Preliminar — Análise de Edital</p>
    </div>
    <div class="header-meta">
      <strong>${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
      Score Bawzi: ${result.score}/100
    </div>
  </div>
  <div class="warning">
    ⚠️ NOTA DE RESPONSABILIDADE: Este documento foi gerado por Inteligência Artificial para facilitar a triagem de editais. A revisão, validação e assinatura por um profissional habilitado é indispensável antes do uso oficial.
  </div>
  <div class="score-card">
    <div class="score-circle">${result.score}</div>
    <div class="score-info">
      <h2>${esc(result.title || 'Análise de Edital')}</h2>
      <span class="class">${esc(result.classification || '—')}</span>
      <p>${esc(result.recommendation || result.rationale || '')}</p>
    </div>
  </div>
  ${section('1', 'Resumo Executivo', `<p>${esc(result.summary)}</p>`)}
  ${semaforoHtml ? section('2', 'Semáforo de Viabilidade', semaforoHtml) : ''}
  ${datasHtml ? section('3', 'Cronograma Crítico', datasHtml) : ''}
  ${(result.vantagens?.length || result.desvantagens?.length) ? `
  <div class="two-col">
    ${result.vantagens?.length ? `<div class="col-box"><h4>✅ Pontos Favoráveis</h4>${listHtml(result.vantagens)}</div>` : ''}
    ${result.desvantagens?.length ? `<div class="col-box"><h4>❌ Pontos Desfavoráveis</h4>${listHtml(result.desvantagens)}</div>` : ''}
  </div>` : ''}
  ${riscosHtml ? section('4', 'Matriz de Riscos', riscosHtml) : ''}
  ${section('5', 'Fundamentação Legal e Parecer Especialista',
    `<p>${esc(result.parecer_especialista || result.rationale || 'Sem parecer detalhado disponível para esta análise.')}</p>`
  )}
  ${result.exigencias_criticas?.length ? section('6', 'Exigências Críticas', listHtml(result.exigencias_criticas)) : ''}
  ${result.documentos_necessarios?.length ? section('7', 'Documentos Necessários', listHtml(result.documentos_necessarios)) : ''}
  ${checklistHtml ? section('8', 'Checklist de Participação', checklistHtml) : ''}
  ${pricingHtml ? section('9', 'Inteligência de Preços', pricingHtml) : ''}
  ${result.criterios_de_julgamento?.length ? section('10', 'Critérios de Julgamento', listHtml(result.criterios_de_julgamento)) : ''}
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
