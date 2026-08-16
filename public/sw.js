/* Service Worker da Bawzi — SÓ push notifications.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ ESTE ARQUIVO NÃO EXISTIA, E TODO O RESTO DA FEATURE SIM.
 *
 * O caminho de push estava construído de ponta a ponta e morto no último metro:
 *   · chaves VAPID em core/config.py:277
 *   · GET /push/vapid-key, POST/DELETE /push/subscribe em router_push.py
 *   · coleção `push_subscriptions` no Mongo
 *   · envio real com pywebpush em services/push_service.py
 *   · três jobs do scheduler chamando `send_push_to_user` (monitor de análises,
 *     contratos a vencer, radar de alertas)
 *   · botão "Ativar notificações" em Perfil → Privacidade & Notificações
 *   · `navigator.serviceWorker.register('/sw.js')` em lib/pushNotifications.ts
 *
 * Só que o projeto não tinha diretório `public/`, então `/sw.js` devolvia 404,
 * `register()` rejeitava, `subscribeToPush()` retornava `false` — e o usuário
 * via um botão que não fazia nada, sem erro nenhum. Ninguém nunca recebeu uma
 * push da Bawzi, em nenhuma plataforma, apesar de a documentação prometer
 * Windows, macOS, Android e iOS.
 *
 * ESCOPO DELIBERADAMENTE MÍNIMO: nada de cache offline, nada de precache de
 * rotas. Um SW que intercepta `fetch` passa a decidir o que o app vê, e essa é
 * uma classe de bug muito pior que a que ele resolveria. Aqui ele só escuta
 * `push` e `notificationclick`.
 *
 * O payload é montado em `push_service.py:44` —
 *     { title, body, url, icon, badge }
 * Mexeu lá, mexa aqui.
 */

// Assume o controle assim que instala, sem esperar as abas antigas fecharem.
// Sem isto, quem clicasse em "Ativar" só receberia push depois de fechar todas
// as abas da Bawzi — e concluiria, de novo, que o botão não funciona.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // Push sem corpo é legítimo (alguns navegadores enviam para revalidar a
  // inscrição). Mostrar "undefined" seria pior que um título genérico.
  let dados = {};
  if (event.data) {
    try {
      dados = event.data.json();
    } catch {
      dados = { body: event.data.text() };
    }
  }

  const titulo = dados.title || 'Bawzi';
  const opcoes = {
    body: dados.body || '',
    // O backend manda "/icon.png" por padrão e esse arquivo pode não existir.
    // Ícone quebrado o navegador ignora sozinho; o que não pode é a
    // notificação inteira falhar por causa dele.
    icon: dados.icon || undefined,
    badge: dados.badge || undefined,
    // `tag` + `renotify`: o scheduler roda uma vez por dia por job. Se o
    // usuário ficar dias sem abrir, sem tag ele acorda com uma pilha de
    // notificações repetidas do mesmo alerta.
    tag: dados.tag || 'bawzi-alerta',
    renotify: true,
    data: { url: dados.url || '/workspace' },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // O scheduler manda URL ABSOLUTA (`${APP_URL}/workspace?...`) enquanto a
  // docstring do push_service mostra caminho relativo. Os dois chegam aqui;
  // `new URL(x, origin)` normaliza ambos sem quebrar nenhum.
  const destino = new URL(event.notification.data?.url || '/workspace', self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abas) => {
      // Reaproveita uma aba já aberta na Bawzi em vez de abrir a quinta —
      // quem clica num alerta quer ver o alerta, não colecionar janelas.
      for (const aba of abas) {
        if (new URL(aba.url).origin === destino.origin && 'focus' in aba) {
          if ('navigate' in aba) aba.navigate(destino.href).catch(() => {});
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino.href);
    }),
  );
});
