import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { clearErrorTrackingUser, setErrorTrackingUser } from '../lib/posthog';

export function PostHogIdentity() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !user) {
      clearErrorTrackingUser();
      return;
    }

    setErrorTrackingUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    });
  }, [isSignedIn, user]);

  return null;
}
