"use client";

import Link from 'next/link';
import { ScrollArea } from "@/components/ui/scroll-area"

// Manual sidebar configuration - replace with dynamic if needed later
const sidebarItems = [
    {
        title: 'Getting Started',
        items: [
            { href: '/docs', label: 'Introduction' },
            { href: '/docs/getting-started', label: 'Quick Start' },
        ]
    },
    {
        title: 'Core Concepts',
        items: [
            { href: '/docs/core-concepts', label: 'Overview' },
            { href: '/docs/core-concepts/schemas', label: 'Schemas' },
            { href: '/docs/core-concepts/endpoints', label: 'Endpoints' },
            { href: '/docs/core-concepts/handlers', label: 'Handlers' },
            { href: '/docs/core-concepts/entities', label: 'Entities' },
        ]
    },
    {
        title: 'Guides',
        items: [
            { href: '/docs/guides', label: 'All Guides' },
        ]
    },
    {
        title: 'Reference',
        items: [
            { href: '/docs/reference', label: 'API Reference' },
        ]
    }
];

export function Sidebar() {
    return (
        <aside className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block md:w-64 border-r border-border bg-background">
            <ScrollArea className="h-full py-6 pr-6 lg:py-8">
                <div className="w-full px-4">
                    {sidebarItems.map((group, i) => (
                        <div key={i} className="pb-4">
                            <h4 className="mb-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground">{group.title}</h4>
                            <div className="grid grid-flow-row auto-rows-max text-sm gap-0.5">
                                {group.items.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="group flex w-full items-center rounded-md border border-transparent px-2 py-1 hover:bg-muted hover:text-foreground text-muted-foreground transition-colors"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </aside>
    );
}
