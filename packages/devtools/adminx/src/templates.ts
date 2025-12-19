interface LayoutOptions {
  title: string;
  basePath: string;
  currentPath?: string;
  content: string;
  message?: string;
}

export function layout(options: LayoutOptions): string {
  const { title, basePath, currentPath, content, message } = options;
  const links = [
    { href: basePath, label: "Dashboard" },
    { href: `${basePath}/entities`, label: "Entities" },
    { href: `${basePath}/schemas`, label: "Schemas" },
    { href: `${basePath}/endpoints`, label: "Endpoints" },
    { href: `${basePath}/migrations`, label: "Migrations" },
  ];

  const nav = links
    .map(
      (link) => `
      <a href="${link.href}" class="nav-link ${
        currentPath && currentPath === link.href ? "active" : ""
      }">${link.label}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script defer src="https://unpkg.com/alpinejs@3.14.3/dist/cdn.min.js"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f172a;
      --panel: #111827;
      --card: #1f2937;
      --border: #1f2937;
      --text: #e5e7eb;
      --muted: #9ca3af;
      --accent: #22d3ee;
      --accent-2: #8b5cf6;
      --danger: #f87171;
      --success: #34d399;
      --warning: #fbbf24;
      --radius: 10px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 20% 20%, rgba(34,211,238,0.06), transparent 25%), 
                  radial-gradient(circle at 80% 0%, rgba(139,92,246,0.08), transparent 30%),
                  var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      position: sticky;
      top: 0;
      backdrop-filter: blur(10px);
      background: rgba(15,23,42,0.8);
      border-bottom: 1px solid var(--border);
      padding: 14px 20px;
      z-index: 10;
    }
    header h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    header h1 span.logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #0b0f1a;
      font-weight: 800;
      font-size: 14px;
    }
    nav {
      display: flex;
      gap: 12px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .nav-link {
      padding: 8px 12px;
      border-radius: 8px;
      color: var(--muted);
      text-decoration: none;
      border: 1px solid transparent;
      background: rgba(255,255,255,0.02);
      transition: all 0.2s ease;
    }
    .nav-link:hover {
      color: var(--text);
      border-color: rgba(255,255,255,0.08);
      transform: translateY(-1px);
    }
    .nav-link.active {
      color: var(--text);
      border-color: rgba(255,255,255,0.12);
      background: linear-gradient(135deg, rgba(34,211,238,0.08), rgba(139,92,246,0.08));
    }
    main {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
      flex: 1;
    }
    .panel {
      background: rgba(17,24,39,0.8);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      letter-spacing: 0.2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      color: var(--muted);
      font-weight: 600;
      background: rgba(255,255,255,0.02);
    }
    tr:hover td {
      background: rgba(255,255,255,0.02);
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .muted { color: var(--muted); }
    form {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input, select, textarea {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.03);
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: rgba(34,211,238,0.5);
      box-shadow: 0 0 0 3px rgba(34,211,238,0.15);
    }
    button {
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #0b0f1a;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    button.secondary {
      background: rgba(255,255,255,0.06);
      color: var(--text);
      border-color: rgba(255,255,255,0.1);
    }
    button.danger {
      background: linear-gradient(135deg, #f87171, #ef4444);
      color: #0b0f1a;
    }
    button:hover { opacity: 0.95; transform: translateY(-1px); }
    .message {
      margin: 0 0 12px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(34,211,238,0.08);
      border: 1px solid rgba(34,211,238,0.15);
    }
    .empty {
      padding: 14px;
      border: 1px dashed var(--border);
      border-radius: 10px;
      color: var(--muted);
      text-align: center;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <h1><span class="logo">Y</span> AdminX</h1>
      <nav>${nav}</nav>
    </header>
    <main>
      <div class="panel">
        ${message ? `<div class="message">${message}</div>` : ""}
        ${content}
      </div>
    </main>
  </div>
</body>
</html>`;
}

export function renderKeyValueTable(title: string, items: Record<string, unknown>[]): string {
  if (!items || items.length === 0) {
    return `<div class="empty">No data available.</div>`;
  }
  const columns = Array.from(
    items.reduce((set, item) => {
      Object.keys(item || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const header = columns.map((c) => `<th>${c}</th>`).join("");
  const rows = items
    .map((row) => {
      return `<tr>${columns
        .map((c) => `<td>${formatValue((row as any)?.[c])}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  return `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return `<span class="muted">—</span>`;
  if (typeof value === "object") return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  return escapeHtml(String(value));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

