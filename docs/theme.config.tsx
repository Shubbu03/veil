import React from "react";

export default {
  logo: <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>Veil</span>,
  project: {
    link: "https://github.com/Shubbu03/veil",
  },
  docsRepositoryBase: "https://github.com/Shubbu03/veil/tree/main/docs",
  footer: {
    text: "Veil Documentation © 2026",
  },
  primaryHue: {
    dark: 160,
    light: 160,
  },
  codeHighlight: true,
  head: () => {
    return (
      <>
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="description" content="Privacy-preserving payment protocol for Solana" />
        <meta name="og:description" content="Privacy-preserving payment protocol for Solana" />
        <meta name="og:title" content="Veil" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Veil" />
        <link rel="icon" href="/veil-logo.png" type="image/png" />
      </>
    );
  },
};
