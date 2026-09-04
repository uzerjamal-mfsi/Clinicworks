import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const baseTs = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  plugins: {
    "@typescript-eslint": tsPlugin,
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    ".turbo/**",
    "apps/web/.next/**",
    "apps/web/out/**",
    "apps/function/dist/**",
    "next-env.d.ts",
    "pnpm-lock.yaml",
  ]),
  ...nextVitals,
  ...nextTs,
  baseTs,
  prettier,
]);
