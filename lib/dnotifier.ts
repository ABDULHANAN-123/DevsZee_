import "server-only";
import { DNotifier } from "@dnotifier-realtime/dnotifier";

type ClientState = typeof globalThis & {
  __supportDNotifier?: InstanceType<typeof DNotifier>;
  __supportDNotifierConnection?: Promise<void>;
};

const state = globalThis as ClientState;

export function getNotifier(): InstanceType<typeof DNotifier> {
  if (state.__supportDNotifier) return state.__supportDNotifier;

  const appId = process.env.DNOTIFIER_APP_ID;
  const secret = process.env.DNOTIFIER_SECRET;
  if (!appId || !secret) {
    throw new Error("Missing DNOTIFIER_APP_ID or DNOTIFIER_SECRET.");
  }

  state.__supportDNotifier = new DNotifier({
    appId,
    secret,
    transport: "http",
    userId: "support-backend",
    logs: true,
    url: undefined,
    onConnected: () => {},
    onMessage: () => {},
    onDisconnected: () => {},
    WebSocketImpl: undefined,
  });
  return state.__supportDNotifier;
}

export async function connectDNotifier(): Promise<void> {
  const notifier = getNotifier();
  if (!state.__supportDNotifierConnection) {
    state.__supportDNotifierConnection = notifier.connect()
      .then(() => undefined)
      .catch((error) => {
        state.__supportDNotifierConnection = undefined;
        throw error;
      });
  }
  await state.__supportDNotifierConnection;
}
