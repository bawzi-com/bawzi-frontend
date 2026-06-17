# Frontend — Bawzi

Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Como rodar

```bash
npm install
cp .env.example .env.local   # edite se necessário
npm run dev
```

Acesse em `http://localhost:3000`. O backend deve estar rodando em `http://localhost:8000`.

## Variável de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | URL do backend FastAPI |

## Estrutura de páginas (`src/app/`)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | `page.tsx` | Landing page pública |
| `/login` | `login/` | Login, Google OAuth, 2FA |
| `/profile` | `profile/` | Perfil do usuário, billing, faturas, configurações |
| `/workspace` | `workspace/` | Gestão de workspace: membros, empresas monitoradas |
| `/history` | `history/` | Histórico de análises |
| `/plans` | `plans/` | Tabela de planos e upgrade |
| `/gestao` | `gestao/` | Painel de gestão de contratos |
| `/enterprise` | `enterprise/` | Área enterprise (tier 4) |
| `/admin` | `admin/` | Painel administrativo (acesso restrito) |
| `/docs` | `docs/` | Documentação pública da API |
| `/swagger` | `swagger/` | Swagger UI integrado |
| `/lgpd` | `lgpd/` | Política de privacidade e LGPD |
| `/privacidade` | `privacidade/` | Página de privacidade |
| `/termos` | `termos/` | Termos de uso |
| `/promo` | `promo/` | Landing de promoção |
| `/reset-password` | `reset-password/` | Redefinição de senha |

## Principais componentes (`src/components/`)

| Componente | Descrição |
|-----------|-----------|
| `AnalysisForm.tsx` | Formulário de upload e disparo de análise |
| `AnalysisResults.tsx` | Renderização dos resultados multi-agente |
| `AnalysisLoadingOverlay.tsx` | Overlay de progresso durante análise |
| `ActiveContextSwitcher.tsx` | Selector de empresa ativa para análise; filtra empresas `suspended`/`disabled` |
| `AppSidebar.tsx` | Sidebar de navegação principal |
| `CompanyProfileForm.tsx` | CRUD de empresas monitoradas; exibe status `suspended`/`disabled` e botão de ativação |
| `TeamManager.tsx` | Gestão de membros do workspace |
| `PncpSearch.tsx` | Busca e filtros de editais PNCP |
| `CompetitorWarRoom.tsx` | Análise de concorrentes por segmento |
| `RadarAlertas.tsx` | Alertas de novas oportunidades por empresa |
| `ThreatRadar.tsx` | Radar de ameaças e análise de risco |
| `TacticalSimulator.tsx` | Simulador de preço e margem |
| `NotificationPanel.tsx` | Central de notificações in-app |
| `ChatWidget.tsx` | Assistente IA flutuante |
| `PremiumLock.tsx` | Bloqueio de feature por tier (overlay de upgrade) |
| `PricingSection.tsx` | Seção de planos na landing page |
| `CompliancePanel.tsx` | Consulta de compliance CGU |
| `ContratosVencendo.tsx` | Lista de contratos próximos ao vencimento |
| `AuthModal.tsx` | Modal de login/cadastro |
| `OnboardingModal.tsx` | Onboarding pós-cadastro |
| `Header.tsx` / `Footer.tsx` | Layout global |

## Utilitários (`src/lib/`)

| Arquivo | Descrição |
|---------|-----------|
| `apiClient.ts` | `apiFetch`: wrapper de `fetch` com JWT automático, refresh silencioso e redirect 401 |
| `activeContext.ts` | Gerência de empresa ativa para contexto de análise (localStorage + sync) |
| `tier.ts` | Helpers de tier: limites, nomes, checks de feature |
| `types.ts` | Tipos TypeScript compartilhados (`Empresa`, `Workspace`, `Analysis`, etc.) |
| `pushNotifications.ts` | Subscrição de Web Push VAPID |
| `exportPdf.ts` | Export de análise para PDF (client-side) |
| `decisionQueue.ts` | Fila local de decisões pendentes |
| `useInactivityTimeout.ts` | Hook de logout automático por inatividade |

## Fluxo de autenticação

1. `POST /api/auth/login` → access token (memória) + refresh token (cookie HttpOnly)
2. `apiFetch` injeta `Authorization: Bearer <token>` em todas as chamadas
3. Em 401, tenta `POST /api/auth/refresh` silenciosamente; se falhar, redireciona para `/login`
4. Login Google: `POST /api/auth/google` com ID token do `@react-oauth/google`

## Sistema de empresas monitoradas e downgrade

Empresas no workspace têm três estados possíveis:

- **ativa** — dentro do limite do plano, aparece no `ActiveContextSwitcher` e no radar
- **suspended** — excede o limite após downgrade; radar pausado; prazo de 7 dias para ajuste
- **disabled** — prazo expirado; bloqueada para análise; dados preservados

`CompanyProfileForm` exibe banners amber/vermelho conforme o estado e oferece o botão "Tornar ativa" para empresas `suspended` (chama `POST /api/workspace/company/activate`). `ActiveContextSwitcher` filtra automaticamente empresas `suspended` e `disabled` do seletor de contexto de análise.
