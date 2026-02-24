// src/server.ts
import { NextResponse } from "next/server";
async function runAgenticCROMiddleware(request, response, options) {
  const { projectId, features, endpoint = "https://cdn.growthbook.io/api/features" } = options;
  if (!projectId || features.length === 0) {
    return response;
  }
  try {
    const requestHeaders = new Headers(request.headers);
    let userId = request.cookies.get("agentic_cro_distinct_id")?.value;
    let isNewUser = false;
    if (!userId) {
      userId = crypto.randomUUID();
      isNewUser = true;
    }
    const url = `${endpoint}/${projectId}`;
    const gbResponse = await fetch(url, {
      next: { revalidate: 60 }
    });
    if (gbResponse.ok) {
      const data = await gbResponse.json();
      const loadedFeatures = data.features || {};
      features.forEach((featureKey) => {
        const flagDef = loadedFeatures[featureKey];
        if (flagDef) {
          const isTargeted = flagDef.defaultValue !== void 0;
          const assignedVariant = isTargeted ? "test" : "control";
          requestHeaders.set(`x-agentic-cro-flag-${featureKey}`, assignedVariant);
        }
      });
      const finalResponse = NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
      if (isNewUser && userId) {
        finalResponse.cookies.set("agentic_cro_distinct_id", userId, { maxAge: 31536e3 });
      }
      features.forEach((featureKey) => {
        const flagDef = loadedFeatures[featureKey];
        if (flagDef) {
          const isTargeted = flagDef.defaultValue !== void 0;
          const assignedVariant = isTargeted ? "test" : "control";
          finalResponse.cookies.set(`agentic_cro_assign_${featureKey}`, assignedVariant, { maxAge: 604800 });
        }
      });
      return finalResponse;
    }
  } catch (err) {
    console.error("[Agentic CRO SDK Server] Failed to evaluate Edge Middleware:", err);
  }
  return response;
}
export {
  runAgenticCROMiddleware
};
