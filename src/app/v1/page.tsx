'use client';
/* DIREÇÃO A — Editorial. Fundo claro, tipografia grande, um acento só.
   Argumento: o concorrente é robô de lance e todo mundo do setor usa herói
   escuro com gradiente. Um partido editorial — papel, tinta, muito respiro —
   lê como consultoria e não como startup, que é o que a Bawzi vende: parecer. */
export default function V1() {
  return (
    <div className="min-h-screen" style={{ background: '#FBFAF7' }}>
      <div className="mx-auto max-w-[1180px] px-8 pt-24 pb-20">
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: '#047857' }}>
          Decisão Go / No-Go para licitações
        </p>
        <h1 className="mt-8 max-w-[880px] text-[68px] font-black leading-[0.98] tracking-[-0.03em]" style={{ color: '#111827' }}>
          Robôs trabalham nos lances.<br />
          <span style={{ color: '#047857' }}>Nós trabalhamos antes.</span>
        </h1>
        <p className="mt-8 max-w-[560px] text-[19px] font-medium leading-[1.65]" style={{ color: '#4B5563' }}>
          A Bawzi lê o edital inteiro e devolve um veredito: entrar, entrar com ressalvas,
          ou não entrar. Antes de você gastar equipe, preço e risco na disputa errada.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href="#" className="inline-flex h-14 items-center rounded-full px-8 text-[15px] font-bold text-white"
             style={{ background: '#047857' }}>Analisar um edital</a>
          <a href="#" className="inline-flex h-14 items-center rounded-full border px-8 text-[15px] font-bold"
             style={{ borderColor: '#D6D3CD', color: '#111827' }}>Ver planos</a>
          <span className="text-[13px] font-medium" style={{ color: '#6B7280' }}>10 análises grátis por dia · sem cadastro</span>
        </div>
        <div className="mt-20 grid gap-px" style={{ background: '#E5E2DC', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[['Fonte', 'PNCP oficial'], ['Privacidade', 'O edital não sai do seu ambiente'],
            ['Tempo', 'Veredito em minutos'], ['Compromisso', 'Sem cartão, cancele quando quiser']].map(([k, v]) => (
            <div key={k} className="px-6 py-7" style={{ background: '#FBFAF7' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#9CA3AF' }}>{k}</p>
              <p className="mt-2 text-[15px] font-bold leading-snug" style={{ color: '#1F2937' }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
