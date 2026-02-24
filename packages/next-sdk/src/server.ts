import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface AgenticCROMiddlewareOptions {
    projectId?: string;
    features: string[]; // List of flags to check
    endpoint?: string;
}

/**
 * Agentic CRO Edge Middleware (Zero-Flicker Architecture)
 * Evaluates feature flags at the Edge before rendering the RSC to prevent layout shifts.
 */
export async function runAgenticCROMiddleware(
    request: NextRequest,
    response: NextResponse,
    options: AgenticCROMiddlewareOptions
) {
    const { projectId, features, endpoint = 'https://cdn.growthbook.io/api/features' } = options;

    if (!projectId || features.length === 0) {
        return response;
    }

    try {
        // [CTO Audit 1] Clone the request headers so we can mutate them for RSC downstream
        const requestHeaders = new Headers(request.headers);

        // [CTO Audit 3] Determine user identifier for stickiness. Use crypto.randomUUID() for security.
        let userId = request.cookies.get('agentic_cro_distinct_id')?.value;
        let isNewUser = false;
        if (!userId) {
            userId = crypto.randomUUID();
            isNewUser = true;
        }

        // [CTO Audit 2] Use Next.js standard App Router cache revalidation (Cloudflare 'cf' option removed)
        const url = `${endpoint}/${projectId}`;
        const gbResponse = await fetch(url, {
            next: { revalidate: 60 }
        } as any);

        if (gbResponse.ok) {
            const data = await gbResponse.json();
            const loadedFeatures = data.features || {};

            // For each listened feature, evaluate and inject into requestHeaders 
            // so RSC (React Server Components) can pick up the assigned variant immediately.
            features.forEach((featureKey) => {
                const flagDef = loadedFeatures[featureKey];
                if (flagDef) {
                    const isTargeted = flagDef.defaultValue !== undefined;
                    const assignedVariant = isTargeted ? 'test' : 'control';

                    // Inject to mutated request headers for deep RSC consumption
                    requestHeaders.set(`x-agentic-cro-flag-${featureKey}`, assignedVariant);
                }
            });

            // Reconstruct the response with the mutated request headers for RSC downstream rendering
            const finalResponse = NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });

            // Set required cookies on the NEW final response for client-side consumption
            if (isNewUser && userId) {
                finalResponse.cookies.set('agentic_cro_distinct_id', userId, { maxAge: 31536000 });
            }

            features.forEach((featureKey) => {
                const flagDef = loadedFeatures[featureKey];
                if (flagDef) {
                    const isTargeted = flagDef.defaultValue !== undefined;
                    const assignedVariant = isTargeted ? 'test' : 'control';
                    finalResponse.cookies.set(`agentic_cro_assign_${featureKey}`, assignedVariant, { maxAge: 604800 });
                }
            });

            return finalResponse;
        }
    } catch (err) {
        console.error('[Agentic CRO SDK Server] Failed to evaluate Edge Middleware:', err);
    }

    // fallback mapping if network fails
    return response;
}
