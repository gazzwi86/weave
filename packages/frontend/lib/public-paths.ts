// Shared by middleware.ts (route guard) and app-shell.tsx (chrome
// visibility) -- PR #13 finding (5): these drifted out of sync when
// /robots.txt was added to only one copy. One source of truth now.
//
// robots.txt must stay reachable by unauthenticated crawlers -- Lighthouse's
// SEO audit scores 0 if a crawler gets redirected to the sign-in page instead.
export const PUBLIC_PATHS = new Set(["/", "/auth/login", "/robots.txt"]);
