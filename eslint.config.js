const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const stylistic = require("@stylistic/eslint-plugin");
const unusedImports = require("eslint-plugin-unused-imports");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = defineConfig(
  {
    ignores: [
      "**/dist/**/*",
    ],
  },
  {
    files: [
      "**/*.js"
    ],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    files: [
      "**/*.ts",
    ],
    extends: [
      tseslint.configs.recommended,
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "**/*.{js,ts}",
    ],
    plugins: {
      "@stylistic": stylistic,
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn", {
          "vars": "all",
          "args": "after-used",
          "ignoreRestSiblings": true,
          "caughtErrors": "none",
        }
      ],
      "@stylistic/indent": ["error", 2, {
        "SwitchCase": 1,
      }],
      "@stylistic/quotes": ["error", "double", {
        "avoidEscape": true,
        "allowTemplateLiterals": "always",
      }],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/linebreak-style": ["error", "unix"],
      "@stylistic/eol-last": ["error", "always"],
      "object-shorthand": "error",
      "prefer-template": "error",
      "@stylistic/template-curly-spacing": "error",
      "@stylistic/padding-line-between-statements": [
        "error",
        { "blankLine": "always", "prev": "*", "next": "return" },
        { "blankLine": "always", "prev": "*", "next": "block-like" },
        { "blankLine": "always", "prev": "*", "next": "function" },
        { "blankLine": "always", "prev": "*", "next": "class" },
        { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
        { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"]},
      ]
    },
  },
);
