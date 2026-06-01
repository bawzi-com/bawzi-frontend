'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthModal from '../../components/AuthModal';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  const view = searchParams.get('view') === 'register' ? 'register' : 'login';
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
