/**
 * Data hooks for scan results and alerts, built on React Query.
 * These provide caching, background refetch, and loading states
 * for all the data-heavy screens.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dismissImpersonation,
  fetchAccounts,
  fetchScanResults,
  resolveFinding,
  triggerScan,
} from '@/lib/api';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  scan:     ['scan']     as const,
  accounts: ['accounts'] as const,
} as const;

// ─── Scan results ─────────────────────────────────────────────────────────────

export function useScanResults() {
  return useQuery({
    queryKey: QUERY_KEYS.scan,
    queryFn:  fetchScanResults,
    // Refetch in the background every 5 minutes
    refetchInterval: 5 * 60 * 1000,
    // Keep previous data while refetching so the UI doesn't flash empty
    placeholderData: (prev) => prev,
  });
}

// ─── Trigger scan ─────────────────────────────────────────────────────────────

export function useTriggerScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerScan,
    onSuccess: () => {
      // Invalidate and refetch scan results after scan completes
      qc.invalidateQueries({ queryKey: QUERY_KEYS.scan });
    },
  });
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: QUERY_KEYS.accounts,
    queryFn:  fetchAccounts,
  });
}

// ─── Resolve finding ──────────────────────────────────────────────────────────

export function useResolveFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolveFinding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.scan });
    },
  });
}

// ─── Dismiss impersonation ────────────────────────────────────────────────────

export function useDismissImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissImpersonation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.scan });
    },
  });
}
