export const metadata = {
  title: 'Gratitude Concert — Personalise Your Flyer',
  description: 'Upload your photo and add your name to the Season 17 flyer.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0f1e', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
