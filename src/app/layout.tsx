import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeuxNous — Budget & préparatifs",
  description: "Votre espace privé pour gérer le budget et préparer votre vie à deux.",
  applicationName: "DeuxNous",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "DeuxNous" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f6f1" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));" }} />
      </body>
    </html>
  );
}
