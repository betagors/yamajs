import { Inter } from 'next/font/google';
import './globals.css';
import { Logo } from './components/Logo';
import Link from 'next/link';
import { ThemeProvider } from "./components/theme-provider"
import { ModeToggle } from "./components/mode-toggle"

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Yama JS Documentation',
    description: 'Configuration-first backend platform.',
};

const navLinks = [
    { href: '/docs', label: 'Docs' },
    { href: '/docs/getting-started', label: 'Getting Started' },
    { href: 'https://github.com/betagors/yamajs', label: 'GitHub', external: true },
];

function Navbar() {
    return (
        <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-3">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-sm font-semibold text-foreground no-underline transition hover:opacity-80"
                >
                    <Logo />
                </Link>
                <div className="flex items-center gap-2">
                    {navLinks.map((link) =>
                        link.external ? (
                            <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
                            >
                                {link.label}
                            </a>
                        ) : (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
                            >
                                {link.label}
                            </Link>
                        ),
                    )}
                    <Link
                        href="/docs"
                        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                    >
                        Docs
                    </Link>
                    <ModeToggle />
                </div>
            </div>
        </nav>
    )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Navbar />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
