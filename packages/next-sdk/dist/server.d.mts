import { NextRequest, NextResponse } from 'next/server';

interface AgenticCROMiddlewareOptions {
    projectId?: string;
    features: string[];
    endpoint?: string;
}
/**
 * Agentic CRO Edge Middleware (Zero-Flicker Architecture)
 * Evaluates feature flags at the Edge before rendering the RSC to prevent layout shifts.
 */
declare function runAgenticCROMiddleware(request: NextRequest, response: NextResponse, options: AgenticCROMiddlewareOptions): Promise<NextResponse<unknown>>;

export { type AgenticCROMiddlewareOptions, runAgenticCROMiddleware };
