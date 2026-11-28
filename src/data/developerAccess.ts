import type { UserProfile } from '../types';

export function canOpenDeveloperWorkspace(user: UserProfile | null): boolean {
  return user?.role === 'admin' || Boolean(
    user?.permissions?.includes('analytics.view') && user.permissions.includes('bookings.view_all')
  );
}
