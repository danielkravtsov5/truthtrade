import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TruthTrade — Verified Day Trading Social',
  description: 'Share your real trades. No faking. Verified directly from Binance.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-100">{children}</body>
    </html>
  )
}
