// pages/_app.js
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style jsx global>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: "Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #ffffff;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: "Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        a { color: inherit; }
      `}</style>
      <Component {...pageProps} />
    </>
  )
}
