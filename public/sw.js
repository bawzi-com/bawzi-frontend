// Service Worker — Bawzi Web Push
// Recebe push do backend e exibe notificação nativa do SO

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Bawzi', body: event.data.text(), url: '/' };
  }

  const { title = 'Bawzi', body = '', url = '/', icon = '/icon.png', badge = '/icon.png' } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [200, 100, 200],
    })
  );
});

// Clique na notificação → abre/foca a aba correta
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  const fullUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
