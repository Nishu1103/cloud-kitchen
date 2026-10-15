'use client';

import { isApiError } from '@ck/sdk';
import type { Permission, SessionUser } from '@ck/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { api, onSessionExpired } from './api';
import { keys } from './query-keys';

interface SessionState {
  user: SessionUser | null;
  isLoading: boolean;
  /** Permission check. Roles are never inspected in UI code. */
  can: (permission: Permission) => boolean;
  /**
   * The kitchen this account belongs to. Absent means the account is a vendor user
   * with no kitchen linked yet, which is an onboarding state rather than an error.
   */
  vendorId: string | null;
}

const SessionContext = createContext<SessionState>({
  user: null,
  isLoading: true,
  can: () => false,
  vendorId: null,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: keys.session,
    queryFn: () => api.auth.me(),
    // A 401 here is the normal signed-out case, not a failure worth retrying.
    retry: false,
    staleTime: 5 * 60_000,
  });

  // When the refresh token is gone, drop cached kitchen data before routing away, or
  // the sign-in screen renders behind a stale order board.
  useEffect(() => {
    onSessionExpired(() => {
      queryClient.clear();
      router.replace('/login?expired=1');
    });
  }, [queryClient, router]);

  const value = useMemo<SessionState>(() => {
    const permissions = new Set(data?.permissions ?? []);
    return {
      user: data ?? null,
      isLoading,
      can: (permission) => permissions.has(permission),
      vendorId: data?.vendorId ?? null,
    };
  }, [data, isLoading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; password: string; campusSlug: string }) =>
      api.auth.login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(keys.session, session.user);
      void queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.auth.logout(),
    // Signing out must succeed locally even if the network call fails: a kitchen tablet
    // is shared, and leaving the previous shift's session on screen is worse.
    onSettled: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });
}

/** True when a failure was the API refusing an anonymous caller rather than an error. */
export function isUnauthenticated(error: unknown): boolean {
  return isApiError(error) && error.isAuthError;
}
