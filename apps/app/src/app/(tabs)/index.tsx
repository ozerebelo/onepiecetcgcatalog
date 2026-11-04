import { Dashboard } from '@/components/home/dashboard';
import { Landing } from '@/components/home/landing';
import { LoadingView } from '@/components/ui/state-views';
import { useAuth } from '@/providers/auth';

/** Home: a landing page for visitors, a dashboard once signed in. */
export default function HomeScreen() {
  const { user, initializing } = useAuth();
  if (initializing) return <LoadingView />;
  return user ? <Dashboard /> : <Landing />;
}
