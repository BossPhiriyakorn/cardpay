'use client';

import { useEffect, useState } from 'react';

export type CmsAdminMe = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'reviewer';
  roleLabel: string;
};

export function useCmsAdminMe() {
  const [admin, setAdmin] = useState<CmsAdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/admin/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ok?: boolean; id?: string; username?: string; name?: string; role?: 'admin' | 'reviewer'; roleLabel?: string }) => {
        if (!cancelled && d.ok && d.id && d.username && d.role && d.roleLabel) {
          setAdmin({
            id: d.id,
            username: d.username,
            name: d.name ?? d.username,
            role: d.role,
            roleLabel: d.roleLabel,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    admin,
    loading,
    isAdmin: admin?.role === 'admin',
    isReviewer: admin?.role === 'reviewer',
  };
}
