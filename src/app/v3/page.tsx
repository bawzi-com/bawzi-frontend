'use client';
/* DIREÇÃO C — Ferramenta primeiro. A caixa de colar edital é o herói, como um
   buscador. Título curto acima, tudo o mais abaixo. Tempo até o valor é o
   argumento inteiro: quem chega com edital em mãos usa em 5 segundos. */
export default function V3() {
  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      <div className="mx-auto max-w-[820px] px-8 pt-28 pb-24 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: '#34D399' }}>
          Decisão Go / No-Go para licitações
        </p>
        <h1 className="mt-6 text-[44px] font-black leading-[1.08] tracking-tight text-white">
          Cole o edital. Receba o veredito.
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-[16px] font-medium leading-relaxed" style={{ color: '#94A3B8' }}>
          Robôs trabalham nos lances. Nós trabalhamos antes — para que você entre apenas nas disputas que vale ganhar.
        </p>

        <div className="mt-10 rounded-3xl bg-white p-3" style={{ boxShadow: '0 40px 90px -40px rgba(0,0,0,.8)' }}>
          <div className="rounded-2xl px-5 py-5 text-left" style={{ background: '#F8FAFC' }}>
            <p className="text-[15px]" style={{ color: '#94A3B8' }}>
              Cole aqui o objeto, o termo de referência ou o edital inteiro…
            </p>
            <div className="mt-14 flex items-center justify-between">
              <button className="rounded-lg border border-dashed px-3 py-2 text-[12px] font-bold"
                      style={{ borderColor: '#CBD5E1', color: '#64748B' }}>
                Usar um edital de exemplo →
              </button>
              <span className="text-[11px] font-bold" style={{ color: '#94A3B8' }}>0 / 10.000</span>
            </div>
          </div>
          <button className="mt-3 h-14 w-full rounded-2xl text-[15px] font-black text-white" style={{ background: '#059669' }}>
            Analisar gratuitamente
          </button>
        </div>

        <p className="mt-5 text-[13px] font-medium" style={{ color: '#64748B' }}>
          10 análises grátis por dia · sem cadastro · o edital não sai do seu ambiente
        </p>

        <div className="mt-16 flex items-center justify-center gap-8 text-[12px] font-semibold" style={{ color: '#475569' }}>
          {['PNCP oficial', 'Veredito em minutos', 'Sem cartão'].map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}
