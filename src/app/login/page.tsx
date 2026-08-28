'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthModal from '../../components/AuthModal';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  // ⚠️ `cadastro=1` é aceito de propósito como sinônimo de `view=register`.
  //    Os convites de equipe já foram enviados por e-mail com esse formato
  //    antigo e continuam circulando na caixa de entrada das pessoas. Corrigir
  //    só a origem (app/convite) deixaria quem recebeu o convite ontem caindo
  //    no formulário de login. Remover só quando os convites antigos expirarem.
  const view =
    searchParams.get('view') === 'register' || searchParams.get('cadastro') === '1'
      ? 'register'
      : 'login';
  const redirect = searchParams.get('redirect') || '/';

  const handleSuccess = () => {
    router.push(redirect);
  };

  const handleClose = () => {
    setOpen(false);
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <AuthModal
        isOpen={open}
        onClose={handleClose}
        defaultView={view}
        onSuccess={handleSuccess}
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <LoginContent />
    </Suspense>
  );
}
