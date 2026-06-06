// pages/_document.js  (DIRECTORY app)
//
// Custom Document so the Google Tag Manager container loads on EVERY directory
// page (index, all advisor profiles, badge page, etc.). Next.js uses a default
// _document when none exists; this adds one solely to inject GTM.
//
// GTM container: GTM-W69392BN (the same container used on the main site).
// IMPORTANT: GTM only *loads* here. Whether GA4 receives pageviews depends on
// the container having a GA4 Configuration/Google Tag (a "G-XXXXXXX" id) firing
// on All Pages. Confirm that tag exists in the container, or GA4 will stay empty
// even though GTM is present.

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
