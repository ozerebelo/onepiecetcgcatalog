import { Redirect } from 'expo-router';

/** Sets now live on the Cards page (set covers, newest first); old links land there. */
export default function SetsScreen() {
  return <Redirect href="/cards" />;
}
