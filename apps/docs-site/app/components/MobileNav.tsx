'use client';

import Link from 'next/link';
import { Menu, ArrowRight } from 'lucide-react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from './ui/sheet';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { sidebarItems } from './Sidebar';

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="px-4 py-3 border-b border-border text-left">
          <SheetTitle className="text-sm font-semibold text-foreground">Navigate</SheetTitle>
          <p className="text-xs text-muted-foreground">Docs, guides, and reference</p>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)] px-4 py-4">
          <div className="space-y-6">
            {sidebarItems.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  {group.title}
                </p>
                <div className="grid gap-1.5">
                  {group.items.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between rounded-lg border border-transparent bg-muted/40 px-3 py-2 text-sm text-foreground transition hover:border-border hover:bg-muted"
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </SheetClose>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <SheetClose asChild>
                <Link
                  href="/docs/getting-started"
                  className="flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow hover:shadow-md transition"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/docs/reference"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted transition"
                >
                  API reference
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </SheetClose>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}










