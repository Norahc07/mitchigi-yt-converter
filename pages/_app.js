// pages/_app.js
import '../public/css/styles.css'; // Importing global CSS
import { useEffect } from 'react';

function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default App;
