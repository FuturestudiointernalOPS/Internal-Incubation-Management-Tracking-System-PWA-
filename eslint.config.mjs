import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

/**
 * ImpactOS ESLint flat config.
 *
 * Replaces the previous FlatCompat + "next/core-web-vitals" legacy preset,
 * which crashed under ESLint 9.18 (circular plugin structure during config
 * validation). All presets below are native flat configs.
 *
 * Repo-wide conventions encoded here (see .ai/STANDARDS.md + AGENTS.md):
 *  - Next.js automatic JSX runtime → react/react-in-jsx-scope is off.
 *  - No PropTypes used → react/prop-types off.
 *  - Empty `catch (_) {}` blocks are an intentional error-swallow pattern.
 *  - New react-hooks v6 "compiler" rules are aspirational for legacy code.
 */

const nextFlat = nextPlugin.configs["core-web-vitals"];
const nextPluginEntry = Array.isArray(nextFlat) ? nextFlat : [nextFlat];

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "graphify-out/**",
      "graphify-out-full/**",
      "scratch/**",
      "docs/**",
      "*.pdf",
      "*.html",
      "src/lib/*.db",
    ],
  },

  // ESLint recommended (JS semantics)
  js.configs.recommended,

  // Next.js core-web-vitals (flat preset from @next/eslint-plugin-next)
  ...nextPluginEntry,

  // React Hooks (flat preset)
  reactHooks.configs.flat.recommended,

  // React recommended (flat preset)
  react.configs.flat.recommended,

  // Shared language options: browser + node/server globals. Most files are
  // ESM shared between client components ("use client") and server code, so
  // both global sets are enabled repo-wide.
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "19.0" },
    },
  },

  // Repo-wide conventions (see .ai/STANDARDS.md)
  {
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // react-hooks v6 compiler rules — aspirational for legacy code
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
    },
  },

  // Jest test suites
  {
    files: ["src/__tests__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
