import React from 'react'
import { useRouter } from 'next/router'
import { useConfig } from 'nextra-theme-docs'

export default {
  logo: <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Veil</span>,
  project: {
    link: 'https://github.com/Shubbu03/veil',
  },
  docsRepositoryBase: 'https://github.com/Shubbu03/veil/tree/main/docs',
  footer: {
    text: 'Veil Documentation © 2026',
  },
  primaryHue: {
    dark: 160,
    light: 160,
  },
  codeHighlight: true,
  head: function useHead() {
    const { title } = useConfig()
    const { route } = useRouter()
    const socialCard = 'https://veil.dev/og.png'

    return (
      <>
        <meta name="msapplication-TileColor" content="#fff" />
        <meta name="theme-color" content="#fff" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="description" content="Privacy-preserving payment protocol for Solana" />
        <meta name="og:description" content="Privacy-preserving payment protocol for Solana" />
        <meta name="og:title" content={title || 'Veil'} />
        <meta name="apple-mobile-web-app-title" content="Veil" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <title>{title || 'Veil'}</title>
      </>
    )
  },
}
