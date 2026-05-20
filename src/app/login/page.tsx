'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthModal from '../../components/AuthModal';

export default function LoginPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  // Redirect to home after successful login
  const handleSuccess = () => {
    router.push('/');
  };

  // If the user closes without logging in, also go to home
  const handleClose = () => {
    setOpen(false);
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center">
      <AuthModal
        isOpen={open}
        onClose={handleClose}
        defaultView="login"
        onSuccess={handleSuccess}
      />
    </main>
  );
}
