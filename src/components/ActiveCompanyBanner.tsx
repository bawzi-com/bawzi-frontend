'use client';

import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';

/**
 * Aviso persistente exibido no topo do workspace quando o usuário logado
 * não tem nenhuma empresa cadastrada/ativa. Sem isso, o match de CNAE,
 * o score e a triagem de editais perdem precisão silenciosamente — por
 * isso o alerta fica visível em vez de escondido na sidebar.
 */
export default function ActiveCompanyBanner() {
  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Building2 size={17} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            Nenhuma empresa ativa
          </p>
          <p className="mt-0.5 text-sm font-medium leading-5 text-amber-900/80">
            Cadastre o CNPJ da sua empresa para o match de CNAE e o score considerarem o seu perfil real.
          </p>
        </div>
      </div>
      <Link
        href="/profile"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-amber-700"
      >
        Cadastrar empresa <ArrowRight size={14} />
      </Link>
    </div>
  );
}
