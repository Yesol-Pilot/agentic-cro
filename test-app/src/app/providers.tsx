'use client'

import posthog from 'posthog-js'
import { PostHogProvider as CSPostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const distinctId = getCookie('ph_distinct_id');
        const checkoutVariant = getCookie('checkout_variant');

        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
            capture_pageview: false,
            // 🚨 핵심: 서버에서 생성된 세션 ID와 플래그를 정적으로 주입 (깜빡임과 SRM 예방)
            bootstrap: {
                distinctID: distinctId || 'anonymous_user',
                featureFlags: {
                    'checkout_button_color': checkoutVariant || 'control'
                }
            }
        })
    }, [])

    return <CSPostHogProvider client={posthog}>{children}</CSPostHogProvider>
}
