'use client';

import { useEffect, useState, useRef } from 'react';
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
  Image as ImageIcon,
  Database,
  RefreshCw,
  MapPin,
  Play,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pncp' | 'templates' | 'settings' | 'tiers' | 'promo'>('overview');

  // Estados do Formulário SMTP
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpName, setSmtpName] = useState('Bawzi');
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Estados PNCP
  const [pncpStats, setPncpStats] = useState<any>(null);
  const [workersStatus, setWorkersStatus] = useState<any>(null);
  const [pncpLoading, setPncpLoading] = useState(false);
  const [workerAction, setWorkerAction] = useState<string | null>(null);
  const [municipiosUfs, setMunicipiosUfs] = useState('');
  const [fornecedoresUfs, setFornecedoresUfs] = useState('');
  const [consultaUfUfs, setConsultaUfUfs] = useState('');
  const [consultaUfJanelas, setConsultaUfJanelas] = useState('5');
  const [enrichViaConsultaUfs, setEnrichViaConsultaUfs] = useState('');
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);

  // Estados de Convites Promo
  const [promoEmail, setPromoEmail]   = useState('');
  const [promoDias, setPromoDias]     = useState(3);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [promoList, setPromoList]     = useState<any[]>([]);
  const [promoListLoading, setPromoListLoading] = useState(false);

  // Estados de Tiers
  const [tierConfigs, setTierConfigs] = useState<any[]>([]);
  const [tierEdits, setTierEdits] = useState<Record<number, any>>({});
  const [savingTier, setSavingTier] = useState<number | null>(null);
  const [tierMsg, setTierMsg] = useState<{ tier_id: number; text: string; ok: boolean } | null>(null);

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

  const loadPromoList = async () => {
    setPromoListLoading(true);
    const token = localStorage.getItem('bawzi_token');
    const base  = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/admin/promo-invites`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPromoList(await res.json());
    } catch { /* silencioso */ } finally { setPromoListLoading(false); }
  };

  const promoSubmittingRef = useRef(false);
  const handleEnviarPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoEmail.includes('@') || promoSubmittingRef.current) return;
    promoSubmittingRef.current = true;
    setPromoLoading(true); setPromoMsg(null);
    const token = localStorage.getItem('bawzi_token');
    const base  = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/admin/promo-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoEmail, dias: promoDias }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoMsg({ text: `✅ Convite enviado para ${data.email} (${data.dias} dias)`, ok: true });
        setPromoEmail('');
        loadPromoList();
      } else {
        setPromoMsg({ text: data.detail || 'Erro ao enviar.', ok: false });
      }
    } catch { setPromoMsg({ text: 'Erro de conexão.', ok: false }); }
    finally { setPromoLoading(false); promoSubmittingRef.current = false; setTimeout(() => setPromoMsg(null), 5000); }
  };

  const handleRevogarPromo = async (token_promo: string, email: string) => {
    if (!confirm(`Revogar convite de ${email}?`)) return;
    const token = localStorage.getItem('bawzi_token');
    const base  = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    await fetch(`${base}/api/admin/promo-invites/${token_promo}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    loadPromoList();
  };

  const loadTierConfigs = async () => {
    const token = localStorage.getItem('bawzi_token');
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    try {
      const res = await fetch(`${baseUrl}/api/admin/tier-configs`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTierConfigs(data);
        // Inicializa edits com os valores actuais
        const edits: Record<number, any> = {};
        data.forEach((t: any) => {
          edits[t.tier_id] = {
            monthly_limit:      t.monthly_limit,
            max_chars:          t.max_chars,
            max_mb:             t.max_mb,
            investigator_model: t.investigator_model,
            writer_model:       t.writer_model,
            agent_count:        t.agent_count ?? 1,
            opus_threshold:     t.opus_threshold ?? null,
          };
        });
        setTierEdits(edits);
      }
    } catch { /* silencioso */ }
  };

  const handleSaveTier = async (tierId: number) => {
    const token = localStorage.getItem('bawzi_token');
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    setSavingTier(tierId);
    setTierMsg(null);
    try {
      const body = tierEdits[tierId];
      const res = await fetch(`${baseUrl}/api/admin/tier-configs/${tierId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_limit: Number(body.monthly_limit),
          max_chars:     Number(body.max_chars),
          max_mb:        Number(body.max_mb),
        }),
      });
      if (res.ok) {
        setTierMsg({ tier_id: tierId, text: 'Salvo com sucesso!', ok: true });
        await loadTierConfigs();
      } else {
        const err = await res.json();
        setTierMsg({ tier_id: tierId, text: err.detail || 'Erro ao salvar.', ok: false });
      }
    } catch {
      setTierMsg({ tier_id: tierId, text: 'Erro de conexão.', ok: false });
    } finally {
      setSavingTier(null);
      setTimeout(() => setTierMsg(null), 3000);
    }
  };

  const handleResetTier = async (tierId: number) => {
    if (!confirm(`Restaurar Tier ${tierId} aos valores padrão?`)) return;
    const token = localStorage.getItem('bawzi_token');
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    try {
      await fetch(`${baseUrl}/api/admin/tier-configs/${tierId}/reset`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setTierMsg({ tier_id: tierId, text: 'Restaurado aos padrões.', ok: true });
      await loadTierConfigs();
      setTimeout(() => setTierMsg(null), 3000);
    } catch { /* silencioso */ }
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
  // FUNÇÕES PNCP / WORKERS
  // ==========================================
  const loadPncpData = async () => {
    setPncpLoading(true);
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      const [statsRes, statusRes, schedulerRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/pncp/stats`, { headers }),
        fetch(`${baseUrl}/api/admin/workers/status`, { headers }),
        fetch(`${baseUrl}/api/admin/scheduler/status`, { headers }),
      ]);
      if (statsRes.ok)     setPncpStats(await statsRes.json());
      if (statusRes.ok)    setWorkersStatus(await statusRes.json());
      if (schedulerRes.ok) setSchedulerStatus(await schedulerRes.json());
    } finally {
      setPncpLoading(false);
    }
  };

  const triggerWorkerContratos = async (modo: string) => {
    if (!confirm(`Iniciar worker de contratos em modo "${modo}"?\n\nTempo estimado:\n• sem_termo: ~3 min\n• rapido: ~30s\n• medio: ~10 min\n• maximo: ~45 min\n• completo: ~50 min`)) return;
    setWorkerAction(`contratos-${modo}`);
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/admin/workers/contratos?modo=${modo}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setTimeout(loadPncpData, 1500);
      } else {
        alert(`❌ ${data.detail || 'Erro ao iniciar worker.'}`);
      }
    } finally {
      setWorkerAction(null);
    }
  };

  const triggerWorkerFornecedores = async () => {
    const ufsLabel = fornecedoresUfs.trim() || 'todas as 27 UFs';
    if (!confirm(`Enriquecer fornecedores para: ${ufsLabel}?\n\nEste worker usa /api/consulta (tem nomeRazaoSocialFornecedor)\ne actualiza os contratos já indexados sem re-indexar.\n\nTempo: ~2-5 min por UF · ~1-2h completo`)) return;
    setWorkerAction('fornecedores');
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const qs = fornecedoresUfs.trim() ? `?ufs=${encodeURIComponent(fornecedoresUfs.trim())}` : '';
      const res = await fetch(`${baseUrl}/api/admin/workers/fornecedores${qs}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setTimeout(loadPncpData, 1500);
      } else {
        alert(`❌ ${data.detail || 'Erro ao iniciar worker.'}`);
      }
    } finally {
      setWorkerAction(null);
    }
  };

  const triggerWorkerEnrichViaConsulta = async () => {
    const ufsLabel = enrichViaConsultaUfs.trim() || 'todas as UFs com contratos sem fornecedor';
    if (!confirm(
      `Iniciar Enriquecimento Via Consulta para: ${ufsLabel}?\n\n` +
      `Este worker:\n` +
      `  1. Lê todos os contratos sem fornecedor no banco\n` +
      `  2. Agrupa por UF + janela mensal de data_vigencia_inicio\n` +
      `  3. Busca /api/consulta para cada janela (tem nomeRazaoSocialFornecedor)\n` +
      `  4. Faz match por NCP e atualiza fornecedor_nome no banco\n\n` +
      `Tempo estimado: ~30-90 min para todos os 137k contratos`
    )) return;
    setWorkerAction('enrich_via_consulta');
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const qs = new URLSearchParams();
      if (enrichViaConsultaUfs.trim()) qs.set('ufs', enrichViaConsultaUfs.trim());
      const qsStr = qs.toString();
      const res = await fetch(`${baseUrl}/api/admin/workers/enrich-via-consulta${qsStr ? '?' + qsStr : ''}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Erro: ${err.detail || res.statusText}`);
      }
    } finally {
      setWorkerAction(null);
    }
  };

  const triggerWorkerConsultaUf = async () => {
    const ufsLabel = consultaUfUfs.trim() || 'todas as 27 UFs';
    const janelas  = parseInt(consultaUfJanelas) || 5;
    if (!confirm(
      `Iniciar Worker Consulta UF para: ${ufsLabel}?\n\n` +
      `Janelas anuais: ${janelas} (${janelas} anos retroativos)\n\n` +
      `Este worker usa curl_cffi (TLS Chrome) — contorna o fingerprinting do PNCP\n` +
      `e retorna nomeRazaoSocialFornecedor nativamente.\n\n` +
      `Tempo estimado: ~5-15 min por UF · ${ufsLabel === 'todas as 27 UFs' ? '~2-5h completo' : '~' + ufsLabel.split(',').length * 10 + ' min'}`
    )) return;
    setWorkerAction('consulta_uf');
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const qs = new URLSearchParams();
      if (consultaUfUfs.trim()) qs.set('ufs', consultaUfUfs.trim());
      qs.set('janelas', String(janelas));
      const res = await fetch(`${baseUrl}/api/admin/workers/consulta-uf?${qs.toString()}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Erro: ${err.detail || res.statusText}`);
      }
    } finally {
      setWorkerAction(null);
    }
  };

  const triggerWorkerMunicipios = async () => {
    const ufsLabel = municipiosUfs.trim() || 'todas as 27 UFs';
    if (!confirm(`Iniciar worker de municípios para: ${ufsLabel}?\n\nTempo estimado: ~2-4h para todas as UFs.`)) return;
    setWorkerAction('municipios');
    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const qs = municipiosUfs.trim() ? `?ufs=${encodeURIComponent(municipiosUfs.trim())}` : '';
      const res = await fetch(`${baseUrl}/api/admin/workers/municipios${qs}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setTimeout(loadPncpData, 1500);
      } else {
        alert(`❌ ${data.detail || 'Erro ao iniciar worker.'}`);
      }
    } finally {
      setWorkerAction(null);
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
          onClick={() => { setActiveTab('pncp'); if (!pncpStats) loadPncpData(); }}
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'pncp' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <Database size={18} /> Base PNCP
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
        <button
          onClick={() => { setActiveTab('tiers'); if (!tierConfigs.length) loadTierConfigs(); }}
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'tiers' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <Lock size={18} /> Tiers &amp; Limites
        </button>
        <button
          onClick={() => { setActiveTab('promo'); loadPromoList(); }}
          className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'promo' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
        >
          <Zap size={18} /> Convites Promo
        </button>
      </div>

      {/* ========================================== */}
      {/* ABA 1: VISÃO GERAL */}
      {/* ========================================== */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard icon={<Users />} label="Usuários" value={data.kpis.usuarios} color="text-blue-400" />
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
                      Nenhum usuário encontrado com este e-mail.
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
      {/* ABA 3: BASE PNCP                         */}
      {/* ========================================== */}
      {activeTab === 'pncp' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

          {/* Header + Refresh */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Base de Dados PNCP</h2>
              <p className="text-slate-500 text-sm mt-1">Gerir a indexação local de contratos e municípios.</p>
            </div>
            <button
              onClick={loadPncpData}
              disabled={pncpLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all border border-slate-700 disabled:opacity-50"
            >
              {pncpLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Atualizar
            </button>
          </div>

          {/* Stats Cards */}
          {pncpStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Contratos Total</p>
                <p className="text-3xl font-black text-white">{(pncpStats.contratos?.total || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Contratos Ativos</p>
                <p className="text-3xl font-black text-emerald-400">{(pncpStats.contratos?.ativos || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Com Fornecedor</p>
                {(() => {
                  const total = pncpStats.contratos?.total || 0;
                  const semForn = pncpStats.contratos?.sem_fornecedor || 0;
                  const comForn = Math.max(0, total - semForn);
                  const pct = total > 0 ? Math.round((comForn / total) * 100) : 0;
                  return (
                    <>
                      <p className="text-3xl font-black text-emerald-400">{comForn.toLocaleString()}</p>
                      <div className="mt-2 h-1.5 w-full bg-slate-700/60 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{pct}% de cobertura · {semForn.toLocaleString()} sem dados</p>
                    </>
                  );
                })()}
              </div>
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Municípios</p>
                <p className="text-3xl font-black text-blue-400">{(pncpStats.municipios?.total || 0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-600 mt-1">de ~5.569</p>
              </div>
            </div>
          )}
          {pncpStats?.ultima_indexacao && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Clock size={11} />
              Última indexação: {new Date(pncpStats.ultima_indexacao).toLocaleString('pt-BR')}
            </p>
          )}

          {/* ── PAINEL DE AGENDAMENTO ── */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700/40 rounded-xl"><Clock size={18} className="text-slate-400" /></div>
                <div>
                  <h3 className="text-base font-black text-white">Agendamento Automático</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Workers diários — fuso America/Sao_Paulo</p>
                </div>
              </div>
              {schedulerStatus && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border ${
                  schedulerStatus.scheduler_ativo
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${schedulerStatus.scheduler_ativo ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {schedulerStatus.scheduler_ativo ? 'ATIVO' : 'INATIVO'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'contratos',
                  label: 'Contratos sem_termo',
                  hora: '02:00',
                  desc: '~10k contratos novos · ~3 min',
                  cor: 'violet',
                },
                {
                  id: 'enrich',
                  label: 'Enrich Fornecedor',
                  hora: '03:00',
                  desc: 'Próximos 730 dias · ~10-30 min',
                  cor: 'amber',
                },
                {
                  id: 'consulta_uf',
                  label: 'Consulta UF',
                  hora: '04:00',
                  desc: '5-6 UFs rotativas · ~1-2h',
                  cor: 'emerald',
                },
              ].map(({ id, label, hora, desc, cor }) => {
                const jobProx  = schedulerStatus?.jobs_proximas_exec?.find((j: any) => j.id.startsWith(id));
                const jobRes   = schedulerStatus?.jobs_resultados?.[id];
                const proxData = jobProx?.proxima_exec ? new Date(jobProx.proxima_exec) : null;
                return (
                  <div key={id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-200">{label}</span>
                      <span className={`text-[10px] font-black text-${cor}-400 bg-${cor}-500/10 px-2 py-0.5 rounded-full border border-${cor}-500/20`}>{hora} BRT</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{desc}</p>
                    <div className="pt-1 border-t border-slate-700/40 space-y-1">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock size={9} />
                        <span className="font-bold text-slate-400">Próxima:</span>
                        {proxData ? proxData.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </p>
                      {jobRes?.ultima_exec && (
                        <p className="text-[10px] text-slate-600">
                          Última: {new Date(jobRes.ultima_exec).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          {jobRes.ultimo_erro
                            ? <span className="text-red-400 ml-1">✗ erro</span>
                            : jobRes.ultimo_resultado
                              ? <span className="text-emerald-400 ml-1">✓ ok</span>
                              : null
                          }
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!schedulerStatus && (
              <p className="text-xs text-slate-600 text-center mt-3">
                Clique em "Atualizar" para carregar o status do scheduler.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* WORKER CONTRATOS */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-violet-500/10 rounded-xl"><RefreshCw size={20} className="text-violet-400" /></div>
                <div>
                  <h3 className="text-lg font-black text-white">Worker · Contratos</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Indexa contratos do PNCP via /api/search</p>
                </div>
              </div>

              {/* Status */}
              {workersStatus?.contratos && (
                <div className={`flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-xs font-bold border ${
                  workersStatus.contratos.running
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : workersStatus.contratos.ultimo_erro
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : workersStatus.contratos.ultimo_resultado
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                }`}>
                  {workersStatus.contratos.running
                    ? <><Loader2 size={13} className="animate-spin" /> A correr (modo: {workersStatus.contratos.modo})...</>
                    : workersStatus.contratos.ultimo_erro
                      ? <><XCircle size={13} /> Erro: {workersStatus.contratos.ultimo_erro.slice(0, 60)}</>
                      : workersStatus.contratos.ultimo_resultado
                        ? <><CheckCircle2 size={13} /> Concluído · {workersStatus.contratos.ultimo_resultado.total_inseridos?.toLocaleString()} contratos inseridos</>
                        : <><Clock size={13} /> Nunca executado nesta sessão</>
                  }
                </div>
              )}

              {/* Modo buttons */}
              <div className="space-y-2.5">
                {[
                  { modo: 'sem_termo',  label: 'Sem Termo',  desc: '10k contratos · ~3 min',    color: 'emerald' },
                  { modo: 'rapido',     label: 'Rápido',     desc: '~900 contratos · ~30s',     color: 'blue' },
                  { modo: 'medio',      label: 'Médio',      desc: '~30k contratos · ~10 min',  color: 'violet' },
                  { modo: 'maximo',     label: 'Máximo',     desc: '~150k contratos · ~45 min', color: 'amber' },
                  { modo: 'completo',   label: 'Completo',   desc: '~160k contratos · ~50 min', color: 'red' },
                ].map(({ modo, label, desc, color }) => (
                  <button
                    key={modo}
                    onClick={() => triggerWorkerContratos(modo)}
                    disabled={!!workerAction || workersStatus?.contratos?.running}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      bg-slate-800/40 border-slate-700/50 hover:border-${color}-500/40 hover:bg-${color}-500/5 group`}
                  >
                    <div className="flex items-center gap-3">
                      {workerAction === `contratos-${modo}`
                        ? <Loader2 size={15} className="animate-spin text-slate-400" />
                        : <Play size={13} className={`text-${color}-400 group-hover:scale-110 transition-transform`} />
                      }
                      <span className="font-black text-slate-200 text-sm">{label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">{desc}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* WORKER MUNICÍPIOS */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-500/10 rounded-xl"><MapPin size={20} className="text-blue-400" /></div>
                <div>
                  <h3 className="text-lg font-black text-white">Worker · Municípios</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Indexa municipio_id via IBGE + PNCP</p>
                </div>
              </div>

              {/* Status */}
              {workersStatus?.municipios && (
                <div className={`flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-xs font-bold border ${
                  workersStatus.municipios.running
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : workersStatus.municipios.ultimo_erro
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : workersStatus.municipios.ultimo_resultado
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                }`}>
                  {workersStatus.municipios.running
                    ? <><Loader2 size={13} className="animate-spin" /> A correr (UFs: {typeof workersStatus.municipios.ufs === 'string' ? workersStatus.municipios.ufs : workersStatus.municipios.ufs?.join(', ')})...</>
                    : workersStatus.municipios.ultimo_erro
                      ? <><XCircle size={13} /> Erro: {workersStatus.municipios.ultimo_erro.slice(0, 60)}</>
                      : workersStatus.municipios.ultimo_resultado
                        ? <><CheckCircle2 size={13} /> Concluído · {workersStatus.municipios.ultimo_resultado.novos} novos · {workersStatus.municipios.ultimo_resultado.total_collection?.toLocaleString()} total</>
                        : <><Clock size={13} /> Nunca executado nesta sessão</>
                  }
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    UFs a processar (vazio = todas as 27)
                  </label>
                  <input
                    type="text"
                    value={municipiosUfs}
                    onChange={e => setMunicipiosUfs(e.target.value.toUpperCase())}
                    placeholder="Ex: GO,SP,MG"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                  />
                  <p className="text-[10px] text-slate-600 mt-1.5">Separe com vírgula. Ex: GO executa só Goiás (~5 min).</p>
                </div>

                <button
                  onClick={triggerWorkerMunicipios}
                  disabled={!!workerAction || workersStatus?.municipios?.running}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-sm transition-all
                    bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {workerAction === 'municipios'
                    ? <><Loader2 size={16} className="animate-spin" /> A iniciar...</>
                    : <><Play size={14} /> Iniciar Worker de Municípios</>
                  }
                </button>

                <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-400">Para que serve?</p>
                  <p>Necessário para o filtro de cidade no Radar de Renovações. Cada município precisa ter o seu <code className="text-slate-300">municipio_id</code> PNCP registado.</p>
                  <p className="text-slate-600">Tempo: ~5 min por UF · ~2-4h completo</p>
                </div>
              </div>
            </div>

            {/* WORKER CONSULTA UF */}
            <div className="bg-slate-900/40 border border-emerald-500/15 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl"><RefreshCw size={20} className="text-emerald-400" /></div>
                <div>
                  <h3 className="text-lg font-black text-white">Worker · Consulta UF</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Indexa por UF com curl_cffi (TLS Chrome)</p>
                </div>
              </div>

              {/* Badge recomendado */}
              <div className="mb-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                ✦ Recomendado para fornecedor em massa
              </div>

              {/* Alerta de contexto */}
              <div className="mb-5 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-300/80">
                <span className="font-black text-emerald-400">Por quê?</span> Usa <code className="text-slate-300">curl_cffi</code> que replica o TLS do Chrome — contorna o fingerprinting do PNCP.
                Retorna <code className="text-slate-300">nomeRazaoSocialFornecedor</code> nativamente em cada contrato.
              </div>

              {/* Status */}
              {workersStatus?.consulta_uf && (
                <div className={`flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-xs font-bold border ${
                  workersStatus.consulta_uf.running
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : workersStatus.consulta_uf.ultimo_erro
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : workersStatus.consulta_uf.ultimo_resultado
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
                }`}>
                  {workersStatus.consulta_uf.running
                    ? <><Loader2 size={13} className="animate-spin" /> A correr (UFs: {typeof workersStatus.consulta_uf.ufs === 'string' ? workersStatus.consulta_uf.ufs : workersStatus.consulta_uf.ufs?.join(', ')})...</>
                    : workersStatus.consulta_uf.ultimo_erro
                      ? <><XCircle size={13} /> Erro: {workersStatus.consulta_uf.ultimo_erro.slice(0, 60)}</>
                      : workersStatus.consulta_uf.ultimo_resultado
                        ? <><CheckCircle2 size={13} /> {workersStatus.consulta_uf.ultimo_resultado.total_inseridos?.toLocaleString()} inseridos · {workersStatus.consulta_uf.ultimo_resultado.ufs_processadas} UFs</>
                        : <><Clock size={13} /> Nunca executado nesta sessão</>
                  }
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      UFs (vazio = 27)
                    </label>
                    <input
                      type="text"
                      value={consultaUfUfs}
                      onChange={e => setConsultaUfUfs(e.target.value.toUpperCase())}
                      placeholder="Ex: GO,SP"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Janelas anuais
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={consultaUfJanelas}
                      onChange={e => setConsultaUfJanelas(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-600">~5-15 min por UF · Todas as UFs: ~2-5h</p>

                <button
                  onClick={triggerWorkerConsultaUf}
                  disabled={!!workerAction || workersStatus?.consulta_uf?.running}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-sm transition-all
                    bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {workerAction === 'consulta_uf'
                    ? <><Loader2 size={16} className="animate-spin" /> A iniciar...</>
                    : <><Play size={14} /> Indexar por UF (curl_cffi)</>
                  }
                </button>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ABA 4 (antiga 3): TEMPLATES DE E-MAIL   */}
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
      {/* ABA 5 (antiga 4): CONFIGURAÇÕES GERAIS  */}
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

      {/* ========================================== */}
      {/* ABA: TIERS & LIMITES                       */}
      {/* ========================================== */}
      {activeTab === 'tiers' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Tiers &amp; Limites</h2>
              <p className="text-slate-500 text-sm mt-1">
                Ajuste análises/mês, chars e MB por plano. Valores sobrepõem os padrões do <code className="text-violet-400">.env</code> imediatamente (cache de 60 s).
              </p>
            </div>
            <button
              onClick={loadTierConfigs}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all"
            >
              <RefreshCw size={14} /> Recarregar
            </button>
          </div>

          {tierConfigs.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Carregando configurações…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tierConfigs.map((tier) => {
                const edit = tierEdits[tier.tier_id] || {};
                const isSaving = savingTier === tier.tier_id;
                const msg = tierMsg?.tier_id === tier.tier_id ? tierMsg : null;
                const isDefault = tier.monthly_limit === 0;

                const tierColors: Record<number, string> = {
                  [-1]: 'border-slate-700',
                  1:    'border-slate-700',
                  2:    'border-sky-800/60',
                  3:    'border-violet-800/60',
                  4:    'border-amber-800/60',
                };
                const headerColors: Record<number, string> = {
                  [-1]: 'text-slate-400',
                  1:    'text-slate-300',
                  2:    'text-sky-400',
                  3:    'text-violet-400',
                  4:    'text-amber-400',
                };

                return (
                  <div key={tier.tier_id} className={`bg-slate-900/50 border rounded-2xl p-6 ${tierColors[tier.tier_id] ?? 'border-slate-700'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black uppercase tracking-widest ${headerColors[tier.tier_id] ?? 'text-slate-400'}`}>
                          NÍVEL {tier.tier_id === -1 ? '0' : tier.tier_id}
                        </span>
                        <h3 className="text-base font-black text-white">{tier.label}</h3>
                        <span className="text-xs text-slate-600 font-medium">
                          {tier.price_brl > 0 ? `R$ ${tier.price_brl}/mês` : 'Gratuito'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono bg-slate-800 px-2 py-1 rounded">
                        {edit.investigator_model ?? tier.investigator_model} → {edit.writer_model ?? tier.writer_model}
                      </span>
                    </div>

                    {/* ── Configuração de IAs ─────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {/* Investigador */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          IA Investigadora
                        </label>
                        <select
                          value={edit.investigator_model ?? tier.investigator_model}
                          onChange={e => setTierEdits(prev => ({
                            ...prev,
                            [tier.tier_id]: { ...prev[tier.tier_id], investigator_model: e.target.value },
                          }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500 transition-colors"
                        >
                          {(tier.available_models || ['gpt-4o-mini','gpt-4o','o3-mini','claude','groq']).map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Writer */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          IA Redatora
                        </label>
                        <select
                          value={edit.writer_model ?? tier.writer_model}
                          onChange={e => setTierEdits(prev => ({
                            ...prev,
                            [tier.tier_id]: { ...prev[tier.tier_id], writer_model: e.target.value },
                          }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500 transition-colors"
                        >
                          {(tier.available_models || ['gpt-4o-mini','gpt-4o','o3-mini','claude','groq']).map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Agent count */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          IAs em execução
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map(n => {
                            const labels: Record<number, string> = {
                              1: '1 — Base',
                              2: '2 — + PNCP',
                              3: '3 — + Jurídico',
                            };
                            const active = (edit.agent_count ?? tier.agent_count) === n;
                            return (
                              <button
                                key={n}
                                onClick={() => setTierEdits(prev => ({
                                  ...prev,
                                  [tier.tier_id]: { ...prev[tier.tier_id], agent_count: n },
                                }))}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all border ${
                                  active
                                    ? 'bg-violet-600 border-violet-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {labels[n]}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">
                          1=só análise · 2=+concorrentes · 3=+parecer
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-800/60 mb-4" />

                    {/* Campos de limites */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                      {/* Análises/mês */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Análises / mês
                          <span className="ml-1 text-slate-600 normal-case font-normal">(0 = ilimitado)</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={edit.monthly_limit ?? tier.monthly_limit}
                          onChange={e => setTierEdits(prev => ({
                            ...prev,
                            [tier.tier_id]: { ...prev[tier.tier_id], monthly_limit: parseInt(e.target.value) || 0 },
                          }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">
                          Padrão: {tier.monthly_limit === 0 ? '∞' : tier.monthly_limit}
                        </p>
                      </div>

                      {/* Máx. chars */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Máx. caracteres
                        </label>
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          value={edit.max_chars ?? tier.max_chars}
                          onChange={e => setTierEdits(prev => ({
                            ...prev,
                            [tier.tier_id]: { ...prev[tier.tier_id], max_chars: parseInt(e.target.value) || 0 },
                          }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">
                          Padrão: {(tier.max_chars / 1000).toFixed(0)}k
                        </p>
                      </div>

                      {/* Máx. MB */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                          Máx. arquivo (MB)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={edit.max_mb ?? tier.max_mb}
                          onChange={e => setTierEdits(prev => ({
                            ...prev,
                            [tier.tier_id]: { ...prev[tier.tier_id], max_mb: parseInt(e.target.value) || 0 },
                          }))}
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">
                          Padrão: {tier.max_mb} MB
                        </p>
                      </div>
                    </div>

                    {/* ── Auto-routing Opus (só tier 4) ────────────────── */}
                    {tier.tier_id === 4 && (
                      <div className="mt-1 mb-4 p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                            Auto-routing Opus / Sonnet
                          </span>
                          <span className="text-[10px] text-slate-500">
                            — editais acima do threshold usam Opus automaticamente
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="opus-enabled"
                              checked={edit.opus_threshold !== null && edit.opus_threshold !== undefined}
                              onChange={e => setTierEdits(prev => ({
                                ...prev,
                                [4]: { ...prev[4], opus_threshold: e.target.checked ? 300000 : null },
                              }))}
                              className="w-4 h-4 accent-amber-500 cursor-pointer"
                            />
                            <label htmlFor="opus-enabled" className="text-xs text-slate-400 font-bold cursor-pointer">
                              Activado
                            </label>
                          </div>
                          {edit.opus_threshold !== null && edit.opus_threshold !== undefined && (
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <label className="text-[10px] text-slate-500 uppercase font-black whitespace-nowrap">
                                Threshold (chars)
                              </label>
                              <input
                                type="number"
                                min={10000}
                                step={10000}
                                value={edit.opus_threshold}
                                onChange={e => setTierEdits(prev => ({
                                  ...prev,
                                  [4]: { ...prev[4], opus_threshold: parseInt(e.target.value) || 300000 },
                                }))}
                                className="w-36 bg-slate-800 border border-amber-800/50 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors"
                              />
                              <span className="text-[10px] text-slate-500">
                                ({edit.opus_threshold >= 1000 ? `${(edit.opus_threshold / 1000).toFixed(0)}k` : edit.opus_threshold} chars)
                              </span>
                            </div>
                          )}
                        </div>
                        {edit.opus_threshold !== null && edit.opus_threshold !== undefined && (
                          <p className="text-[10px] text-amber-700 mt-2">
                            ≥ {(edit.opus_threshold / 1000).toFixed(0)}k chars → Opus · abaixo → Sonnet
                          </p>
                        )}
                      </div>
                    )}

                    {/* Feedback + Acções */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-h-[20px]">
                        {msg && (
                          <p className={`text-xs font-bold flex items-center gap-1 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {msg.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {msg.text}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetTier(tier.tier_id)}
                          className="px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
                        >
                          Restaurar padrão
                        </button>
                        <button
                          onClick={() => handleSaveTier(tier.tier_id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-black rounded-lg transition-all"
                        >
                          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {isSaving ? 'Salvando…' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-600 text-center">
            Os modelos de IA por tier são configurados via variáveis de ambiente e não são editáveis aqui.
          </p>
        </div>
      )}

      {/* ========================================== */}
      {/* ABA: CONVITES PROMOCIONAIS                 */}
      {/* ========================================== */}
      {activeTab === 'promo' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Convites Promocionais</h2>
            <p className="text-slate-500 text-sm mt-1">
              Envie acesso completo (tier 4) por tempo limitado. O link é de uso único e não aparece nos planos públicos.
            </p>
          </div>

          {/* Formulário de envio */}
          <form onSubmit={handleEnviarPromo} className="bg-slate-900 border border-violet-800/40 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-violet-300 uppercase tracking-widest flex items-center gap-2">
              <Zap size={13} /> Novo convite
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                placeholder="email@empresa.com.br"
                value={promoEmail}
                onChange={e => setPromoEmail(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-500"
              />
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-slate-400 font-bold whitespace-nowrap">Dias:</label>
                <input
                  type="number"
                  min={1} max={30}
                  value={promoDias}
                  onChange={e => setPromoDias(parseInt(e.target.value) || 3)}
                  className="w-16 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={promoLoading}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-colors"
              >
                {promoLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {promoLoading ? 'Enviando…' : 'Enviar convite'}
              </button>
            </div>
            {promoMsg && (
              <p className={`text-xs font-bold ${promoMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {promoMsg.text}
              </p>
            )}
          </form>

          {/* Lista de convites */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <span className="text-sm font-black text-white">Histórico de convites</span>
              <button onClick={loadPromoList} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>
            {promoListLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
              </div>
            ) : promoList.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-8">Nenhum convite enviado ainda.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {promoList.map((inv: any) => (
                  <div key={inv.token || inv.email + inv.created_at} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{inv.email}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {inv.dias} dias · criado por {inv.created_by} · {inv.created_at ? new Date(inv.created_at).toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 ${
                      inv.activated
                        ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-900/40 text-amber-400 border border-amber-800'
                    }`}>
                      {inv.activated ? '✓ Ativado' : 'Aguardando'}
                    </span>
                    {!inv.activated && (
                      <button
                        onClick={() => handleRevogarPromo(inv.token, inv.email)}
                        className="text-[11px] text-red-500 hover:text-red-400 font-bold shrink-0 transition-colors"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
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