'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  SlidersHorizontal, Sparkles, Plus, Trash2, ChevronDown,
  CheckCircle2, Circle, Save, RotateCcw,
  HardHat, Laptop, HeartPulse, Wrench, BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/apiClient';

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Parametro {
  id: string;
  nome: string;
  ativo: boolean;
  peso: 'alto' | 'medio' | 'baixo';
}

interface ParametrosData {
  setor: string | null;
  parametros: Parametro[];
}

// ── Templates por setor (hardcoded — estáticos, não precisam de API) ─────
// Ícones lucide (consistentes com o resto do app) em vez de emoji cru — cada
// setor ganha um "chip" colorido, mais alinhado ao resto da UI profissional.
const SETORES: { key: string; label: string; icon: LucideIcon; iconBg: string; iconColor: string }[] = [
  { key: 'construcao',  label: 'Construção & Obras',       icon: HardHat,    iconBg: 'bg-amber-100',  iconColor: 'text-amber-700' },
  { key: 'ti',          label: 'Tecnologia da Informação', icon: Laptop,     iconBg: 'bg-sky-100',    iconColor: 'text-sky-700' },
  { key: 'saude',       label: 'Saúde & Farmácia',         icon: HeartPulse, iconBg: 'bg-rose-100',   iconColor: 'text-rose-700' },
  { key: 'servicos',    label: 'Serviços Gerais',          icon: Wrench,     iconBg: 'bg-slate-200',  iconColor: 'text-slate-700' },
  { key: 'consultoria', label: 'Consultoria',              icon: BarChart3,  iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' },
];

type Peso = 'alto' | 'medio' | 'baixo';
const TEMPLATES_LOCAIS: Record<string, Array<{ nome: string; peso: Peso }>> = {
  construcao: [
    { nome: 'Atestados e CAT do responsável técnico cobrindo as parcelas de maior relevância', peso: 'alto' },
    { nome: 'Orçamento de referência (SINAPI/SICRO) exequível com o BDI praticado pela empresa', peso: 'alto' },
    { nome: 'Prazo de execução e cronograma físico-financeiro executáveis com as equipes atuais', peso: 'alto' },
    { nome: 'Índices financeiros, capital circulante ou patrimônio líquido mínimo atendidos', peso: 'alto' },
    { nome: 'Valor da obra dentro do limite operacional e da capacidade de faturamento', peso: 'alto' },
    { nome: 'Registro CREA/CAU da empresa e do RT, com visto regional para obra fora do estado', peso: 'medio' },
    { nome: 'Regime de execução (global vs. preço unitário) e risco de quantitativos assumido', peso: 'medio' },
    { nome: 'Garantias exigidas: proposta, contratual (5-10%) e seguros de engenharia', peso: 'medio' },
    { nome: 'Visita técnica: obrigatoriedade, data única e custo de deslocamento', peso: 'medio' },
    { nome: 'Distância do canteiro e custo de mobilização/desmobilização viáveis', peso: 'medio' },
    { nome: 'Capacidade de pagamento do órgão (CAPAG/Tesouro) sem sinal crítico', peso: 'medio' },
    { nome: 'Subcontratação permitida para serviços fora da especialidade', peso: 'baixo' },
    { nome: 'Reajuste previsto e matriz de riscos equilibrada em obras longas', peso: 'baixo' },
  ],
  ti: [
    { nome: 'Atestados de capacidade técnica compatíveis com o objeto e os volumes exigidos', peso: 'alto' },
    { nome: 'Certificações exigidas (ISO, CMMI, fabricante) detidas ou obteníveis no prazo', peso: 'alto' },
    { nome: 'SLA, níveis de serviço e penalidades executáveis com o time atual', peso: 'alto' },
    { nome: 'Métrica de remuneração (UST, ponto de função, posto) com produtividade realista', peso: 'alto' },
    { nome: 'Equipe mínima exigida (perfis, senioridade, certificações) disponível ou contratável', peso: 'alto' },
    { nome: 'Atendimento presencial/on-site exigido compatível com a operação', peso: 'medio' },
    { nome: 'Transição inicial e migração de dados dentro do escopo e do preço', peso: 'medio' },
    { nome: 'Propriedade do código-fonte e artefatos (cessão ao órgão) aceitável', peso: 'medio' },
    { nome: 'Exclusividade ou cota ME/EPP compatível com o porte da empresa', peso: 'medio' },
    { nome: 'Prova de conceito ou amostra técnica: prazo e custo de preparação viáveis', peso: 'medio' },
    { nome: 'Capacidade de pagamento do órgão (CAPAG/Tesouro) sem sinal crítico', peso: 'medio' },
    { nome: 'Vigência e reajuste compatíveis com a evolução salarial de TI', peso: 'baixo' },
    { nome: 'Objeto aderente ao portfólio e ao CNAE da empresa', peso: 'baixo' },
  ],
  saude: [
    { nome: 'Registro ANVISA vigente dos itens cotados', peso: 'alto' },
    { nome: 'Habilitação sanitária coberta: AFE, licença sanitária e CRF com responsável técnico', peso: 'alto' },
    { nome: 'Preço de referência viável frente ao custo de aquisição e ao teto CMED/PMVG', peso: 'alto' },
    { nome: 'Prazo de entrega por ordem de fornecimento executável, incluindo entregas parceladas', peso: 'alto' },
    { nome: 'Validade mínima dos itens na entrega alcançável (ex.: 12 meses ou 75% do prazo)', peso: 'alto' },
    { nome: 'Quantitativo dentro da capacidade de fornecimento (em SRP, sem consumo garantido)', peso: 'medio' },
    { nome: 'Atestados de capacidade técnica compatíveis com objeto e quantitativos', peso: 'medio' },
    { nome: 'Cadeia de frio para termolábeis (2-8°C) dentro da estrutura logística', peso: 'medio' },
    { nome: 'Prazo e condições de pagamento definidos no edital (dias após atesto, empenho)', peso: 'medio' },
    { nome: 'Itens com exclusividade ME/EPP compatíveis com o porte da empresa', peso: 'medio' },
    { nome: 'Capacidade de pagamento do órgão (CAPAG/Tesouro) sem sinal crítico', peso: 'medio' },
    { nome: 'Amostras exigidas: prazo e custo de apresentação viáveis', peso: 'baixo' },
    { nome: 'Garantia contratual e penalidades proporcionais (multa, reposição, recall)', peso: 'baixo' },
  ],
  servicos: [
    { nome: 'Planilha de custos fecha com a CCT vigente da categoria no local da execução', peso: 'alto' },
    { nome: 'Prazo de mobilização suficiente para recrutar, treinar e alocar o efetivo', peso: 'alto' },
    { nome: 'Atestados compatíveis com o efetivo exigido (jurisprudência dos 50%)', peso: 'alto' },
    { nome: 'Patrimônio líquido e índices exigidos para dedicação exclusiva atendidos', peso: 'alto' },
    { nome: 'Conta-vinculada ou pagamento pelo fato gerador suportado pelo fluxo de caixa', peso: 'medio' },
    { nome: 'Prazo de pagamento após medição compatível com a folha do mês seguinte', peso: 'medio' },
    { nome: 'Uniformes, EPIs, materiais e equipamentos por conta da empresa, orçados', peso: 'medio' },
    { nome: 'Cotas ou exclusividade ME/EPP por item compatíveis com o porte', peso: 'medio' },
    { nome: 'IMR/produtividade exigida atingível sem glosas recorrentes', peso: 'medio' },
    { nome: 'Postos e escalas (12x36, noturno, cobertura de férias) operacionalmente viáveis', peso: 'medio' },
    { nome: 'Capacidade de pagamento do órgão (CAPAG/Tesouro) sem sinal crítico', peso: 'medio' },
    { nome: 'Vistoria prévia dos locais: obrigatoriedade e custo', peso: 'baixo' },
    { nome: 'Repactuação prevista e alinhada à data-base da categoria', peso: 'baixo' },
  ],
  consultoria: [
    { nome: 'Objeto dentro da especialidade comprovável por atestados aderentes', peso: 'alto' },
    { nome: 'Equipe-chave exigida (formação, senioridade, certificações) disponível no quadro', peso: 'alto' },
    { nome: 'Pontuação técnica alcançável com o acervo e a equipe atuais (técnica e preço)', peso: 'alto' },
    { nome: 'Entregáveis e cronograma exequíveis com a capacidade instalada', peso: 'alto' },
    { nome: 'Vínculo exigido da equipe (CLT, sócio, contrato) atendível sem novas contratações', peso: 'medio' },
    { nome: 'Dedicação da equipe-chave compatível com os projetos em andamento', peso: 'medio' },
    { nome: 'Forma de remuneração (por produto, homem-hora, êxito) sustentável', peso: 'medio' },
    { nome: 'Propriedade intelectual e direito de uso dos produtos bem definidos', peso: 'medio' },
    { nome: 'Capacidade de pagamento do órgão (CAPAG/Tesouro) sem sinal crítico', peso: 'medio' },
    { nome: 'Impedimentos e conflito de interesse com outros contratos do órgão', peso: 'baixo' },
    { nome: 'Sigilo/NDA e restrições de divulgação dos trabalhos', peso: 'baixo' },
    { nome: 'Presença na sede do órgão: frequência exigida e custo de deslocamento', peso: 'baixo' },
    { nome: 'Participação de MEI/pequeno porte permitida', peso: 'baixo' },
  ],
};

const PESO_CONFIG = {
  alto:  { label: 'Crítico',    color: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-400' },
  medio: { label: 'Importante', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  baixo: { label: 'Desejável',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ParametrizacaoPanel() {
  const [data, setData]           = useState<ParametrosData>({ setor: null, parametros: [] });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [novoNome, setNovoNome]   = useState('');
  const [novoPeso, setNovoPeso]   = useState<Peso>('medio');
  const [setorOpen, setSetorOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── Carrega parâmetros salvos do usuário ──────────────────────────────
  useEffect(() => {
    apiFetch(`${API_URL}/api/parametros`)
      .then(r => r.json())
      .catch(() => ({ setor: null, parametros: [] }))
      .then(params => {
        setData(params && params.parametros ? params : { setor: null, parametros: [] });
        setLoading(false);
      });
  }, []);

  // ── Aplica template de setor ──────────────────────────────────────────
  const aplicarTemplate = useCallback((setorKey: string) => {
    const tmpl = TEMPLATES_LOCAIS[setorKey] || [];
    setData({
      setor: setorKey,
      parametros: tmpl.map(p => ({ id: uuid(), ativo: true, ...p })),
    });
    setSetorOpen(false);
    setSaved(false);
  }, []);

  // ── Toggle ativo/inativo ──────────────────────────────────────────────
  const toggleAtivo = (id: string) => {
    setData(prev => ({
      ...prev,
      parametros: prev.parametros.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p),
    }));
    setSaved(false);
  };

  // ── Mudar peso ────────────────────────────────────────────────────────
  const mudarPeso = (id: string, peso: 'alto' | 'medio' | 'baixo') => {
    setData(prev => ({
      ...prev,
      parametros: prev.parametros.map(p => p.id === id ? { ...p, peso } : p),
    }));
    setSaved(false);
  };

  // ── Remover ───────────────────────────────────────────────────────────
  const remover = (id: string) => {
    setData(prev => ({ ...prev, parametros: prev.parametros.filter(p => p.id !== id) }));
    setSaved(false);
  };

  // ── Adicionar novo ────────────────────────────────────────────────────
  const adicionarNovo = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setData(prev => ({
      ...prev,
      parametros: [...prev.parametros, { id: uuid(), nome, ativo: true, peso: novoPeso }],
    }));
    setNovoNome('');
    setSaved(false);
    addInputRef.current?.focus();
  };

  // ── Salvar ────────────────────────────────────────────────────────────
  const salvar = async () => {
    setSaving(true);
    try {
      await apiFetch(`${API_URL}/api/parametros`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erro ao salvar parâmetros.');
    } finally {
      setSaving(false);
    }
  };

  const setor = SETORES.find(s => s.key === data.setor);
  const ativos   = data.parametros.filter(p => p.ativo).length;
  const inativos = data.parametros.filter(p => !p.ativo).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-sm">Carregando parâmetros...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={20} className="text-emerald-600" />
            <h2 className="text-xl font-black text-slate-900">Critérios de Avaliação</h2>
          </div>
          <p className="text-sm text-slate-500">
            Configure o que a IA deve avaliar em cada edital. Ative, desative ou ajuste o peso de cada critério.
          </p>
        </div>

        {/* Badge IA */}
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl">
          <Sparkles size={11} />
          IA vai sugerir ajustes
        </div>
      </div>

      {/* Seletor de setor / template */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Carregar template por setor
        </p>
        <div className="relative">
          <button
            onClick={() => setSetorOpen(p => !p)}
            className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300 transition-colors"
          >
            {setor ? (
              <span className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${setor.iconBg}`}>
                  <setor.icon size={14} className={setor.iconColor} strokeWidth={2.2} />
                </span>
                {setor.label}
              </span>
            ) : (
              <span className="text-slate-400">Escolher setor...</span>
            )}
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${setorOpen ? 'rotate-180' : ''}`} />
          </button>
          {setorOpen && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {SETORES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => aplicarTemplate(s.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-emerald-50 transition-colors text-left ${data.setor === s.key ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700'}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.iconBg}`}>
                      <Icon size={14} className={s.iconColor} strokeWidth={2.2} />
                    </span>
                    {s.label}
                    {data.setor === s.key && <CheckCircle2 size={14} className="ml-auto text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {data.setor && (
          <p className="mt-2 text-[11px] text-slate-400">
            Template aplicado. Personalize os critérios abaixo.
          </p>
        )}
      </div>

      {/* Contador */}
      {data.parametros.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-bold text-slate-800">{data.parametros.length} critérios</span>
          <span className="text-emerald-600 font-semibold">· {ativos} ativos</span>
          {inativos > 0 && <span className="text-slate-400">· {inativos} inativos</span>}
        </div>
      )}

      {/* Lista de parâmetros */}
      {data.parametros.length > 0 ? (
        <div className="space-y-2">
          {data.parametros.map(p => {
            const cfg = PESO_CONFIG[p.peso];
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-all ${
                  p.ativo ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-50'
                }`}
              >
                {/* Toggle */}
                <button onClick={() => toggleAtivo(p.id)} className="flex-shrink-0">
                  {p.ativo
                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                    : <Circle size={18} className="text-slate-300" />
                  }
                </button>

                {/* Nome */}
                <span className={`flex-1 text-sm ${p.ativo ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}`}>
                  {p.nome}
                </span>

                {/* Seletor de peso */}
                <div className="flex gap-1">
                  {(Object.keys(PESO_CONFIG) as ('alto' | 'medio' | 'baixo')[]).map(k => (
                    <button
                      key={k}
                      onClick={() => mudarPeso(p.id, k)}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md border transition-all ${
                        p.peso === k ? PESO_CONFIG[k].color : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {PESO_CONFIG[k].label}
                    </button>
                  ))}
                </div>

                {/* Remover */}
                <button
                  onClick={() => remover(p.id)}
                  className="flex-shrink-0 p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
          Nenhum critério configurado. Carregue um template ou adicione manualmente.
        </div>
      )}

      {/* Adicionar novo critério */}
      <div className="flex gap-2">
        <input
          ref={addInputRef}
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adicionarNovo()}
          placeholder="Adicionar critério personalizado..."
          className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 placeholder:text-slate-400"
        />
        {/* Peso do novo */}
        <select
          value={novoPeso}
          onChange={e => setNovoPeso(e.target.value as 'alto' | 'medio' | 'baixo')}
          className="text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400 text-slate-600 bg-white"
        >
          <option value="alto">Crítico</option>
          <option value="medio">Importante</option>
          <option value="baixo">Desejável</option>
        </select>
        <button
          onClick={adicionarNovo}
          disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          Adicionar
        </button>
      </div>

      {/* Salvar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Os critérios ativos serão usados automaticamente nas próximas análises.
        </p>
        <button
          onClick={salvar}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            saved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
          }`}
        >
          {saved ? (
            <><CheckCircle2 size={14} /> Salvo!</>
          ) : saving ? (
            <><RotateCcw size={14} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={14} /> Salvar critérios</>
          )}
        </button>
      </div>

    </div>
  );
}
