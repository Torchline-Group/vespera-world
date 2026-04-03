import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vespera World',
  description: 'Luxury Commerce CRM and Portal',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="vespera-world-theme">{children}</body>
    </html>
  )
}
