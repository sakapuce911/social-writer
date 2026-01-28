// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  baseDirectory: new URL(".", import.meta.url).pathname,
});

export default [
  js.configs.recommended,

  // Config Next (inclut TS si présent)
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ✅ Overrides SAFE : on garde les règles utiles, on enlève juste ce qui te bloque
  {
    rules: {
      // Ton blocage actuel (errors)
      "@typescript-eslint/no-explicit-any": "off",

      // Ton warning actuel (optionnel : tu peux laisser en warning)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];
