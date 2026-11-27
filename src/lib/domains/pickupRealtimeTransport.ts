import { supabase } from '../supabase.ts';
import { isTelegramRuntime } from './pickupTransportErrors.ts';
import type { PickupRealtimeStatus } from './pickupTypes.ts';

export interface PickupRealtimeSubscription {
  unsubscribe: () => void;
}

interface RealtimeChannelLike {
  on: (
    event: string,
    filter: { event: string; schema: string; table: string },
    callback: () => void,
  ) => RealtimeChannelLike;
  subscribe: (callback?: (status: string) => void) => RealtimeChannelLike;
}

interface RealtimeClientLike {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel?: (channel: RealtimeChannelLike) => Promise<unknown> | unknown;
}

const REALTIME_TABLES = [
  'pickup_cycles',
  'early_departure_requests',
  'pickup_release_revocations',
] as const;

export function subscribePickupRealtimeTransport(params: {
  onChange: () => void;
  onStatusChange?: (status: PickupRealtimeStatus) => void;
  channelName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientOverride?: any;
}): PickupRealtimeSubscription {
  const { onChange, onStatusChange, channelName, clientOverride } = params;
  const client = (clientOverride ?? supabase) as RealtimeClientLike | null;

  if (!client || typeof client.channel !== 'function' || (!clientOverride && isTelegramRuntime())) {
    onStatusChange?.('POLLING');
    return { unsubscribe: () => {} };
  }

  onStatusChange?.('CONNECTING');
  let active = true;
  const name = channelName || `pickup-board-sync-${Date.now()}`;
  let channel = client.channel(name);

  for (const table of REALTIME_TABLES) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        if (active) onChange();
      },
    );
  }

  channel.subscribe((status: string) => {
    if (!active) return;
    if (status === 'SUBSCRIBED') {
      onStatusChange?.('LIVE');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatusChange?.('POLLING');
    }
  });

  return {
    unsubscribe: () => {
      active = false;
      try {
        if (typeof client.removeChannel === 'function') {
          void client.removeChannel(channel);
        }
      } catch {
        // Ignore teardown errors when socket already closed.
      }
    },
  };
}
