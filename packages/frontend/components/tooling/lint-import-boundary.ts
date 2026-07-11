import type { Rule } from "eslint";

export interface ImportViolation {
  message: string;
}

function normalize(filePath: string): string {
  return filePath.split("\\").join("/");
}

/** atoms/molecules/organisms/templates must stay dumb -- no data-fetching. */
function isDumbLayer(filePath: string): boolean {
  return /components\/(atoms|molecules|organisms|templates)\//.test(normalize(filePath));
}

/** app/** may only import from templates/pages -- never a raw atom/molecule/organism. */
function isAppLayer(filePath: string): boolean {
  return /\/app\//.test(normalize(filePath)) || normalize(filePath).startsWith("app/");
}

const DATA_FETCH_LIBS = ["swr", "@tanstack/react-query"];

function isDataFetchImport(source: string): boolean {
  return DATA_FETCH_LIBS.includes(source) || /fetch|backend-proxy/i.test(source);
}

function isRawComponentImport(source: string): boolean {
  return /components\/(atoms|molecules|organisms)(\/|$)/.test(source);
}

/**
 * Dumb-component boundary: atoms/molecules/organisms/templates render props,
 * they never fetch data themselves (that stays in components/shell/** and
 * app/** until the screen-level refit, TASK-027+).
 */
export function checkDumbComponent(filePath: string, imports: string[]): ImportViolation[] {
  if (!isDumbLayer(filePath)) return [];
  return imports
    .filter(isDataFetchImport)
    .map((source) => ({
      message: `dumb_component_data_fetch_import: "${source}" not allowed in ${filePath}`,
    }));
}

/**
 * Atomic-design import boundary: app/** (route handlers/pages) may only
 * import templates/pages, never reach past them into a raw atom/molecule/
 * organism directly.
 */
export function checkAppLayerBoundary(filePath: string, imports: string[]): ImportViolation[] {
  if (!isAppLayer(filePath)) return [];
  return imports
    .filter(isRawComponentImport)
    .map((source) => ({
      message: `app_layer_boundary: "${source}" -- app/** may only import templates/pages, not ${source}`,
    }));
}

function makeImportBoundaryRule(
  check: (filePath: string, imports: string[]) => ImportViolation[]
): Rule.RuleModule {
  return {
    meta: { type: "problem", docs: { description: "Atomic-design import boundary." }, schema: [] },
    create(context) {
      const imports: string[] = [];
      return {
        ImportDeclaration(node) {
          imports.push(String(node.source.value));
        },
        "Program:exit"(node) {
          for (const violation of check(context.filename, imports)) {
            context.report({ node, message: violation.message });
          }
        },
      };
    },
  };
}

export const dumbComponentRule = makeImportBoundaryRule(checkDumbComponent);
export const appLayerBoundaryRule = makeImportBoundaryRule(checkAppLayerBoundary);
