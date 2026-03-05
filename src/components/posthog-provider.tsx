'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

function PostHogInit() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // We capture manually on route change
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
      },
    });
    setInitialized(true);
  }, []);

  if (!initialized) return null;
  return (
    <>
      <PostHogPageView />
      <PostHogIdentify />
    </>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph || !pathname) return;
    const url = searchParams?.size
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    ph.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

function PostHogIdentify() {
  const { user } = useAuth();
  const ph = usePostHog();
  const pathname = usePathname();

  useEffect(() => {
    if (!ph) return;

    if (!user) {
      ph.reset();
      return;
    }

    const isAdmin = pathname?.startsWith('/admin');
    const hubSlugMatch = pathname?.match(/^\/hub\/([^/]+)/);
    const hubSlug = hubSlugMatch?.[1] ?? undefined;

    ph.identify(user.id, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: isAdmin ? 'admin' : 'client',
    });

    if (hubSlug) {
      ph.group('hub', hubSlug);
    } else {
      ph.resetGroups();
    }
  }, [user, ph, pathname]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogInit />
      </Suspense>
      {children}
    </PHProvider>
  );
}
