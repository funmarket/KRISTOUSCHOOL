import { useEffect, useRef, useState } from 'react';
import {
  subscribePickupRealtime,
  type PickupRealtimeStatus,
  type PickupRealtimeSubscription,
} from '../lib/domains/pickup.ts';

export interface UsePickupRealtimeParams {
  enabled: boolean;
  accountKey?: string | null;
  onSync: () => Promise<unknown> | unknown;
  debounceMs?: number;
  pollIntervalMs?: number;
  subscribeFn?: (params: {
    onChange: () => void;
    onStatusChange?: (status: PickupRealtimeStatus) => void;
    channelName?: string;
  }) => PickupRealtimeSubscription;
}

export function usePickupRealtime({
  enabled,
  accountKey,
  onSync,
  debounceMs = 250,
  pollIntervalMs = 12_000,
  subscribeFn = subscribePickupRealtime,
}: UsePickupRealtimeParams): { realtimeStatus: PickupRealtimeStatus } {
  const [realtimeStatus, setRealtimeStatus] = useState<PickupRealtimeStatus>('OFF');
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const subscribeFnRef = useRef(subscribeFn);
  subscribeFnRef.current = subscribeFn;

  useEffect(() => {
    if (!enabled || !accountKey) {
      setRealtimeStatus('OFF');
      return;
    }

    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerDebouncedSync = () => {
      if (!active) return;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (active) {
          void onSyncRef.current();
        }
      }, debounceMs);
    };

    const subscription = subscribeFnRef.current({
      onChange: triggerDebouncedSync,
      onStatusChange: (nextStatus) => {
        if (active) setRealtimeStatus(nextStatus);
      },
      channelName: `pickup-board-${accountKey}`,
    });

    return () => {
      active = false;
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      subscription.unsubscribe();
    };
  }, [accountKey, debounceMs, enabled]);

  useEffect(() => {
    if (!enabled || !accountKey || realtimeStatus !== 'POLLING') return;
    const intervalId = setInterval(() => {
      void onSyncRef.current();
    }, pollIntervalMs);
    return () => {
      clearInterval(intervalId);
    };
  }, [accountKey, enabled, pollIntervalMs, realtimeStatus]);

  return { realtimeStatus };
}
