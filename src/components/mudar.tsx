) : result ? (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in duration-500 font-sans" id="area-resultados">
                      <div className={`h-2 ${getScoreBg(result.score)}`}></div>
                      <div className="p-8 md:p-12">
                        
                        <div className="hidden print:flex items-center justify-between border-b border-slate-900 pb-6 mb-8 w-full">
                          <div className="flex flex-col">
                            <h1 className="text-xl font-black text-slate-900">BAWZI | Inteligência em Editais</h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relatório Estratégico de Viabilidade</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Data da Análise</p>
                            <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 print:hidden">
                           <div className="flex items-center gap-3">
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Viabilidade</h2>
                             <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                               {termoAlvo || "Visão Global"}
                             </span>
                           </div>
                           <div className="flex flex-wrap gap-3 w-full md:w-auto"> 
                            <button onClick={() => window.print()} className="px-4 py-2 hover:bg-slate-50 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors text-sm flex items-center justify-center gap-2">
                              🖨️ <span className="hidden sm:inline">Imprimir</span>
                            </button>
                            {token && analysisId && (
                                <button onClick={handleShare} disabled={isSharing} className="px-4 py-2 hover:bg-violet-50 text-violet-700 font-bold rounded-lg border border-violet-200 transition-colors text-sm flex items-center justify-center gap-2">
                                  {isSharing ? 'A Enviar...' : '📧 Partilhar'}
                                </button>
                            )}
                            <button onClick={handleResetAnalysis} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                              Nova Análise
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-14 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-8 print:border-none print:p-0">
                          <div className="flex items-center gap-6">
                            <div className="relative w-24 h-24 shrink-0">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" className="stroke-slate-200" strokeWidth="6" fill="none" />
                                <circle 
                                  cx="50" cy="50" r="42" 
                                  className={`transition-all duration-1000 ease-out ${
                                    result.score >= 70 ? 'stroke-emerald-500' : 
                                    result.score >= 45 ? 'stroke-amber-500' : 
                                    'stroke-red-500'
                                  }`} 
                                  strokeWidth="6" fill="none" strokeLinecap="round"
                                  style={{ strokeDasharray: 264, strokeDashoffset: 264 - (264 * result.score) / 100 }} 
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{result.score}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bawzi Score</p>
                              <h3 className={`text-lg font-black uppercase tracking-widest ${getScoreColor(result.score)}`}>
                                {result.classification}
                              </h3>
                              {result.pricing_intelligence?.financial_verdict && (
                                <p className="text-sm text-slate-600 font-medium mt-1 max-w-sm">
                                  {result.pricing_intelligence.financial_verdict}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {(() => {
                            const d = result?.datas_criticas_extraidas;
                            const propostas = String(d?.data_limite_propostas || "").trim();
                            const impugnacao = String(d?.data_impugnacao || "").trim();
                            
                            // 🟢 FILTRO INTELIGENTE: Bloqueia respostas vagas da IA
                            const isValida = (texto: string) => {
                               if (!texto) return false;
                               const t = texto.toLowerCase();
                               return !t.includes("não") && !t.includes("nao") && !t.includes("n/a") && !t.includes("informad") && !t.includes("localizad");
                            };

                            const propValida = isValida(propostas) ? propostas : null;
                            const impValida = isValida(impugnacao) ? impugnacao : null;

                            if (!propValida && !impValida) return null;
                            
                            return (
                              <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
                                {propValida && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Propostas</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-amber-500">📅</span> {propValida}</span>
                                  </div>
                                )}
                                {impValida && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Impugnação</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-rose-500">🚨</span> {impValida}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                            <span className="text-lg">🎯</span>
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumo Executivo</h3>
                          </div>
                          <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
                            {result.summary}
                          </div>
                        </div>

                        {(() => {
                          const pricing = result.pricing_intelligence as Record<string, any>;
                          
                          const extrairMaiorDinheiro = (textoBase: any): number => {
                            if (!textoBase) return 0;
                            if (typeof textoBase === 'number' && textoBase > 0) return textoBase;
                            const texto = String(textoBase);
                            const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
                            if (matches.length > 0) {
                              let maiorValor = 0;
                              matches.forEach(m => {
                                 const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                                 if (num > maiorValor) maiorValor = num;
                              });
                              return maiorValor;
                            }
                            return 0;
                          };

                          let valorEstimado = extrairMaiorDinheiro(result?.summary) 
                                           || extrairMaiorDinheiro(result?.estimated_value) 
                                           || extrairMaiorDinheiro(pricing?.valor_estimado_raw) 
                                           || 0;

                          if (!pricing || pricing.desagioPreditivoOrgao === undefined) return null;

                          return (
                            <div className="space-y-4 print:hidden">
                              
                              {/* 🔒 BLOQUEIO DO SIMULADOR (Só liberta se Tier >= 2) */}
                              <PremiumLock 
                                isLocked={userTier < 2} 
                                featureTitle="Simulador Tático de Lances" 
                                requiredTierName="Nível 2 (Essencial)" 
                                onUpgradeClick={() => setShowUpgradeModal(true)}
                              >
                                <div className="relative border border-slate-200 rounded-2xl p-2 bg-white">
                                  <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2 z-10">
                                    <span className="text-lg">💰</span>
                                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Simulador de Lances</h3>
                                  </div>
                                  <BawziShadowSimulator 
                                    desagioPreditivo={result?.pricing_intelligence?.desagioPreditivoOrgao}
                                    nivelAmeaca={result?.pricing_intelligence?.nivelAmeaca}
                                    perfilVencedor={result?.pricing_intelligence?.perfilVencedor}
                                    valorReferenciaInicial={valorEstimado} 
                                  />
                                </div>
                              </PremiumLock>

                              {/* 🔒 BLOQUEIO DA ENGENHARIA REVERSA (Só liberta se Tier >= 4) */}
                              <PremiumLock 
                                isLocked={Math.max(userTier, typeof window !== 'undefined' ? Number(localStorage.getItem('bawzi_tier') || 1) : 1) < 4} 
                                featureTitle="Raio-X do Adversário" 
                                requiredTierName="Nível 4 (Dominador)" 
                                onUpgradeClick={() => setShowUpgradeModal(true)}
                              >
                                <ReverseEngineeringBlock
                                  valorReferencia={valorEstimado}
                                  desagio={pricing.desagioPreditivoOrgao}
                                  engenhariaData={pricing.engenharia_reversa}
                                />
                              </PremiumLock>

                            </div>
                          );
                        })()}

                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12 bg-white shadow-sm print:hidden">
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2.5">
                            <Award className="w-5 h-5 text-indigo-500" strokeWidth={2.5} />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inteligência Competitiva</h3>
                          </div>
                          
                          <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-inner">
                            <div className="flex border-b border-slate-200 bg-slate-100/50">
                              <button
                                onClick={() => setAbaConcorrentes('nacional')}
                                className={`flex-1 py-3.5 px-5 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                  abaConcorrentes === 'nacional' ? 'bg-white text-indigo-700 border-t-2 border-t-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <Globe className="w-4 h-4" /> Nacionais
                              </button>
                              <button
                                onClick={() => setAbaConcorrentes('regional')}
                                className={`flex-1 py-3.5 px-5 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                  abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 border-t-2 border-t-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <MapPin className="w-4 h-4" /> Regionais ({result.uf || "GO"})
                              </button>
                            </div>

                            <div className="p-6 bg-white">
                              {['nacional', 'regional'].map((tipo) => (
                                abaConcorrentes === tipo && (
                                  <div key={tipo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(tipo === 'nacional' ? result.concorrentes_provaveis : result.concorrentes_regionais)?.slice(0, 6).map((item: any, index: number) => {
                                      
                                      // 1. DECLARAÇÃO INICIAL DAS VARIÁVEIS (É isto que resolve o erro TS2304)
                                      let nomeEmpresa = "Empresa não identificada";
                                      let vitorias = "0";
                                      let cnpj = "";
                                      let probabilidade = "";
                                      let forca = "";
                                      let dadosParaModal = item;

                                      // 2. EXTRAÇÃO DOS DADOS (String vs Objeto)
                                      if (typeof item === 'string') {
                                        let extraidoCnpj = "";
                                        const match = item.match(/(.*?)\s*\(([\d]+)\s*vitórias?\)(?:\s*-\s*CNPJ:\s*([\d]+))?/i);
                                        
                                        if (match) {
                                          nomeEmpresa = match[1].trim();
                                          vitorias = match[2] || "0";
                                          extraidoCnpj = match[3] || "";
                                        } else {
                                          nomeEmpresa = item;
                                        }

                                        if (!extraidoCnpj) {
                                          const matchFormatado = item.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/);
                                          if (matchFormatado) {
                                            extraidoCnpj = matchFormatado[0];
                                          } else {
                                            const matchMei = item.match(/\b\d{2}\.\d{3}\.\d{3}\b/);
                                            if (matchMei) extraidoCnpj = matchMei[0] + " (Raiz MEI)";
                                          }
                                        }

                                        cnpj = extraidoCnpj;
                                        dadosParaModal = { nome: nomeEmpresa, vitorias, cnpj, uf: tipo === 'nacional' ? 'Nacional' : (result.uf || 'GO') };
                                      
                                      } else {
                                        nomeEmpresa = item.empresa || item.nome || item.razao_social || "Empresa não identificada";
                                        vitorias = item.vitorias || item.quantidade_vitorias || "0";
                                        cnpj = item.cnpj || "";
                                        probabilidade = item.probabilidade || "";
                                        forca = item.forca || item.nivel_forca || "";
                                        
                                        dadosParaModal = { 
                                          ...item, 
                                          nome: nomeEmpresa, 
                                          vitorias, 
                                          cnpj, 
                                          probabilidade, 
                                          forca, 
                                          uf: item.uf || (tipo === 'nacional' ? 'Nacional' : (result.uf || 'GO')) 
                                        };
                                      }

                                      // 🟢 3. MOTOR DE INFERÊNCIA GRANULAR E COMPLIANCE
                                      const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : null;
                                      let calcForca = forca;
                                      let calcProb = probabilidade;
                                      
                                      // Extrai apenas os números com precisão (evita bugs se vier "2 vitórias" na string)
                                      const numVitorias = parseInt(String(vitorias).replace(/\D/g, ''), 10) || 0;

                                      // Se a IA não mandou as variáveis mastigadas, aplicamos o algoritmo Bawzi
                                      if (!calcForca || !calcProb) {
                                        // Fórmula algorítmica: Probabilidade base cresce com as vitórias (teto de 95%)
                                        const taxaSucesso = Math.min(95, 18 + (numVitorias * 7)); 
                                        calcProb = `~${taxaSucesso}%`;

                                        if (numVitorias === 0) { 
                                          calcForca = "Iniciante"; 
                                          calcProb = "< 15%"; 
                                        } else if (numVitorias === 1) { 
                                          calcForca = "Oportunista"; 
                                        } else if (numVitorias === 2) { 
                                          calcForca = "Ameaça Leve"; 
                                        } else if (numVitorias >= 3 && numVitorias <= 5) { 
                                          calcForca = "Habitual"; 
                                        } else if (numVitorias >= 6 && numVitorias <= 10) { 
                                          calcForca = "Competidor Feroz"; 
                                        } else { 
                                          calcForca = "Predador Dominante"; 
                                          calcProb = "> 90%"; 
                                        }
                                      }

                                      const getPerigoColor = (nivel: string) => {
                                        if (!nivel) return 'bg-slate-50 text-slate-500 border-slate-200';
                                        const n = String(nivel).toLowerCase();
                                        if (n.includes('predador') || n.includes('> 90') || n.includes('feroz') || n.includes('habitual') || parseInt(n.replace(/\D/g,'')) >= 50) 
                                          return 'bg-rose-50 text-rose-700 border-rose-200';
                                        if (n.includes('leve') || n.includes('oportunista') || parseInt(n.replace(/\D/g,'')) >= 25) 
                                          return 'bg-amber-50 text-amber-700 border-amber-200';
                                        return 'bg-slate-50 text-slate-500 border-slate-200';
                                      };

                                      return (
                                        <div 
                                          key={index} 
                                          className="group bg-white border border-slate-200 rounded-[1.5rem] p-5 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 flex flex-col gap-4 shadow-sm"
                                        >
                                          {/* CABEÇALHO DO CONCORRENTE */}
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 border border-slate-100 transition-colors shrink-0">
                                                <Award size={20} />
                                              </div>
                                              <div className="min-w-0">
                                                <h4 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                                                  {nomeEmpresa}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                  <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                                    <MapPin size={10} /> {tipo === 'nacional' ? 'Nacional' : (result.uf || 'GO')}
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-400">• CNPJ: {cnpj || 'N/A'}</span>
                                                </div>
                                                
                                                {/* ETIQUETAS DE FORÇA E PROBABILIDADE */}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                                  <span className={`text-[8.5px] px-2 py-1 rounded-md font-black uppercase tracking-wider border ${getPerigoColor(calcProb)}`}>
                                                    🎯 Prob: {calcProb}
                                                  </span>
                                                  <span className={`text-[8.5px] px-2 py-1 rounded-md font-black uppercase tracking-wider border ${getPerigoColor(calcForca)}`}>
                                                    ⚔️ Força: {calcForca}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {Number(vitorias) > 0 && (
                                              <div className="bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 flex flex-col items-center shrink-0 shadow-sm">
                                                <span className="text-xs font-black text-indigo-700 leading-none">{vitorias}</span>
                                                <span className="text-[8px] font-black text-indigo-400/80 uppercase tracking-tighter mt-1">Vitórias</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* PAINÉIS DE COMPLIANCE */}
                                          {cleanCnpj && cleanCnpj.length >= 11 ? (
                                            <div className="flex flex-col gap-1">
                                              <div className="pt-3 border-t border-slate-100">
                                                
                                                {/* 🟢 O NOME NOVO ENTRA AQUI */}
                                                <CompliancePanel 
                                                  cnpj={cleanCnpj} 
                                                  companyName={nomeEmpresa} 
                                                  userTier={selectedTier} 
                                                  onUpgradeClick={() => setShowUpsell(true)} 
                                                />
                                                
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-[9px] font-medium text-slate-400 italic px-3 py-2 bg-slate-50 rounded-lg text-center border border-slate-200 border-dashed mt-auto">
                                              CNPJ necessário para consulta do Radar de Habilitação.
                                            </div>
                                          )}

                                          {/* BOTÃO VER DOSSIÊ */}
                                          <button 
                                            onClick={() => setSelectedCompetitor(dadosParaModal)}
                                            className="w-full py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all mt-auto border border-slate-200 hover:border-slate-800"
                                          >
                                            Ver Dossiê Completo
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        </div>

                        {((result.exigencias_criticas && result.exigencias_criticas.length > 0) || (result.documentos_necessarios && result.documentos_necessarios.length > 0) || (result.vantagens && result.vantagens.length > 0) || (result.desvantagens && result.desvantagens.length > 0)) && (
                          <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                            <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                              <span className="text-lg">📋</span>
                              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Carga Operacional & SWOT</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-2">
                               {result.vantagens && result.vantagens.length > 0 && (
                                 <div>
                                   <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">👍 Vantagens (Por que avançar?)</h4>
                                   <ul className="space-y-3">
                                      {result.vantagens.map((v: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-emerald-500">＋</span> {v}</li>)}
                                   </ul>
                                 </div>
                               )}
                               {result.desvantagens && result.desvantagens.length > 0 && (
                                 <div>
                                   <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4">👎 Barreiras (Por que recuar?)</h4>
                                   <ul className="space-y-3">
                                      {result.desvantagens.map((d: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-orange-500">−</span> {d}</li>)}
                                   </ul>
                                 </div>
                               )}
                               
                               {result.exigencias_criticas && result.exigencias_criticas.length > 0 && (
                                 <div>
                                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">📌 Exigências Críticas</h4>
                                   <ul className="space-y-3">
                                      {result.exigencias_criticas.map((e: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {e}</li>)}
                                   </ul>
                                 </div>
                               )}
                               {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
                                 <div>
                                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">📁 Documentação Necessária</h4>
                                   <ul className="space-y-3">
                                      {result.documentos_necessarios.map((doc: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {doc}</li>)}
                                   </ul>
                                 </div>
                               )}
                            </div>
                          </div>
                        )}

                        {result && (  
                          <div className="my-10 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
                            <div className="bg-indigo-900 p-4 border-b border-indigo-800 flex items-center justify-between">
                              <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                                <span className="text-xl">⚖️</span> PARECER TÉCNICO-JURÍDICO BAWZI
                              </h3>
                              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-black px-2 py-1 bg-amber-400/10 rounded-md border border-amber-400/20">
                                Agente IA Especialista
                              </span>
                            </div>

                            {userTier <= 2 ? (
                              <div className="relative p-6">
                                <div className="prose prose-slate max-w-none mb-3 opacity-60">
                                  <p className="text-slate-700 text-sm font-medium italic">
                                    "Após análise minuciosa das cláusulas de habilitação técnica e financeira, 
                                    identificamos pontos de atenção..."
                                  </p>
                                </div>

                                <div className="absolute inset-0 top-[50px] z-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md rounded-b-2xl pb-2">
                                  <div className="bg-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-xl max-w-sm text-center border border-slate-700 mx-4">
                                    <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-400/20">
                                      <span className="text-2xl">🔒</span>
                                    </div>
                                    <h4 className="font-black text-lg mb-1.5 text-white">Análise Jurídica Restrita</h4>
                                    <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                                      O Parecer Jurídico detalhado (SWOT, risco e fundamentação legal) está disponível apenas para membros <strong className="text-indigo-400 uppercase">Especialistas</strong> e <strong className="text-amber-400 uppercase">Dominadores</strong>.
                                    </p>
                                    <button 
                                      onClick={() => setShowUpgradeModal(true)} 
                                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                                    >
                                      Fazer Upgrade Agora ⚡
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-3 blur-[5px] select-none pointer-events-none opacity-20 mt-2 min-h-[220px]">
                                  <div className="h-3 w-full bg-slate-300 rounded"></div>
                                  <div className="h-3 w-5/6 bg-slate-300 rounded"></div>
                                  <div className="h-3 w-4/6 bg-slate-300 rounded"></div>
                                  <div className="h-16 w-full bg-indigo-50 rounded-xl mt-4"></div>
                                </div>
                              </div>
                            ) : (
                              result.parecer_especialista && (
                                <div className="p-8 prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-indigo-600">
                                  <div className="whitespace-pre-wrap font-sans leading-relaxed text-sm">
                                    {result.parecer_especialista}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-100 print:hidden">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-indigo-400" strokeWidth={2} />
                            Raciocínio Estratégico da IA
                          </h4>
                          <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-100">
                            {result.rationale || result.recommendation || "Sem dados estratégicos."}
                          </div>
                        </div>

                        {result.checklist && result.checklist.length > 0 && (
                          <div className="relative border border-slate-200 rounded-2xl p-8 mt-12 print:hidden">
                            <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Roadmap de Execução</h3>
                            </div>
                            
                            <div className="space-y-3 mt-2">
                              {result.checklist.map((item: any, idx: number) => {
                                const tarefa = item.tarefa || item.descricao || item;
                                const fase = item.fase || "Preparação";
                                const impacto = item.impacto || "Importante";
                                
                                return (
                                  <label key={idx} className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer">
                                    <input type="checkbox" className="mt-0.5 appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-0 checked:bg-slate-800 checked:border-slate-800 cursor-pointer flex items-center justify-center shrink-0 before:content-['✓'] before:text-white before:text-xs before:hidden checked:before:block" />
                                    <div className="flex-1">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fase}</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded-md">Impacto: {impacto}</span>
                                      </div>
                                      <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{tarefa}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. 🔒 BLOQUEIO DO PARECER JURÍDICO (Só liberta se Tier >= 4) */}
                              <PremiumLock 
                                isLocked={currentTier < 4} 
                                featureTitle="Parecer Técnico-Jurídico (PDF)" 
                                requiredTierName="Nível 4 (Dominador)" 
                                onUpgradeClick={() => setShowUpgradeModal(true)}
                              >
                                <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm mt-4">
                                  
                                  <div className="flex items-start gap-5 flex-1">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center shrink-0 shadow-xl text-2xl border border-slate-800">
                                      ⚖️
                                    </div>
                                    <div>
                                      <h3 className="font-black text-slate-900 text-xl tracking-tight mb-1">Exportar Parecer Técnico-Jurídico</h3>
                                      <p className="text-sm font-medium text-slate-500 leading-relaxed mb-4 max-w-xl">
                                        Gere uma minuta formal em PDF baseada na análise neural da Bawzi. Ideal para anexar a impugnações ou recursos administrativos.
                                      </p>
                                      
                                      {/* Alerta de Validação */}
                                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200/60 rounded-lg">
                                        <span className="text-amber-500 text-sm">⚠️</span>
                                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Requer validação final de um advogado</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Botão de Exportação */}
                                  <button 
                                    onClick={() => alert("A iniciar geração da minuta em PDF...")} // Substitua pela sua função real de gerar PDF
                                    className="w-full md:w-auto px-8 py-4 bg-slate-900 hover:bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
                                  >
                                    <span className="text-lg">📄</span> 
                                    GERAR PARECER (PDF)
                                  </button>

                                </div>
                              </PremiumLock>

                        <div className="hidden print:block bg-white p-10 font-serif text-slate-900 leading-relaxed text-sm">
                          <div className="border-b-2 border-slate-900 pb-4 mb-6">
                            <h1 className="text-2xl font-black uppercase">Bawzi Intelligence</h1>
                            <p className="font-bold text-slate-500 uppercase">Parecer Técnico-Jurídico Preliminar</p>
                          </div>

                          <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
                            <p className="font-bold text-xs">
                              ⚠️ Nota de Responsabilidade: Este rascunho foi gerado por IA para facilitar a triagem. A revisão e validação por um profissional da área jurídica é indispensável.
                            </p>
                          </div>

                          <div className="space-y-6">
                            <section>
                              <h3 className="font-bold border-b border-slate-200 mb-2">1. Resumo da Análise</h3>
                              <p>{result.summary}</p>
                            </section>
                            
                            <section>
                              <h3 className="font-bold border-b border-slate-200 mb-2">2. Fundamentação e Riscos</h3>
                              <p className="whitespace-pre-wrap">{result.parecer_especialista || result.rationale || "Sem riscos críticos identificados."}</p>
                            </section>

                            <section>
                              <h3 className="font-bold border-b border-slate-200 mb-2">3. Conclusão Estratégica</h3>
                              <p>Veredito da Análise: <strong>{result.classification}</strong> (Score: {result.score}/100)</p>
                            </section>
                          </div>

                          <div className="mt-20 pt-10 border-t border-slate-300 flex flex-col items-center">
                            <div className="w-64 h-px bg-slate-900 mb-2"></div>
                            <p className="font-bold uppercase text-xs">Validação Jurídica (Assinatura)</p>
                            <p className="text-xs mt-1">OAB/UF nº _________</p>
                          </div>
                        </div>

                        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium print:hidden">
                          <div className="flex items-center gap-2">
                            <span>Gerado por:</span>
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold uppercase tracking-widest">{modelSource || 'Motor Bawzi IA'}</span>
                          </div>
                          {isCachedResult && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              <span className="text-sm">⚡</span>
                              <span className="font-bold uppercase tracking-widest text-[10px]">Recuperado do Cache</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>