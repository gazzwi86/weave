import type { MetadataRoute } from "next";

// ponytail: Next's metadata route is the native way to serve a valid
// robots.txt (Lighthouse SEO's robots-txt audit failed with none present).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
