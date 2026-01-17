import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BudgetFlow - Gestion de Budget',
  description: 'Application web minimaliste pour maîtriser son budget mensuel grâce à la méthode des enveloppes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
