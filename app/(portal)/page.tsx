'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WarehousePageSkeleton } from '@/components/ui/PortalSkeletons';

/**
 * Redirige "/" hacia "/warehouse" (o a la ruta correspondiente si llega un enlace antiguo "/?tab=...").
 */
export default function PortalRootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const tab =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (tab === 'configuracion') {
      router.replace('/configuracion');
    } else if (tab === 'analiticas') {
      router.replace('/analiticas');
    } else {
      router.replace('/warehouse');
    }
  }, [router]);

  return <WarehousePageSkeleton />;
}
