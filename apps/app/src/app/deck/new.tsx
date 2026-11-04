import { Redirect } from 'expo-router';

import { DeckEditor } from '@/components/deck-editor';
import { LoadingView } from '@/components/ui/state-views';
import { useAuth } from '@/providers/auth';

export default function NewDeckScreen() {
  const { user, initializing } = useAuth();
  if (initializing) return <LoadingView />;
  if (!user) return <Redirect href="/auth/sign-in" />;
  return <DeckEditor />;
}
