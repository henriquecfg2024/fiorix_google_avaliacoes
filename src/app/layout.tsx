import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FIORIX - 7º Registro de Imóveis de SP",
  description: "Gestão de Avaliações do Google e Módulo BI de Prazos do 7º Registro de Imóveis de SP",
  manifest: "/manifest.json",
  themeColor: "#002B49",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FIORIX",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
