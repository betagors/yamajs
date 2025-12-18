/**
 * Email Preview UI for Development
 * 
 * Provides a web UI to view captured emails during development.
 * Only enabled when providers.email.dev.capture is true.
 * 
 * Routes:
 * - GET /__yama/emails - Email list UI
 * - GET /__yama/emails/api - JSON list of emails
 * - GET /__yama/emails/:id - View single email
 * - GET /__yama/emails/:id/html - Raw HTML content
 * - DELETE /__yama/emails - Clear all emails
 */

import { getProviders } from './config-parser.js';

// ============================================================================
// Email UI HTML Templates
// ============================================================================

function generateEmailListHTML(emails: any[]): string {
    const emailRows = emails.map(email => `
    <tr class="email-row" onclick="viewEmail('${email.id}')">
      <td class="email-subject">
        <strong>${escapeHtml(email.subject || '(no subject)')}</strong>
        ${email.links?.length ? `<span class="badge">${email.links.length} link${email.links.length > 1 ? 's' : ''}</span>` : ''}
      </td>
      <td class="email-to">${escapeHtml(email.to?.join(', ') || '')}</td>
      <td class="email-date">${formatDate(email.sentAt)}</td>
    </tr>
  `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yama Dev Mail - Captured Emails</title>
  <style>
    :root {
      --primary: #667eea;
      --primary-dark: #5a67d8;
      --bg: #f7f8fc;
      --card: #ffffff;
      --text: #1a202c;
      --text-muted: #718096;
      --border: #e2e8f0;
      --success: #48bb78;
      --danger: #f56565;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 22px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .header-actions {
      display: flex;
      gap: 10px;
    }
    
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    
    .btn-clear {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    
    .btn-clear:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .btn-refresh {
      background: white;
      color: var(--primary);
    }
    
    .btn-refresh:hover {
      background: #f0f0f0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 30px;
    }
    
    .email-count {
      color: var(--text-muted);
      margin-bottom: 15px;
      font-size: 14px;
    }
    
    .email-table {
      width: 100%;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    
    .email-table table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .email-table th {
      background: #f8fafc;
      padding: 14px 20px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    
    .email-row {
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .email-row:hover {
      background: #f8fafc;
    }
    
    .email-row td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .email-row:last-child td {
      border-bottom: none;
    }
    
    .email-subject {
      font-weight: 500;
    }
    
    .email-to {
      color: var(--text-muted);
      font-size: 14px;
    }
    
    .email-date {
      color: var(--text-muted);
      font-size: 13px;
      white-space: nowrap;
    }
    
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 12px;
      margin-left: 10px;
      font-weight: 500;
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    
    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    
    .empty-state h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--text);
    }
    
    /* Email Detail View */
    .email-detail {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
    }
    
    .email-detail-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .email-detail-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .email-detail-meta h2 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    
    .email-detail-meta p {
      font-size: 14px;
      color: var(--text-muted);
      margin: 4px 0;
    }
    
    .email-detail-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-muted);
      padding: 5px;
    }
    
    .email-detail-close:hover {
      color: var(--text);
    }
    
    .email-links {
      padding: 15px 20px;
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
    }
    
    .email-links h4 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    
    .email-links a {
      display: block;
      color: var(--primary);
      font-size: 13px;
      margin: 4px 0;
      text-decoration: none;
      word-break: break-all;
    }
    
    .email-links a:hover {
      text-decoration: underline;
    }
    
    .email-detail-body {
      flex: 1;
      overflow: auto;
    }
    
    .email-detail-body iframe {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📧 Yama Dev Mail</h1>
    <div class="header-actions">
      <button class="btn btn-clear" onclick="clearEmails()">🗑 Clear All</button>
      <button class="btn btn-refresh" onclick="location.reload()">↻ Refresh</button>
    </div>
  </div>
  
  <div class="container">
    <div class="email-count">${emails.length} email${emails.length !== 1 ? 's' : ''} captured</div>
    
    ${emails.length === 0 ? `
      <div class="empty-state">
        <div class="icon">📭</div>
        <h3>No emails captured yet</h3>
        <p>Emails sent by your app will appear here</p>
      </div>
    ` : `
      <div class="email-table">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>To</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${emailRows}
          </tbody>
        </table>
      </div>
    `}
  </div>
  
  <div class="email-detail" id="emailDetail" onclick="closeEmailDetail(event)">
    <div class="email-detail-content" onclick="event.stopPropagation()">
      <div class="email-detail-header">
        <div class="email-detail-meta">
          <h2 id="detailSubject"></h2>
          <p><strong>To:</strong> <span id="detailTo"></span></p>
          <p><strong>From:</strong> <span id="detailFrom"></span></p>
          <p><strong>Date:</strong> <span id="detailDate"></span></p>
        </div>
        <button class="email-detail-close" onclick="closeEmailDetail()">&times;</button>
      </div>
      <div class="email-links" id="detailLinks" style="display: none;">
        <h4>🔗 Links in this email</h4>
        <div id="detailLinksContent"></div>
      </div>
      <div class="email-detail-body">
        <iframe id="detailFrame" sandbox="allow-same-origin"></iframe>
      </div>
    </div>
  </div>
  
  <script>
    const emails = ${JSON.stringify(emails)};
    
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }
    
    function viewEmail(id) {
      const email = emails.find(e => e.id === id);
      if (!email) return;
      
      document.getElementById('detailSubject').textContent = email.subject || '(no subject)';
      document.getElementById('detailTo').textContent = email.to?.join(', ') || '';
      document.getElementById('detailFrom').textContent = email.from || '';
      document.getElementById('detailDate').textContent = new Date(email.sentAt).toLocaleString();
      
      const linksSection = document.getElementById('detailLinks');
      const linksContent = document.getElementById('detailLinksContent');
      
      if (email.links && email.links.length > 0) {
        linksContent.innerHTML = email.links.map(link => 
          '<a href="' + link + '" target="_blank">' + link + '</a>'
        ).join('');
        linksSection.style.display = 'block';
      } else {
        linksSection.style.display = 'none';
      }
      
      const frame = document.getElementById('detailFrame');
      frame.srcdoc = email.html || '<pre>' + escapeHtml(email.text) + '</pre>';
      
      document.getElementById('emailDetail').style.display = 'block';
    }
    
    function closeEmailDetail(event) {
      if (event && event.target !== document.getElementById('emailDetail')) return;
      document.getElementById('emailDetail').style.display = 'none';
    }
    
    async function clearEmails() {
      if (!confirm('Clear all captured emails?')) return;
      
      try {
        await fetch('/__yama/emails', { method: 'DELETE' });
        location.reload();
      } catch (err) {
        alert('Failed to clear emails');
      }
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEmailDetail();
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ============================================================================
// Email UI Route Handlers
// ============================================================================

export interface EmailUIRouteHandlers {
    /** GET /__yama/emails - HTML email list */
    listEmails(): Promise<{ html: string }>;

    /** GET /__yama/emails/api - JSON email list */
    listEmailsJSON(): Promise<{ emails: any[] }>;

    /** GET /__yama/emails/:id - Single email view */
    getEmail(id: string): Promise<{ email: any } | null>;

    /** GET /__yama/emails/:id/html - Raw HTML content */
    getEmailHTML(id: string): Promise<{ html: string } | null>;

    /** DELETE /__yama/emails - Clear all emails */
    clearEmails(): Promise<void>;
}

/**
 * Create email UI route handlers
 */
export function createEmailUIHandlers(): EmailUIRouteHandlers {
    return {
        async listEmails() {
            const providers = getProviders();
            if (!providers?.email) {
                return { html: generateEmailListHTML([]) };
            }

            const emails = await providers.email.getCapturedEmails();
            return { html: generateEmailListHTML(emails) };
        },

        async listEmailsJSON() {
            const providers = getProviders();
            if (!providers?.email) {
                return { emails: [] };
            }

            const emails = await providers.email.getCapturedEmails();
            return { emails };
        },

        async getEmail(id: string) {
            const providers = getProviders();
            if (!providers?.email) {
                return null;
            }

            const emails = await providers.email.getCapturedEmails();
            const email = emails.find((e: any) => e.id === id);
            return email ? { email } : null;
        },

        async getEmailHTML(id: string) {
            const providers = getProviders();
            if (!providers?.email) {
                return null;
            }

            const emails = await providers.email.getCapturedEmails();
            const email = emails.find((e: any) => e.id === id);
            return email?.html ? { html: email.html } : null;
        },

        async clearEmails() {
            const providers = getProviders();
            if (providers?.email) {
                await providers.email.clearCapturedEmails();
            }
        },
    };
}

// ============================================================================
// Express-style Route Registration Helper
// ============================================================================

/**
 * Register email UI routes on a server adapter
 */
export function registerEmailUIRoutes(
    serverAdapter: {
        registerRoute(
            server: unknown,
            method: string,
            path: string,
            handler: (request: any, reply: any) => Promise<any>
        ): void;
    },
    server: unknown,
    basePath: string = '/__yama/emails'
): void {
    const handlers = createEmailUIHandlers();

    // GET /__yama/emails - HTML email list
    serverAdapter.registerRoute(server, 'GET', basePath, async (request, reply) => {
        const result = await handlers.listEmails();
        reply.type('text/html').send(result.html);
    });

    // GET /__yama/emails/api - JSON email list
    serverAdapter.registerRoute(server, 'GET', `${basePath}/api`, async (request, reply) => {
        const result = await handlers.listEmailsJSON();
        reply.send(result);
    });

    // GET /__yama/emails/:id - Single email view (JSON)
    serverAdapter.registerRoute(server, 'GET', `${basePath}/:id`, async (request: any, reply) => {
        const id = request.params.id;

        // Skip if this is a known sub-route
        if (id === 'api') {
            return;
        }

        const result = await handlers.getEmail(id);
        if (!result) {
            reply.status(404).send({ error: 'Email not found' });
            return;
        }
        reply.send(result);
    });

    // GET /__yama/emails/:id/html - Raw HTML content
    serverAdapter.registerRoute(server, 'GET', `${basePath}/:id/html`, async (request: any, reply) => {
        const id = request.params.id;
        const result = await handlers.getEmailHTML(id);
        if (!result) {
            reply.status(404).send({ error: 'Email not found' });
            return;
        }
        reply.type('text/html').send(result.html);
    });

    // DELETE /__yama/emails - Clear all emails
    serverAdapter.registerRoute(server, 'DELETE', basePath, async (request, reply) => {
        await handlers.clearEmails();
        reply.send({ success: true, message: 'All emails cleared' });
    });
}

export { generateEmailListHTML };
