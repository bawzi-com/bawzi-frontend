'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Componente-sentinela: expõe a querystring `?tab=` como valor reativo via
 *  `onChange`, para quem precisa saber a aba pedida na URL sem ficar preso
 *  a `usePathname()` — que só muda quando a ROTA muda.
 *
 *  ⚠️ Por que isto existe em vez de `usePathname()`: a Gestão vive em
 *  `/workspace?tab=gestao`, a MESMA rota da Área de trabalho — ir de uma
 *  para a outra troca só a querystring, e o `pathname` continua `/workspace`
 *  o tempo todo. `useSearchParams()` é o hook certo para isso, mas exige um
 *  `Suspense` em volta (o build do Next.js falha sem isso). Isolar a leitura
 *  aqui, num componente que só faz isso e não renderiza nada, deixa quem usa
 *  (`Header.tsx`, `analysis-app.tsx`) livre para manter sua própria lógica
 *  de estado sem precisar importar `Suspense` nem `useSearchParams` também.
 *
 *  Usado por dois arquivos sem relação de pai/filho entre si (Header.tsx
 *  vive no layout raiz; analysis-app.tsx é a página) — cada um passa o seu
 *  próprio `onChange` e mantém seu próprio estado. */
function TabWatcher({ onChange }: { onChange: (tab: string | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onChange(searchParams.get('tab'));
  }, [searchParams, onChange]);
  return null;
}

export default function TabQueryWatcher({ onChange }: { onChange: (tab: string | null) => void }) {
  return (
    <Suspense fallback={null}>
      <TabWatcher onChange={onChange} />
    </Suspense>
  );
}
