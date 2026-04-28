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
  ArrowLeft,
  Settings,
  Briefcase,
  Search,
  Edit2,
  Mail, 
  Server,
  LayoutDashboard,
  Save,
  Lock,
  LayoutTemplate,
  Image as ImageIcon
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  
  // Estados de Dados
  const [data, setData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'templates' | 'settings'>('overview');

  // Estados do Formulário SMTP
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpName, setSmtpName] = useState('Bawzi');
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Estados dos Templates de E-mail
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('bawzi_token'); 
    
    if (!token) {
      setError("Acesso não autorizado. Redirecionando para o login...");
      setTimeout(() => router.push('/login'), 3000);
      setLoading(false);
      return;
    }

    async function loadDashboardData(authToken: string) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const headers = { 
          'Authorization': `Bearer ${authToken}`, 
          'Content-Type': 'application/json'
        };

        // 🟢 Busca KPIs, Utilizadores, SMTP e Templates em paralelo
        const [statsRes, usersRes, smtpRes, templatesRes] = await Promise.all([
          fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/stats`, { headers }),
          fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/users`, { headers }),
          fetch(`${baseUrl.replace(/\/$/, '')}/api/email/smtp`, { headers }),
          fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/email-templates`, { headers }) // Requer a nova rota GET no backend
        ]);

        if (!statsRes.ok || !usersRes.ok) {
          if (statsRes.status === 403) throw new Error("Acesso negado: Apenas administradores.");
          if (statsRes.status === 401) throw new Error("Sessão inválida ou expirada.");
          throw new Error("Erro ao carregar dados do painel de comando.");
        }

        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        
        setData(statsData);
        setUsers(usersData);

        // Preenche o formulário SMTP
        if (smtpRes.ok) {
          const smtpData = await smtpRes.json();
          setSmtpUser(smtpData.username || '');
          setSmtpPass(smtpData.password || '');
          setSmtpName(smtpData.from_name || 'Bawzi');
        }

        // Preenche os Templates
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData);
          if (templatesData.length > 0) {
              handleSelectTemplate(templatesData[0]);
          }
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData(token);
  }, [router]);

  // ==========================================
  // FUNÇÕES DE AÇÃO (API)
  // ==========================================
  const handleTierChange = async (userId: string, userEmail: string, currentTier: number) => {
    const newTierStr = prompt(`Digite o novo Tier (0 a 4) para ${userEmail}:\nAtual: ${currentTier}\n\n0: Visitante | 1: Grátis | 2: Essencial | 3: Pro | 4: Elite`);
    if (newTierStr === null || newTierStr === "") return;
    
    const newTier = parseInt(newTierStr);
    if (isNaN(newTier) || newTier < 0 || newTier > 4) {
      alert("Tier inválido. Por favor, insira um número entre 0 e 4.");
      return;
    }

    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/users/${userId}/tier`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_tier: newTier })
      });

      if (res.ok) {
        alert(`Sucesso! Tier de ${userEmail} atualizado para Nível ${newTier}.`);
        setUsers(users.map(u => u.id === userId ? { ...u, tier: newTier, workspace_tier: newTier } : u));
      } else {
        const errorData = await res.json();
        alert(`Erro ao atualizar: ${errorData.detail || 'Tente novamente.'}`);
      }
    } catch (e) {
      alert("Erro de comunicação com o servidor.");
    }
  };

  const handleEmailChange = async (userId: string, currentEmail: string) => {
    const newEmail = prompt(`Digite o NOVO e-mail para substituir: ${currentEmail}`);
    if (!newEmail || newEmail === currentEmail) return;

    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      alert("Formato de e-mail inválido.");
      return;
    }

    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/users/${userId}/email`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail })
      });

      if (res.ok) {
        alert("E-mail atualizado com sucesso!");
        setUsers(users.map(u => u.id === userId ? { ...u, email: newEmail.toLowerCase() } : u));
      } else {
        const errorData = await res.json();
        alert(`Erro: ${errorData.detail}`);
      }
    } catch (e) {
      alert("Erro de comunicação com o servidor.");
    }
  };

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/email/smtp`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: smtpUser, password: smtpPass, from_name: smtpName })
      });
      if(res.ok) {
        alert("✅ Configurações do servidor Titan salvas com sucesso!");
      } else {
        alert("Erro ao salvar as configurações SMTP.");
      }
    } catch (e) {
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setSavingSmtp(false);
    }
  };

  // ==========================================
  // FUNÇÕES DOS TEMPLATES DE E-MAIL
  // ==========================================
  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplateSubject(template.subject);
    setTemplateHtml(template.html_content);
    setUploadedImageUrl(''); // Limpa a url da imagem ao trocar de template
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // FormData não precisa de Content-Type explicitado
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setUploadedImageUrl(data.url);
      } else {
        alert("Erro ao fazer upload da imagem.");
      }
    } catch (error) {
      alert("Erro de comunicação com o servidor.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    
    setSavingTemplate(true);
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/email-templates/${selectedTemplate.slug}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: templateSubject, 
          html_content: templateHtml 
        })
      });

      if (res.ok) {
        alert("✅ Template atualizado com sucesso!");
        // Atualiza o estado local para não precisar recarregar
        setTemplates(templates.map(t => t.slug === selectedTemplate.slug ? { ...t, subject: templateSubject, html_content: templateHtml } : t));
      } else {
        alert("Erro ao salvar o template.");
      }
    } catch (e) {
      alert("Erro ao comunicar com o servidor.");
    } finally {
      setSavingTemplate(false);
    }
  };


  // ==========================================
  // RENDERIZAÇÃO DE ECRÃS DE ESTADO
  // ==========================================
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="h-12 w-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4"></div>
      <p className="font-bold tracking-[0.2em] text-violet-300 animate-pulse">AUTENTICANDO COMANDANTE...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/20 p-10 rounded-[2.5rem] text-center max-w-md shadow-2xl">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="text-red-500 w-10 h-10" /></div>
        <h2 className="text-white text-2xl font-black mb-4 tracking-tight">Falha de Segurança</h2>
        <p className="text-slate-400 font-medium leading-relaxed mb-8">{error}</p>
        <button onClick={() => router.push('/login')} className="flex items-center gap-2 mx-auto text-violet-400 font-bold hover:text-violet-300 transition-colors">
          <ArrowLeft size={18} /> Voltar para o Início
        </button>
      </div>
    </div>
  );

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  // ==========================================
  // RENDERIZAÇÃO PRINCIPAL
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-violet-500/30">
      
      {/* HEADER ESTRATÉGICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-1 bg-violet-500 rounded-full"></div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-white via-white to-violet-400 bg-clip-text text-transparent italic tracking-tighter">
              BAWZI COMMAND
            </h1>
          </div>
          <p className="text-slate-500 font-medium ml-4">Controlo absoluto da infraestrutura e tração.</p>
        </div>
        
        <div className="bg-emerald-500/5 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.15em]">Sistemas Online</span>
        </div>
      </div>

      {/* 🟢 NAVEGAÇÃO DE ABAS (TABS) */}
      <div className="flex gap-2 border-b border-slate-800 mb-10 pb-px overflow-x-auto">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'overview' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <LayoutDashboard size={18} /> Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'users' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <Users size={18} /> Contas & Acessos
        </button>
        <button 
          onClick={() => setActiveTab('templates')} 
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'templates' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <LayoutTemplate size={18} /> Templates de E-mail
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'settings' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <Settings size={18} /> Configurações
        </button>
      </div>

      {/* ========================================== */}
      {/* ABA 1: VISÃO GERAL */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard icon={<Users />} label="Utilizadores" value={data.kpis.usuarios} color="text-blue-400" />
            <StatCard icon={<FileText />} label="Análises Totais" value={data.kpis.analises_totais} color="text-violet-400" />
            <StatCard icon={<Zap />} label="Requisições 24h" value={data.kpis.analises_24h} color="text-amber-400" />
            <StatCard icon={<TrendingUp />} label="Clientes Pagos" value={data.kpis.conversao_pro} color="text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full" style={{ width: `${(user.total / data.heavy_users[0].total) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                      <div className="bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-500 h-full rounded-full" style={{ width: `${(count / data.kpis.usuarios) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ABA 2: GESTÃO DE UTILIZADORES */}
      {/* ========================================== */}
      {activeTab === 'users' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl"><Users size={24} className="text-blue-400" /></div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">Gestão de Contas</h2>
                <p className="text-slate-500 text-sm mt-1">Altere e-mails e atualize limites de acesso.</p>
              </div>
            </div>
            
            <div className="relative w-full md:w-72">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar por e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-widest">
                  <th className="pb-4 pl-4 font-black"><div className="flex items-center gap-2"><Mail size={14}/> E-mail da Conta</div></th>
                  <th className="pb-4 font-black"><div className="flex items-center gap-2"><Briefcase size={14}/> Workspace</div></th>
                  <th className="pb-4 font-black"><div className="flex items-center gap-2"><ShieldAlert size={14}/> Nível Atual</div></th>
                  <th className="pb-4 pr-4 font-black text-right">Ação Administrativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 font-medium">
                      Nenhum utilizador encontrado com este e-mail.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any) => {
                    const currentTier = user.workspace_tier || user.tier || 0;
                    
                    let tierColor = "bg-slate-500/20 text-slate-400 border-slate-500/20"; 
                    if (currentTier === 1) tierColor = "bg-blue-500/20 text-blue-400 border-blue-500/20";
                    if (currentTier === 2) tierColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/20";
                    if (currentTier === 3) tierColor = "bg-violet-500/20 text-violet-400 border-violet-500/20";
                    if (currentTier === 4) tierColor = "bg-amber-500/20 text-amber-400 border-amber-500/20";

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="py-5 pl-4">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-slate-200">{user.email}</span>
                            <button 
                              onClick={() => handleEmailChange(user.id, user.email)}
                              className="text-slate-600 hover:text-blue-400 transition-colors p-1"
                              title="Corrigir E-mail"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="py-5 text-slate-400 text-sm">{user.workspace_name}</td>
                        <td className="py-5">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-black border tracking-wider ${tierColor}`}>
                            TIER {currentTier}
                          </span>
                        </td>
                        <td className="py-5 pr-4 text-right">
                          <button 
                            onClick={() => handleTierChange(user.id, user.email, currentTier)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-violet-600 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700 hover:border-violet-500 focus:ring-2 focus:ring-violet-500/50 outline-none"
                          >
                            <Settings size={14} /> Update Tier
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ABA 3: TEMPLATES DE E-MAIL */}
      {/* ========================================== */}
      {activeTab === 'templates' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
          
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-md shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl"><LayoutTemplate size={24} className="text-emerald-400" /></div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Estúdio de Templates</h2>
                  <p className="text-slate-500 text-sm mt-1">Gira o layout e o conteúdo dos e-mails transacionais.</p>
                </div>
              </div>
              
              {/* Seletor de Template */}
              <select 
                className="bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
                value={selectedTemplate?.slug || ''}
                onChange={(e) => {
                  const tmpl = templates.find(t => t.slug === e.target.value);
                  if (tmpl) handleSelectTemplate(tmpl);
                }}
              >
                <option value="" disabled>Selecione um template...</option>
                {templates.map(t => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </div>

            {selectedTemplate ? (
              <div className="space-y-6">
                
                {/* Dicas de Variáveis */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex gap-3">
                  <div className="text-emerald-400"><AlertCircle size={18} /></div>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">Variáveis dinâmicas para este template:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.placeholders?.map((ph: string) => (
                        <span key={ph} className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-xs text-slate-400 font-mono">
                          {`{{${ph}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Upload de Imagem */}
                <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-2xl">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <ImageIcon size={14} /> Carregar Imagem para o E-mail
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-xl file:border-0
                        file:text-sm file:font-black
                        file:bg-emerald-500/10 file:text-emerald-400
                        hover:file:bg-emerald-500/20 file:transition-colors
                        disabled:opacity-50"
                    />
                  </div>
                  {uploadingImage && <p className="text-xs text-slate-500 mt-2 italic">A enviar imagem para o servidor...</p>}
                  {uploadedImageUrl && (
                    <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <p className="text-xs text-emerald-400 font-bold mb-1">Imagem pronta! Copie e cole no src="" do HTML abaixo:</p>
                      <code className="text-sm text-white select-all break-all">{uploadedImageUrl}</code>
                    </div>
                  )}
                </div>

                {/* Editor de Assunto */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Edit2 size={14} /> Assunto do E-mail
                  </label>
                  <input
                    type="text"
                    required
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>

                {/* Editor HTML */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} /> Código HTML
                  </label>
                  <textarea
                    value={templateHtml}
                    onChange={(e) => setTemplateHtml(e.target.value)}
                    rows={15}
                    className="w-full bg-[#0d1117] border border-slate-800 rounded-xl py-4 px-4 text-slate-300 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-y"
                    spellCheck="false"
                  ></textarea>
                </div>

                <div className="pt-4 border-t border-slate-800/50 flex justify-end">
                  <button 
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={18} />
                    {savingTemplate ? 'A Guardar...' : 'Salvar Layout'}
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 font-medium">
                Selecione um template acima para começar a editar.
                <br />(Certifique-se de que o backend já retornou os templates).
              </div>
            )}
          </div>
          
        </div>
      )}

      {/* ========================================== */}
      {/* ABA 4: CONFIGURAÇÕES GERAIS */}
      {/* ========================================== */}
      {activeTab === 'settings' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
          
          {/* 🟢 FORMULÁRIO DO SERVIDOR DE E-MAIL (SMTP) */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-amber-500/10 rounded-2xl"><Server size={24} className="text-amber-400" /></div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">Motor de Comunicação (SMTP)</h2>
                <p className="text-slate-500 text-sm mt-1">Configure o servidor Titan para o envio de e-mails transacionais em background.</p>
              </div>
            </div>

            <form onSubmit={handleSaveSMTP} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail size={14} /> E-mail de Disparo (Username)
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="ex: hello@bawzi.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={14} /> Senha do E-mail
                  </label>
                  <input
                    type="password"
                    required
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="********"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Edit2 size={14} /> Nome do Remetente
                </label>
                <input
                  type="text"
                  required
                  value={smtpName}
                  onChange={(e) => setSmtpName(e.target.value)}
                  placeholder="ex: Equipe Bawzi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-800/50 flex justify-end">
                <button 
                  type="submit"
                  disabled={savingSmtp}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {savingSmtp ? 'A Guardar...' : 'Gravar Credenciais SMTP'}
                </button>
              </div>
            </form>
          </div>
          
        </div>
      )}

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