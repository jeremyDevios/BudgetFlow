import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Vizualy Budget",
  description: "Gérez votre budget simplement",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Récupérer le nonce CSP injecté par le middleware.
  // En dev (sans middleware qui tourne) ou sur les pages statiques,
  // on utilise 'unsafe-inline' comme fallback via next.config.mjs.
  const headersList = await headers();
  const nonce = headersList.get("x-csp-nonce");

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce || undefined}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Vizualy Budget" />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
