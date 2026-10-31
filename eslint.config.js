import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

// Lint covers all of src/, scripts/ and api/ (plan item E3 30). Before
// October 2026 it covered only src/components, src/pages and Layout.jsx,
// and its `rules` block replaced the recommended sets instead of adding
// to them, so only five rules ran anywhere. Now the recommended sets are
// spread first and the project rules below adjust them.
//
// Not linted here: supabase/functions (Deno TypeScript; the edge
// functions are tested through src/lib/__tests__/edgeHarness.js) and the
// two .ts files in src (no TypeScript parser is installed; tsc parses
// them in `pnpm typecheck`).

const SRC = ["src/**/*.{js,mjs,cjs,jsx}"];
const NODE = [
  "scripts/**/*.{js,mjs,cjs}",
  "api/**/*.{js,mjs,cjs}",
  "e2e/**/*.{js,mjs}",
  "*.{js,mjs,cjs}",
];
const TESTS = [
  "src/**/__tests__/**/*.{js,jsx,mjs}",
  "src/**/*.test.{js,jsx,mjs}",
  "scripts/**/__tests__/**/*.{js,mjs}",
  "e2e/**/*.{js,mjs}",
];

// Shared by every linted file. `no-unused-vars` is handed to the
// unused-imports plugin, which can auto-remove dead imports.
const sharedRules = {
  "no-unused-vars": "off",
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
      caughtErrors: "none",
    },
  ],
  // Empty catch blocks are a deliberate "best effort, never block the
  // member" pattern across the app (analytics, storage, push). Other
  // empty blocks are still errors.
  "no-empty": ["error", { allowEmptyCatch: true }],
};

export default [
  {
    ignores: [
      "dist/**",
      "android/**",
      "ios/**",
      "node_modules/**",
      ".claude/**",
      "public/**",
      "vendor/**",
      "supabase/**",
      "demo/**",
      "content/**",
      "docs/**",
    ],
  },

  // Browser app: every file under src/.
  {
    files: SRC,
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      // __BUILD_INFO__ (vite.config.js `define`) is declared with a
      // `/* global */` comment where it is read, in src/lib/adminData.js.
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      ...pluginReact.configs.flat.recommended.plugins,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.flat.recommended.rules,
      ...sharedRules,
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      // Plain-language copy uses apostrophes and quotes everywhere; React
      // renders them safely, so escaping them would only hurt readability.
      "react/no-unescaped-entities": "off",
      // The two classic hook rules. The React Compiler rules that
      // eslint-plugin-react-hooks 7 adds to its recommended set
      // (set-state-in-effect, purity, refs and so on) are for apps that
      // run the compiler; this one does not.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Node scripts, Vercel API routes and root config files.
  {
    files: NODE,
    ...pluginJs.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    plugins: { "unused-imports": pluginUnusedImports },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...sharedRules,
    },
  },

  // Tests run under Vitest in Node (some with jsdom) and Playwright.
  {
    files: TESTS,
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // Errors the wider lint found in files another workstream is editing
  // in the same round (October 2026). They are warnings here, for these
  // files only, so the two changes cannot collide; each is a one-line fix
  // for the file's owner, after which its entry should be deleted.
  //   src/lib/layoutConstants.js: drop the unused Store icon import.
  //   src/data/genetics-sections.jsx: drop Subsection, TrendingUp, ArrowUp.
  //   scripts/build-agent-data.mjs: drop the unused morphsToMarkdown import.
  //   scripts/build-vercel-json.mjs: drop getAllSpaPathPatterns.
  {
    files: [
      "src/lib/layoutConstants.js",
      "src/data/genetics-sections.jsx",
      "scripts/build-agent-data.mjs",
      "scripts/build-vercel-json.mjs",
    ],
    rules: { "unused-imports/no-unused-imports": "warn" },
  },
];
