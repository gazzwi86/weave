// TASK-030 AC-3: /explorer is auth-gated (middleware.ts redirects an
// unauthenticated request to /auth/login) -- lighthouserc-explorer.json's
// `puppeteerScript` runs this before each collect pass so Lighthouse scores
// the real, panel-loaded Explorer page, not the login redirect.
module.exports = async (page) => {
  await page.goto("http://localhost:3000/explorer", { waitUntil: "networkidle0" });
  await page.click('button::-p-text("Sign in with Weave")');
  await page.waitForSelector('h1::-p-text("Weave Mock OIDC — Sign in")');
  await page.click('button::-p-text("Sign in")');
  await page.waitForFunction(() => window.location.pathname === "/explorer");
  // M2 panels active (AC-3): trigger the heatmap overlay so a representative
  // panel is on screen for the scored pass, same as explorer-a11y-m2.spec.ts.
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
};
