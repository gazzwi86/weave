import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionClaims } from "@/lib/auth/session-claims";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Weave — the operating system for the AI-native company",
  description:
    "Model your business as a live knowledge graph, then generate the apps, agents, and automations that run it.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const { role, tenantId } = getSessionClaims(session?.accessToken);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell role={role} tenantId={tenantId}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
