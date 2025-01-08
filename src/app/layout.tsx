import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Time Chapter',
  description: 'Time management and logging application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}