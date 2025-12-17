'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../ui/button';

const yamlCode = `entities:
  Todo:
    table: todos
    fields:
      id: uuid!
      title: string!
      completed: boolean = false
      userId: uuid!
      user: User!
    crud:
      enabled: true

  User:
    table: users
    fields:
      id: uuid!
      email: string! unique
      name: string!
      todos: Todo[]
    crud:
      enabled: true

endpoints:
  /todos/complete:
    post:
      handler: handlers/completeTodo
      auth: true`;

const handlerCode = `import { HandlerContext } from '@yamajs/yama';

export async function completeTodo(ctx: HandlerContext) {
  const { id } = ctx.body;
  
  return ctx.db.update('todos', {
    where: { id },
    data: { completed: true }
  });
}`;

const openApiCode = `paths:
  /todos:
    get:
      summary: List all todos
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Todo'
    post:
      summary: Create a todo
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TodoCreate'
components:
  schemas:
    Todo:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        completed: { type: boolean }`;

const sdkCode = `import { YamaClient } from './generated/client';

const client = new YamaClient({
  baseURL: 'http://localhost:4000'
});

// Fully type-safe, autocompleted
const todos = await client.todos.list();

const newTodo = await client.todos.create({
  title: 'Build something amazing',
  completed: false
});

// Custom endpoint
await client.todos.complete({ id: newTodo.id });`;

export function CodeDemoSection() {
  const [activeTab, setActiveTab] = useState<'openapi' | 'sdk'>('openapi');
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedHandler, setCopiedHandler] = useState(false);

  const copyToClipboard = async (text: string, setCopied: (val: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-24 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Write this <span className="text-primary">â†’</span> Get this
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            One config file + minimal handlers = Full API with docs and SDKs
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Input (YAML + Handler) */}
          <div className="space-y-6">
            {/* YAML Config */}
            <div className="rounded-xl border border-primary/30 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3 bg-primary/5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-mono text-primary">yama.yaml</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => copyToClipboard(yamlCode, setCopiedYaml)}
                >
                  {copiedYaml ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-sm text-foreground/80 leading-relaxed">
                {yamlCode}
              </pre>
            </div>

            {/* Handler */}
            <div className="rounded-xl border border-secondary/30 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-secondary/20 px-4 py-3 bg-secondary/5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-secondary" />
                  <span className="text-sm font-mono text-secondary">handlers/completeTodo.ts</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-secondary"
                  onClick={() => copyToClipboard(handlerCode, setCopiedHandler)}
                >
                  {copiedHandler ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-sm text-foreground/80 leading-relaxed">
                {handlerCode}
              </pre>
            </div>
          </div>

          {/* Right: Output (OpenAPI or SDK) */}
          <div className="space-y-6">
            {/* Tab Selector */}
            <div className="flex gap-2 p-1 rounded-lg bg-card/50 border border-primary/20">
              <button
                onClick={() => setActiveTab('openapi')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'openapi'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                OpenAPI Spec
              </button>
              <button
                onClick={() => setActiveTab('sdk')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'sdk'
                    ? 'bg-secondary/20 text-secondary border border-secondary/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Type-safe SDK
              </button>
            </div>

            {/* Code Output */}
            <div className="rounded-xl border border-primary/30 bg-card/50 backdrop-blur-sm overflow-hidden h-[500px]">
              <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3 bg-primary/5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-mono text-primary">
                    {activeTab === 'openapi' ? 'generated/openapi.yaml' : 'generated/client.ts'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">âœ¨ Auto-generated</span>
              </div>
              <pre className="overflow-x-auto p-6 font-mono text-sm text-foreground/80 leading-relaxed h-full">
                {activeTab === 'openapi' ? openApiCode : sdkCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-3xl font-bold text-primary mb-2">80</div>
            <div className="text-sm text-muted-foreground">Lines of code</div>
          </div>
          <div className="p-6 rounded-lg bg-secondary/5 border border-secondary/20">
            <div className="text-3xl font-bold text-secondary mb-2">âˆž</div>
            <div className="text-sm text-muted-foreground">API endpoints</div>
          </div>
          <div className="p-6 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="text-3xl font-bold text-purple-400 mb-2">100%</div>
            <div className="text-sm text-muted-foreground">Type safety</div>
          </div>
          <div className="p-6 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <div className="text-3xl font-bold text-yellow-400 mb-2">&lt;2min</div>
            <div className="text-sm text-muted-foreground">To production</div>
          </div>
        </div>
      </div>
    </section>
  );
}
