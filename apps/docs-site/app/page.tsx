import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';

const features = [
  {
    title: 'YAML-first, type-safe',
    description:
      'Describe schemas, endpoints, and auth in one config. Yama turns it into validated routes, OpenAPI, and types.',
  },
  {
    title: 'IR-powered SDKs',
    description:
      'A single intermediate representation powers client SDKs and docs, so every change ships consistently.',
  },
  {
    title: 'Batteries-included runtime',
    description:
      'Handlers, plugins, JWT auth, migrations, and platform utilities are ready out of the box—no scaffolding drama.',
  },
  {
    title: 'CLI built for flow',
    description:
      'Spin up dev servers, generate code, and migrate with one CLI. Everything stays in sync with your config.',
  },
];

const steps = [
  {
    title: 'Describe',
    copy: 'Capture your API surface in yama.yaml—schemas, entities, endpoints, plugins, and auth rules.',
  },
  {
    title: 'Implement',
    copy: 'Write TypeScript handlers for the bits that need logic. Yama wires routing, validation, and types.',
  },
  {
    title: 'Ship',
    copy: 'Generate SDKs and docs from the IR. Publish with confidence knowing contracts and code match.',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1224] text-white selection:bg-primary/30">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(56,189,248,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_50%,rgba(99,102,241,0.1),transparent_40%)]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      <div className="container relative z-10 mx-auto flex max-w-7xl flex-col gap-20 px-4 py-20 lg:py-32">
        {/* Hero Section */}
        <header className="grid items-center gap-12 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-primary-foreground backdrop-blur-sm transition hover:bg-white/10">
              <span className="mr-2 flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Configuration-first backend platform
            </div>
            
            <div className="space-y-6">
              <h1 className="text-5xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">
                Build APIs from <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">YAML</span>
              </h1>
              <p className="text-xl leading-relaxed text-slate-300 max-w-xl">
                Yama reads your config, generates type-safe routes, SDKs, and docs from a single IR, and keeps your handlers clean in TypeScript.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base shadow-glow hover:shadow-glow-lg transition-all duration-300">
                <Link href="/docs/getting-started">
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all"
              >
                <Link href="/docs">View Documentation</Link>
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-400" />
                <span>Type-safe IR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-blue-400" />
                <span>Auto-generated SDKs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-purple-400" />
                <span>Zero-boilerplate</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 opacity-20 blur-2xl" />
            <Card className="relative border-white/10 bg-[#0b1424]/80 backdrop-blur-xl shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/20" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
                    <div className="h-3 w-3 rounded-full bg-green-500/20" />
                  </div>
                  <span className="ml-2 text-xs font-medium text-slate-400">yama.yaml</span>
                </div>
                <Badge variant="secondary" className="bg-white/5 text-xs text-slate-300 font-mono">
                  v0.1.0
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed text-slate-200">
{`name: yamajs-demo
version: 0.1.0

schemas:
  Todo:
    type: object
    properties:
      id: { type: string, format: uuid }
      title: { type: string }
      completed: { type: boolean }

endpoints:
  /todos:
    get:
      handler: handlers/listTodos
      response:
        type: array
        items: { $ref: '#/schemas/Todo' }`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </header>

        {/* Features Grid */}
        <section className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Why teams choose Yama</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Stop maintaining boilerplate. Define your contract once and let Yama handle the rest.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="group border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.04] hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-100">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Workflow Section */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 md:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5" />
          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">From config to runtime</h2>
                <p className="text-slate-400 text-lg">
                  Configuration defines the contract; TypeScript defines the behavior. The IR keeps SDKs, docs, and runtime aligned.
                </p>
              </div>
              
              <div className="space-y-6">
                {steps.map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex-none">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-1 ring-primary/50">
                        {index + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-100">{step.title}</h3>
                      <p className="mt-1 text-slate-400">{step.copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button asChild variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                  <Link href="/docs/guides">Browse guides</Link>
                </Button>
                <Button asChild variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5">
                  <Link href="/docs/examples">See examples <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>

            <div className="relative rounded-xl border border-white/10 bg-[#0b1424] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <span className="text-xs font-medium text-slate-400">handlers/todos.ts</span>
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                </div>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed text-slate-200">
{`import { HandlerContext } from '@betagors/yama-core';

export async function listTodos(ctx: HandlerContext) {
  // Types are automatically inferred from schema
  return ctx.db.select('todos')
    .orderBy('createdAt', 'desc');
}

export async function createTodo(ctx: HandlerContext) {
  // Body is validated before reaching handler
  const todo = await ctx.db.insert('todos', ctx.body);
  return { id: todo.id, ...ctx.body };
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-blue-600 px-6 py-16 text-center md:px-12 lg:py-20">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative z-10 mx-auto max-w-2xl space-y-8">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Ready to build?</h2>
            <p className="text-lg text-blue-100">
              Install the CLI, start the dev server, and open the docs to ship your first endpoint in minutes.
            </p>
            
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-base shadow-lg hover:shadow-xl">
                  <Link href="/docs">Read the Docs</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-white/20 bg-white/10 px-8 text-base text-white hover:bg-white/20 hover:text-white">
                  <Link href="https://github.com/betagors/yamajs">Star on GitHub</Link>
                </Button>
              </div>
              
              <div className="flex items-center gap-3 rounded-full bg-black/20 px-4 py-2 text-sm font-mono text-blue-100 backdrop-blur-sm">
                <span>npm install -g @betagors/yama-cli</span>
                <button 
                  className="ml-2 rounded p-1 hover:bg-white/10"
                  aria-label="Copy command"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

