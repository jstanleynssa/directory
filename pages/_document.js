// pages/_document.js
// Sets <html lang="en"> for accessibility and SEO, loads the brand fonts
// (Poppins for headings, Open Sans for body) to match nssapros.com, and loads
// the Google Tag Manager container (GTM-W69392BN) on every page so GA4 records
// directory traffic. (GA4 tag G-NHM8DNNLCG fires on All Pages within GTM.)
import { Html, Head, Main, NextScript } from 'next/document'

const GTM_ID = 'GTM-W69392BN'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google Tag Manager — <head> portion */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
        {/* End Google Tag Manager */}

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Poppins:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        {/* Google Tag Manager (noscript) — immediately after <body> opens */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
