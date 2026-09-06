/**
 * O funil da análise gratuita, do lado do navegador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ O QUE ISTO RESPONDE
 * ═══════════════════════════════════════════════════════════════════════════
 * A home entrega um veredito Go/No-Go sem cadastro. O custo disso já era
 * medido no servidor; o retorno não era medido em lugar nenhum. Sem ligar
 * "colou um edital" a "criou conta", a pergunta "vale a pena manter o grátis?"
 * não tem resposta — e ela tem duas respostas opostas dependendo do número.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ O QUE ISTO NÃO É
 * ═══════════════════════════════════════════════════════════════════════════
 * Não é analytics de terceiro, não sai do nosso domínio e não descreve
 * comportamento além das cinco etapas do funil. O id é um número aleatório do
 * `crypto.randomUUID()` — não deriva de nada da pessoa, não é fingerprint e o
 * servidor não guarda IP junto dele (ver `services/funil.py`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ NADA É GRAVADO NEM ENVIADO ANTES DO ACEITE LGPD
 * ═══════════════════════════════════════════════════════════════════════════
 * Um id persistente em `localStorage` é exatamente o tipo de coisa que o
 * `ConsentBanner` existe para cobrir. Mas o primeiro evento — "viu a análise
 * gratuita" — acontece ANTES de a pessoa clicar em "Entendi", e descartá-lo
 * enviesaria o topo do funil contra quem lê o aviso antes de aceitar.
 *
 * Então: enquanto o consentimento não vier, o id vive só em memória e os
 * eventos ficam numa fila. No aceite, o id é persistido e a fila é despachada.
 * Se o aceite nunca vier, a aba fecha e nada foi gravado nem enviado — que é o
 * comportamento correto, e não um caso de erro.
 */
import { API_URL } from '@/lib/apiClient';

const CHAVE_ID = 'bawzi_vid';
const CHAVE_CONSENTIMENTO = 'bawzi_consent_accepted';

export type EtapaFunil =
  | 'taster_visto'
  | 'taster_submetido'
  | 'taster_cta'
  | 'taster_cota_esgotada';

interface Meta {
  veredito?: string;
  score?: number;
  origem?: string;
}

/** Id em memória: a fonte de verdade enquanto o consentimento não resolve. */
let idEmMemoria = '';
/** Eventos represados até o aceite. */
let fila: Array<{ evento: EtapaFunil; meta?: Meta }> = [];
/** Etapas já enviadas nesta aba — um F5 não é uma segunda visita. */
const jaEnviados = new Set<string>();
let ouvindoAceite = false;

function temConsentimento(): boolean {
  try {
    return localStorage.getItem(CHAVE_CONSENTIMENTO) === 'true';
  } catch {
    return false;
  }
}

function novoId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch { /* segue para o fallback */ }
  // Fallback para navegador sem `randomUUID` em contexto não seguro. Menos
  // entropia, mesmo formato — e o servidor só exige 16..64 hex.
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * O id em si — inclusive antes do aceite, quando ele existe só em memória.
 * Privado de propósito: nada fora deste módulo deve poder enviar um id que a
 * pessoa ainda não consentiu em ter.
 */
function idInterno(): string {
  if (typeof window === 'undefined') return '';
  if (!idEmMemoria) {
    try {
      idEmMemoria = localStorage.getItem(CHAVE_ID) || '';
    } catch { /* storage bloqueado: segue só em memória */ }
  }
  if (!idEmMemoria) idEmMemoria = novoId();
  if (temConsentimento()) {
    try {
      if (localStorage.getItem(CHAVE_ID) !== idEmMemoria) {
        localStorage.setItem(CHAVE_ID, idEmMemoria);
      }
    } catch { /* sem persistência: o funil da sessão ainda fecha */ }
  }
  return idEmMemoria;
}

/**
 * O id deste navegador, ou string vazia enquanto não houver consentimento.
 *
 * ⚠️ A STRING VAZIA ANTES DO ACEITE NÃO É SÓ ESCRÚPULO — ELA CONSERTA A CONTA.
 * O formulário de cadastro só habilita o botão depois do aceite LGPD, então
 * NENHUMA conversão pode vir de quem não consentiu. Se o denominador (quem
 * chegou ao veredito) incluísse os não consentidos, ele contaria gente que o
 * numerador é incapaz de conter, e a taxa de conversão sairia sistematicamente
 * menor que a real — o erro na direção exata de fazer alguém desligar uma
 * oferta que estava funcionando.
 *
 * Medimos, portanto, a população consentida inteira: as cinco etapas com a
 * mesma régua. Quem nunca aceita não entra em lado nenhum da divisão.
 *
 * ⚠️ Devolve vazio no servidor. Chamar isto em render server-side geraria um
 * id por requisição e nenhum deles chegaria ao browser.
 */
export function visitanteId(): string {
  if (typeof window === 'undefined') return '';
  return temConsentimento() ? idInterno() : '';
}

function despachar(evento: EtapaFunil, meta?: Meta): void {
  // `idInterno` e não `visitanteId`: quando a fila é despejada, o aceite já
  // aconteceu — e é o MESMO valor que estava em memória antes dele, senão os
  // eventos represados chegariam com um id diferente do resto da visita e o
  // funil se partiria em dois visitantes.
  const visitor_id = idInterno();
  if (!visitor_id) return;
  try {
    // `keepalive` porque `taster_cta` dispara junto de uma navegação: sem ele,
    // o navegador cancela o fetch ao trocar de página e a etapa que mede a
    // intenção de cadastro é justamente a que mais se perde.
    fetch(`${API_URL}/api/funil/evento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id, evento, ...meta }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* medição nunca quebra a página que está sendo medida */ }
}

function escutarAceite(): void {
  if (ouvindoAceite || typeof window === 'undefined') return;
  ouvindoAceite = true;
  window.addEventListener('bawzi_lgpd_accepted', () => {
    const represados = fila;
    fila = [];
    idInterno();                          // persiste o id agora que pode
    represados.forEach(({ evento, meta }) => despachar(evento, meta));
  }, { once: true });
}

/**
 * Marca uma etapa do funil. Idempotente por aba: chamar duas vezes com a
 * mesma etapa não conta duas visitas.
 */
export function marcarEtapa(evento: EtapaFunil, meta?: Meta): void {
  if (typeof window === 'undefined') return;
  if (jaEnviados.has(evento)) return;
  jaEnviados.add(evento);

  if (!temConsentimento()) {
    // No máximo uma entrada por etapa — o `Set` acima já garante isso, e a
    // fila não pode crescer com a página aberta.
    fila.push({ evento, meta });
    escutarAceite();
    return;
  }
  despachar(evento, meta);
}
