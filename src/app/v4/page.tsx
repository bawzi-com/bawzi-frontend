'use client';
/* DIREÇÃO D — a combinação: tipografia e papel de A, a caixa de colar de C,
   o laudo de B. A sequência é um argumento: afirma quem você é, deixa
   experimentar na hora, e só então mostra o que a versão completa entrega.
   Declaração → ação → prova. */
export default function V4() {
  const dims = [
    ['CNAE', 'Aderência parcial', '#d97706', 62],
    ['Jurídico', '2 cláusulas críticas', '#dc2626', 78],
    ['Preço', 'Margem pressionada', '#d97706', 55],
    ['Concorrência', '3 recorrentes na região', '#0284c7', 71],
  ] as const;

  return (
    <div style={{ background: '#FBFAF7' }}>
      {/* ── Declaração + ação, tudo acima da dobra ───────────────────── */}
      <div className="mx-auto max-w-[1180px] px-8 pt-20 pb-16">
        <div className="grid items-start gap-14" style={{ gridTemplateColumns: '1fr 520px' }}>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: '#047857' }}>
              Decisão Go / No-Go para licitações
            </p>
            <h1 className="mt-7 text-[56px] font-black leading-[0.99] tracking-[-0.03em]" style={{ color: '#111827' }}>
              Robôs trabalham<br />nos lances.<br />
              <span style={{ color: '#047857' }}>Nós trabalhamos antes.</span>
            </h1>
            <p className="mt-7 max-w-[430px] text-[17px] font-medium leading-[1.6]" style={{ color: '#4B5563' }}>
              A Bawzi lê o edital inteiro e devolve um veredito: entrar, entrar com
              ressalvas, ou não entrar. Antes de você gastar equipe, preço e risco
              na disputa errada.
            </p>
            <p className="mt-5 max-w-[430px] text-[13.5px] font-bold leading-6" style={{ color: '#9CA3AF' }}>
              Não fazemos a gestão do processo. Agimos na decisão — participar ou não — antes da execução.
            </p>
          </div>

          <div className="rounded-3xl border bg-white p-3" style={{ borderColor: '#EAE7E1', boxShadow: '0 30px 70px -45px rgba(17,24,39,.4)' }}>
            <div className="rounded-2xl px-5 pt-5 pb-4" style={{ background: '#F7F6F3' }}>
              <p className="text-[14.5px] leading-relaxed" style={{ color: '#9CA3AF' }}>
                Cole aqui o objeto, o termo de referência ou o edital inteiro…
              </p>
              <div className="mt-16 flex items-center justify-between">
                <button className="rounded-lg border border-dashed px-3 py-1.5 text-[11.5px] font-bold"
                        style={{ borderColor: '#D6D3CD', color: '#6B7280' }}>
                  Usar um edital de exemplo →
                </button>
                <span className="text-[11px] font-bold" style={{ color: '#B6B2AA' }}>0 / 10.000</span>
              </div>
            </div>
            <button className="mt-3 h-13 w-full rounded-2xl py-4 text-[15px] font-black text-white" style={{ background: '#047857' }}>
              Analisar gratuitamente
            </button>
            <p className="mt-3 pb-1 text-center text-[12px] font-semibold" style={{ color: '#9CA3AF' }}>
              10 análises grátis por dia · sem cadastro · o edital não sai do seu ambiente
            </p>
          </div>
        </div>
      </div>

      {/* ── Prova: é isto que sai ────────────────────────────────────── */}
      <div style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto max-w-[1180px] px-8 py-16">
          <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>
            É isto que você recebe · exemplo de laudo
          </p>
          <h2 className="mt-4 max-w-[620px] text-[34px] font-black leading-[1.1] tracking-tight" style={{ color: '#111827' }}>
            Um veredito, com o motivo e o que fazer em seguida.
          </h2>

          <div className="mt-9 overflow-hidden rounded-3xl border bg-white" style={{ borderColor: '#EAE7E1' }}>
            <div className="grid" style={{ gridTemplateColumns: '1.15fr .85fr' }}>
              <div className="border-r p-8" style={{ borderColor: '#EFEDE8' }}>
                <p className="text-[10.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#B6B2AA' }}>Edital analisado</p>
                <p className="mt-2 text-[18px] font-black leading-snug" style={{ color: '#111827' }}>
                  Pregão eletrônico · registro de preços para medicamentos hospitalares
                </p>
                <div className="mt-7 space-y-4">
                  {dims.map(([n, v, c, w]) => (
                    <div key={n}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-black" style={{ color: '#374151' }}>{n}</span>
                        <span className="text-[12.5px] font-bold" style={{ color: c }}>{v}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full" style={{ background: '#F1EFEA' }}>
                        <div className="h-1.5 rounded-full" style={{ width: w + '%', background: c }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-8" style={{ background: '#FFFCF2' }}>
                <p className="text-[10.5px] font-black uppercase tracking-[0.18em]" style={{ color: '#B45309' }}>Veredito</p>
                <p className="mt-3 text-[34px] font-black leading-none" style={{ color: '#B45309' }}>Go condicionado</p>
                <p className="mt-4 text-[14.5px] font-medium leading-relaxed" style={{ color: '#57534E' }}>
                  Vale avançar, desde que a equipe confirme a documentação e proteja a margem antes de propor.
                </p>
                <div className="mt-6 space-y-2">
                  {['Validar atestado de 50% do quantitativo',
                    'Definir preço mínimo antes do pregão',
                    'Revisar prazo de entrega de 5 dias úteis'].map((s, i) => (
                    <div key={s} className="flex gap-3 rounded-xl border bg-white px-4 py-2.5" style={{ borderColor: '#F0E9D8' }}>
                      <span className="text-[12px] font-black" style={{ color: '#B45309' }}>{i + 1}</span>
                      <span className="text-[13px] font-bold" style={{ color: '#292524' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-px" style={{ background: '#E5E2DC', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[['Fonte', 'PNCP oficial'], ['Privacidade', 'O edital não sai do seu ambiente'],
              ['Tempo', 'Veredito em minutos'], ['Compromisso', 'Sem cartão, cancele quando quiser']].map(([k, v]) => (
              <div key={k} className="px-6 py-6" style={{ background: '#F3F2EE' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8A49B' }}>{k}</p>
                <p className="mt-2 text-[14.5px] font-bold leading-snug" style={{ color: '#1F2937' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
