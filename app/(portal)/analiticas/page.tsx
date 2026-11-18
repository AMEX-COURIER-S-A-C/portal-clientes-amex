'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePortalSession } from '@/components/portal/PortalShell';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default function AnaliticasPage() {
  const router = useRouter();
  const { user, isSuperadmin } = usePortalSession();

  useEffect(() => {
    if (user && !isSuperadmin) {
      router.replace('/warehouse');
    }
  }, [user, isSuperadmin, router]);

  if (!isSuperadmin) {
    return null;
  }

  return (
    <AnalyticsDashboard
      adminEmail={user?.email || ''}
      onBackToWarehouse={() => router.push('/warehouse')}
    />
  );
}
