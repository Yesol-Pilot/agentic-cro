"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server.ts
var server_exports = {};
__export(server_exports, {
  runAgenticCROMiddleware: () => runAgenticCROMiddleware
});
module.exports = __toCommonJS(server_exports);
var import_server = require("next/server");
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
      const finalResponse = import_server.NextResponse.next({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runAgenticCROMiddleware
});
