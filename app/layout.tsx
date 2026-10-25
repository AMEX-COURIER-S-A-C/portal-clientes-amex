import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMEX Courier • Casillero Virtual y Seguimiento de Envíos",
  description: "Portal oficial para clientes de AMEX Courier: casillero postal Miami – Lima, seguimiento de Warehouse (WR) y fotos de bodega en tiempo real.",
  icons: {
    icon: "/logo-amex.jpg",
    shortcut: "/logo-amex.jpg",
    apple: "/logo-amex.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
