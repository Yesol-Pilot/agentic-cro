'use client';

import posthog from 'posthog-js';
import React, { useEffect } from 'react';

export interface AgenticWrapperProps {
    children: React.ReactNode;
    projectKey: string;
    apiHost?: string;
    debug?: boolean;
}

export function AgenticWrapper({
    children,
    projectKey,
    apiHost = 'https://us.i.posthog.com',
    debug = false
}: AgenticWrapperProps) {

    // [CTO Audit 3] Removed unused 'isInitialized' state and dead PostHogProvider import to strictly adhere to enterprise minimum bundle policy.
    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                posthog.init(projectKey, {
                    api_host: apiHost,
                    // 🚨 CRITICAL: Use a separate namespace to prevent colliding with target app's PostHog
                    name: 'agentic_cro',
                    person_profiles: 'identified_only',
                    capture_pageview: false, // Recommended for SPAs
                    loaded: (ph) => {
                        if (debug) console.log('[Agentic CRO SDK] Telemetry injected via separate namespace.');
                    }
                });
            }
        } catch (err) {
            console.error('[Agentic CRO SDK] Failed to initialize telemetry:', err);
        }
    }, [projectKey, apiHost, debug]);

    // As a secondary instance, we just need to ensure the library is loaded on mount.
    return <>{children}</>;
}
