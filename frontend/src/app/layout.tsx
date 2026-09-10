import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
    >
      <body className="min-h-full flex flex-col bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
