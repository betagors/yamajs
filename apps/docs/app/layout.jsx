import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Banner, Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';

export const metadata = {
  title: 'Yama JS Documentation',
  description: 'Configuration-first backend platform that turns YAML into fully functional APIs, SDKs, and documentation.',
};

const navbar = (
  <Navbar
    logo={<b>Yama JS</b>}
  />
);
const footer = <Footer>MIT {new Date().getFullYear()} © Yama JS.</Footer>;

export default async function RootLayout({ children }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
    >
      <Head>
        {/* Additional head tags can be added here */}
      </Head>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/betagors/yama/tree/main/apps/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}

