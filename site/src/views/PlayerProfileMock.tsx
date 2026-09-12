import type { Me } from '../lib/auth';
import ProfileDisplayCase from '../components/ProfileDisplayCase';

export default function PlayerProfileMock({ me, signIn }: { me: Me | null; signIn: () => void; refresh?: () => void }) {
  return <ProfileDisplayCase key={me?.id ?? 'signed-out'} member={me} viewer={me} signIn={signIn} />;
}
