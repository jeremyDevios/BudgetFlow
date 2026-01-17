import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BudgetFlow - Gestion de Budget par Enveloppes",
  description: "Application web minimaliste pour maîtriser son budget mensuel grâce à la méthode des enveloppes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
