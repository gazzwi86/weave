import { describe, expect, it } from "vitest";

import { checkAppLayerBoundary, checkDumbComponent } from "./lint-import-boundary";

describe("test_dumb_component_lint_rejects_data_fetch_import", () => {
  it("flags a data-fetching library import in an organism", () => {
    const violations = checkDumbComponent(
      "packages/frontend/components/organisms/NavRail.tsx",
      ["react", "swr"]
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("dumb_component_data_fetch_import");
  });

  it("flags a backend-proxy import in an atom", () => {
    const violations = checkDumbComponent(
      "/Users/dev/weave/packages/frontend/components/atoms/Foo.tsx",
      ["@/lib/build/backend-proxy"]
    );
    expect(violations).toHaveLength(1);
  });

  it("allows plain react/token imports in a molecule", () => {
    const violations = checkDumbComponent(
      "packages/frontend/components/molecules/Foo.tsx",
      ["react", "@/lib/utils"]
    );
    expect(violations).toHaveLength(0);
  });

  it("does not govern files outside the atomic layers", () => {
    const violations = checkDumbComponent("packages/frontend/components/shell/nav.tsx", ["swr"]);
    expect(violations).toHaveLength(0);
  });
});

describe("test_template_has_no_business_logic_imports", () => {
  it("flags a data-fetch import in a template", () => {
    const violations = checkDumbComponent(
      "packages/frontend/components/templates/canvas-page.tsx",
      ["@tanstack/react-query"]
    );
    expect(violations).toHaveLength(1);
  });
});

describe("test_app_layer_imports_only_templates_or_pages", () => {
  it("flags an app/** file importing a raw organism directly", () => {
    const violations = checkAppLayerBoundary(
      "packages/frontend/app/dashboard/page.tsx",
      ["@/components/organisms/NavRail"]
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("app_layer_boundary");
  });

  it("flags an app/** file importing a raw atom directly (absolute path)", () => {
    const violations = checkAppLayerBoundary(
      "/Users/dev/weave/packages/frontend/app/dashboard/page.tsx",
      ["@/components/atoms/Button"]
    );
    expect(violations).toHaveLength(1);
  });

  it("allows an app/** file importing a template", () => {
    const violations = checkAppLayerBoundary(
      "packages/frontend/app/dashboard/page.tsx",
      ["@/components/templates/dashboard-grid"]
    );
    expect(violations).toHaveLength(0);
  });

  it("does not govern non-app files", () => {
    const violations = checkAppLayerBoundary(
      "packages/frontend/components/templates/canvas-page.tsx",
      ["@/components/organisms/NavRail"]
    );
    expect(violations).toHaveLength(0);
  });
});
