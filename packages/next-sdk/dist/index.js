"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AgenticWrapper: () => AgenticWrapper
});
module.exports = __toCommonJS(index_exports);

// src/provider.tsx
var import_posthog_js = __toESM(require("posthog-js"));
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function AgenticWrapper({
  children,
  projectKey,
  apiHost = "https://us.i.posthog.com",
  debug = false
}) {
  (0, import_react.useEffect)(() => {
    try {
      if (typeof window !== "undefined") {
        import_posthog_js.default.init(projectKey, {
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgenticWrapper
});
