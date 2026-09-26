import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const viewport = {
  themeColor: "#050B14",
};

export const metadata: Metadata = {
  title: "FIORIX - 7º Registro de Imóveis de SP",
  description: "Gestão de Avaliações do Google e Módulo BI de Prazos do 7º Registro de Imóveis de SP",
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("font-sans dark", inter.variable)} style={{ colorScheme: 'dark' }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                localStorage.setItem('theme', 'dark');
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} bg-[#050B14] text-[#f8fafc]`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
        >
          <TooltipProvider>
            {children}
            <div className="print:hidden">
              <Toaster position="bottom-right" richColors />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
