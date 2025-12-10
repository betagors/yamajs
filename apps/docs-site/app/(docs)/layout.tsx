import { Sidebar } from '../components/Sidebar';

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 min-w-0 py-8 px-6 lg:px-12">
                <div className="prose prose-neutral dark:prose-invert max-w-4xl mx-auto prose-headings:font-semibold prose-a:text-primary prose-code:bg-muted prose-code:text-foreground prose-code:rounded prose-code:px-1 prose-pre:bg-muted prose-pre:border prose-pre:border-border">
                    {children}
                </div>
            </main>
        </div>
    );
}
