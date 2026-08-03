'use client';
/* DIREÇÃO B — O veredito é o herói. Em vez de descrever o produto, mostra a
   saída dele em tela cheia. O visitante entende em dois segundos o que recebe,
   porque está olhando para isso. Cor vem da própria linguagem do produto:
   verde entra, âmbar entra com ressalva, vermelho não entra. */
export default function V2() {
  const dims = [
    ['CNAE', 'Aderência parcial', '#d97706', 62],
    ['Jurídico', '2 cláusulas críticas', '#dc2626', 78],
    ['Preço', 'Margem pressionada', '#d97706', 55],
    ['Concorrência', '3 recorrentes na região', '#0284c7', 71],
  ] as const;
  return (
    <div className="min-h-screen" style={{ background: '#F5F6F8' }}>
      <div className="mx-auto max-w-[1180px] px-8 pt-16 pb-20">
        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: '#059669' }}>
            É isto que você recebe · exemplo real de laudo
          </p>
          <h1 className="mx-auto mt-5 max-w-[760px] text-[46px] font-black leading-[1.06] tracking-tight" style={{ color: '#0F172A' }}>
            Robôs trabalham nos lances. Nós trabalhamos antes.
          </h1>
        </div>

        <div className="mt-12 overflow-hidden rounded-3xl bg-white" style={{ boxShadow: '0 40px 80px -50px rgba(15,23,42,.5)' }}>
          <div className="grid" style={{ gridTemplateColumns: '1.1fr .9fr' }}>
            <div className="border-r p-9" style={{ borderColor: '#EEF0F3' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: '#94A3B8' }}>Edital analisado</p>
              <p className="mt-2 text-[19px] font-black leading-snug" style={{ color: '#0F172A' }}>
                Pregão eletrônico · registro de preços para medicamentos hospitalares
              </p>
              <div className="mt-7 space-y-4">
                {dims.map(([n, v, c, w]) => (
                  <div key={n}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-black" style={{ color: '#1F2937' }}>{n}</span>
                      <span className="text-[13px] font-semibold" style={{ color: c }}>{v}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full" style={{ background: '#EEF0F3' }}>
                      <div className="h-1.5 rounded-full" style={{ width: w + '%', background: c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-9" style={{ background: '#FFFBEB' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: '#B45309' }}>Veredito</p>
              <p className="mt-3 text-[40px] font-black leading-none" style={{ color: '#B45309' }}>Go condicionado</p>
              <p className="mt-4 text-[15px] font-medium leading-relaxed" style={{ color: '#57534E' }}>
                Vale avançar, desde que a equipe confirme a documentação e proteja a margem antes de propor.
              </p>
              <div className="mt-7 space-y-2.5">
                {['Validar atestado de 50% do quantitativo', 'Definir preço mínimo antes do pregão', 'Revisar prazo de entrega de 5 dias'].map((s, i) => (
                  <div key={s} className="flex gap-3 rounded-xl bg-white px-4 py-3">
                    <span className="text-[12px] font-black" style={{ color: '#B45309' }}>{i + 1}</span>
                    <span className="text-[13.5px] font-semibold" style={{ color: '#292524' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <a href="#" className="inline-flex h-14 items-center rounded-full px-9 text-[15px] font-black text-white" style={{ background: '#059669' }}>
            Fazer isto com o seu edital
          </a>
          <p className="mt-3 text-[13px] font-medium" style={{ color: '#64748B' }}>10 análises grátis por dia · sem cadastro</p>
        </div>
      </div>
    </div>
  );
}
