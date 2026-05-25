type Client = {
  householdId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

const encoder = new TextEncoder();
const clients = new Set<Client>();

export function createEventStream(householdId: string) {
  return new ReadableStream({
    start(controller) {
      const client = { householdId, controller };
      clients.add(client);
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
    },
    cancel() {
      for (const client of clients) {
        if (client.householdId === householdId) clients.delete(client);
      }
    },
  });
}

export function broadcast(householdId: string, kind = "changed") {
  const payload = encoder.encode(`event: ${kind}\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  for (const client of [...clients]) {
    if (client.householdId !== householdId) continue;
    try {
      client.controller.enqueue(payload);
    } catch {
      clients.delete(client);
    }
  }
}

