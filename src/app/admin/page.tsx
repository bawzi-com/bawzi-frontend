'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  FileText, 
  Zap, 
  ShieldAlert, 
  BarChart3, 
  TrendingUp, 
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('bawzi_token'); 
    
    if (!token) {
      setError("Acesso não autorizado. Redirecionando para o login...");
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      setLoading(false);
      return;
    }

    async function loadStats(authToken: string) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/admin/stats`;

        const res = await fetch(apiUrl, {
          headers: { 
            'Authorization': `Bearer ${authToken}`, // Agora o authToken será o 'bawzi_token'
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          if (res.status === 403) throw new Error("Acesso negado: Apenas e-mails @bawzi.com podem aceder.");
          if (res.status === 401) throw new Error("Sessão inválida ou expirada.");
          throw new Error("Erro ao carregar estatísticas.");
        }

        const stats = await res.json();
        setData(stats);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadStats(token);
  }, [router]);

  // Ecrã de Carregamento
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="h-12 w-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4"></div>
      <p className="font-bold tracking-[0.2em] text-violet-300 animate-pulse">AUTENTICANDO COMANDANTE...</p>
    </div>
  );

  // Ecrã de Erro / Acesso Negado
  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/20 p-10 rounded-[2.5rem] text-center max-w-md shadow-2xl">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-500 w-10 h-10" />
        </div>
        <h2 className="text-white text-2xl font-black mb-4 tracking-tight">Falha de Segurança</h2>
        <p className="text-slate-400 font-medium leading-relaxed mb-8">{error}</p>
        <button 
          onClick={() => router.push('/login')}
          className="flex items-center gap-2 mx-auto text-violet-400 font-bold hover:text-violet-300 transition-colors"
        >
          <ArrowLeft size={18} /> Voltar para o Início
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-violet-500/30">
      {/* HEADER ESTRATÉGICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-1 bg-violet-500 rounded-full"></div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-white via-white to-violet-400 bg-clip-text text-transparent italic tracking-tighter">
              BAWZI COMMAND CENTER
            </h1>
          </div>
          <p className="text-slate-500 font-medium ml-4">Monitoramento em tempo real da infraestrutura e tração.</p>
        </div>
        
        <div className="bg-emerald-500/5 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.15em]">Sistemas Online</span>
        </div>
      </div>

      {/* MÉTRICAS DE PERFORMANCE (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<Users />} label="Utilizadores" value={data.kpis.usuarios} color="text-blue-400" />
        <StatCard icon={<FileText />} label="Análises Totais" value={data.kpis.analises_totais} color="text-violet-400" />
        <StatCard icon={<Zap />} label="Requisições 24h" value={data.kpis.analises_24h} color="text-amber-400" />
        <StatCard icon={<TrendingUp />} label="Clientes Pagos" value={data.kpis.conversao_pro} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* RANKING DE CONSUMO */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 rounded-2xl"><BarChart3 size={24} className="text-violet-400" /></div>
              <h2 className="text-2xl font-black tracking-tight">Heavy Users</h2>
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/50 px-4 py-2 rounded-xl">Consumo de API</span>
          </div>
          
          <div className="space-y-2">
            {data.heavy_users.map((user: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-5 rounded-2xl hover:bg-white/[0.03] transition-all group border border-transparent hover:border-slate-800">
                <div className="flex items-center gap-6">
                  <span className="text-slate-700 font-black text-xl w-6">{(i + 1).toString().padStart(2, '0')}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{user.email}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Identificado via JWT</span>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <span className="text-violet-400 font-black text-lg block leading-none">{user.total.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Requisições</span>
                  </div>
                  <div className="h-1.5 w-24 bg-slate-800/50 rounded-full overflow-hidden hidden xl:block border border-slate-700/30">
                     <div 
                        className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${(user.total / data.heavy_users[0].total) * 100}%` }}
                     ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAÚDE DOS TIERS */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-amber-500/10 rounded-2xl"><ShieldAlert size={24} className="text-amber-400" /></div>
            <h2 className="text-2xl font-black tracking-tight">Monetização</h2>
          </div>
          
          <div className="space-y-10">
            {Object.entries(data.tiers).map(([tier, count]: any) => (
              <div key={tier} className="group">
                <div className="flex justify-between mb-3 items-end">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1 group-hover:text-slate-300 transition-colors">Segmento</span>
                    <span className="text-slate-100 font-black tracking-tight">{tier}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">{count}</span>
                    <span className="text-slate-600 text-[10px] block font-bold">Contas</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800/30 h-3 rounded-full overflow-hidden border border-slate-700/20">
                  <div 
                    className="bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${(count / data.kpis.usuarios) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-[2.5rem] hover:border-violet-500/40 transition-all group relative overflow-hidden shadow-lg">
      <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">
        {icon && typeof icon === 'object' ? { ...icon, props: { ...icon.props, size: 80 } } : icon}
      </div>
      <div className={`w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner ${color}`}>
        {icon}
      </div>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.25em]">{label}</p>
      <p className="text-4xl font-black mt-2 tracking-tighter text-white">{value?.toLocaleString() || 0}</p>
    </div>
  );
}