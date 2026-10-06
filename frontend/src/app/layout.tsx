import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { GYM_THEME_STORAGE_KEY } from "@/lib/gym-theme";
import { Providers } from "@/components/providers";
import { VersionBadge } from "@/components/shared/version-badge";

// Applies the last-known gym brand colors synchronously, before React
// hydrates or the browser paints — otherwise the page flashes the app's
// default purple theme for however long GET /gyms/me takes to resolve, then
// jumps to the gym's real colors once useGymTheme's effect (app-shell.tsx)
// runs. Mirrors that effect's CSS custom properties and readableForeground
// math by hand since this has to run as a vanilla script, before any React
// code (including that effect) exists — keep the two in sync.
const GYM_THEME_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem(${JSON.stringify(GYM_THEME_STORAGE_KEY)});
    if (!raw) return;
    var theme = JSON.parse(raw);
    var root = document.documentElement.style;
    function readableForeground(hex) {
      var r = parseInt(hex.slice(1, 3), 16) / 255;
      var g = parseInt(hex.slice(3, 5), 16) / 255;
      var b = parseInt(hex.slice(5, 7), 16) / 255;
      var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance > 0.55 ? "oklch(0.2 0.02 275)" : "oklch(0.98 0.01 275)";
    }
    if (theme.primary_color) {
      root.setProperty("--primary", theme.primary_color);
      root.setProperty("--primary-solid", theme.primary_color);
      root.setProperty("--primary-foreground", readableForeground(theme.primary_color));
      root.setProperty("--ring", theme.primary_color + "99");
      root.setProperty("--sidebar-primary", theme.primary_color);
      root.setProperty("--sidebar-primary-foreground", readableForeground(theme.primary_color));
      root.setProperty("--sidebar-ring", theme.primary_color + "99");
      root.setProperty("--chart-1", theme.primary_color);
    }
    if (theme.secondary_color) {
      root.setProperty("--accent", theme.secondary_color);
      root.setProperty("--accent-foreground", readableForeground(theme.secondary_color));
      root.setProperty("--sidebar-accent", theme.secondary_color);
    }
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Bold, condensed display face for headings (Card/Dialog titles, the login
// hero) — distinct from Geist Sans on body text so the product reads with
// an athletic, gym-branding voice instead of a generic SaaS-kit look.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GymOps Ai",
  description: "Gestión de gimnasios multi-tenant, control de acceso y prescripciones de salud.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
      // The pre-hydration script below sets brand-color CSS custom
      // properties directly on this element's `style` before React
      // hydrates, so its server-rendered (empty) style never matches the
      // client's first paint — expected, not a real mismatch to warn about.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background">
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run
            before paint; see GYM_THEME_SCRIPT comment above */}
        <script dangerouslySetInnerHTML={{ __html: GYM_THEME_SCRIPT }} />
        <Providers>{children}</Providers>
        <VersionBadge />
      </body>
    </html>
  );
}
