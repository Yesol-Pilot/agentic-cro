// src/provider.tsx
import posthog from "posthog-js";
import { useEffect } from "react";
import { Fragment, jsx } from "react/jsx-runtime";
function AgenticWrapper({
  children,
  projectKey,
  apiHost = "https://us.i.posthog.com",
  debug = false
}) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        posthog.init(projectKey, {
          api_host: apiHost,
          // 🚨 CRITICAL: Use a separate namespace to prevent colliding with target app's PostHog
          name: "agentic_cro",
          person_profiles: "identified_only",
          capture_pageview: false,
          // Recommended for SPAs
          loaded: (ph) => {
            if (debug) console.log("[Agentic CRO SDK] Telemetry injected via separate namespace.");
          }
        });
      }
    } catch (err) {
      console.error("[Agentic CRO SDK] Failed to initialize telemetry:", err);
    }
  }, [projectKey, apiHost, debug]);
  return /* @__PURE__ */ jsx(Fragment, { children });
}
export {
  AgenticWrapper
};
