self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("dinnerboard-v1").then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icon.svg"])));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "DinnerBoard", body: "DinnerBoard was updated." };
  event.waitUntil(self.registration.showNotification(data.title || "DinnerBoard", { body: data.body || "DinnerBoard was updated.", icon: "/icon.svg" }));
});
