import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authRedirectUrl } from '@/lib/auth-links';
import { getSupabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been restored. */
  initializing: boolean;
  /** Set after a password-reset link is opened; the user must choose a new password. */
  passwordRecovery: boolean;
  signIn(email: string, password: string): Promise<void>;
  /** Resolves to true when the account still needs email confirmation. */
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      passwordRecovery,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp(email, password, displayName) {
        const { data, error } = await getSupabase().auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: authRedirectUrl('/auth/callback'),
          },
        });
        if (error) throw error;
        return { needsConfirmation: data.session == null };
      },
      async signOut() {
        const { error } = await getSupabase().auth.signOut();
        if (error) throw error;
      },
      async sendPasswordReset(email) {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirectUrl('/auth/update-password'),
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
      },
    }),
    [session, initializing, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
