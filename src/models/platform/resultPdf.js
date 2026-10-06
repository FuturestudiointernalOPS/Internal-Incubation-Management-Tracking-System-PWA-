/**
 * Platform result PDF renderers (VIEW/rendering layer).
 *
 * Thin BARREL over cohesive modules in the sibling
 * `models/platform/resultPdf/` folder (the split convention: `x.js` + `x/`):
 *
 *   shared.js     — the colour palette, the EN/FR copy and the layout helpers
 *   submission.js — the fixed submission result document
 *   composed.js   — the AI-composed report document
 *
 * The two builders are the module's public surface; `shared` is internal.
 * Importers keep the same path (`@/models/platform/resultPdf`).
 */

export * from "./resultPdf/submission";
export * from "./resultPdf/composed";
