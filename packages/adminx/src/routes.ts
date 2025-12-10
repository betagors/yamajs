import { escapeHtml, layout, renderKeyValueTable } from "./templates.js";
import type { AdminXResolvedConfig, AdminXRouteArgs } from "./types.js";
import type { EntityDefinition, EntityFieldDefinition, YamaEntities, YamaSchemas } from "@betagors/yama-core";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface AdminHandlerContext {
  request: any;
  reply: any;
  config: AdminXResolvedConfig;
  entities?: YamaEntities;
  schemas?: YamaSchemas;
  repositories?: Record<string, any>;
  projectDir: string;
}

const DEFAULT_DEV_PASSWORD = "dev-adminx";

export function registerAdminXRoutes(
  config: AdminXResolvedConfig,
  args: AdminXRouteArgs
): void {
  if (!config.enabled) {
    return;
  }

  if (args.nodeEnv === "production" && !config.allowInProduction) {
    return;
  }

  const basePath = config.path;
  const serverAdapter = args.serverAdapter;
  const server = args.server;

  const register = (
    method: string,
    path: string,
    handler: (ctx: AdminHandlerContext) => Promise<void> | void
  ) => {
    serverAdapter.registerRoute(server, method, path, async (request: any, reply: any) => {
      const context: AdminHandlerContext = {
        request,
        reply,
        config,
        entities: args.entities,
        schemas: args.schemas,
        repositories: args.repositories,
        projectDir: args.configDir || args.projectDir,
      };
      if (!authorize(context)) {
        unauthorized(context);
        return;
      }
      await handler(context);
    });
  };

  // Dashboard
  register("GET", basePath, async (ctx) => {
    const crudEntities = getCrudEntities(ctx.entities);
    const html = layout({
      title: "AdminX · Dashboard",
      basePath,
      currentPath: basePath,
      content: `
        <h2>Overview</h2>
        <div class="grid">
          <div class="card">
            <div class="muted">Entities (CRUD-enabled)</div>
            <div style="font-size:24px;font-weight:700;">${crudEntities.length}</div>
            <div class="actions" style="margin-top:10px;">
              <a class="nav-link" href="${basePath}/entities">View entities</a>
            </div>
          </div>
          <div class="card">
            <div class="muted">Schemas</div>
            <div style="font-size:24px;font-weight:700;">${Object.keys(ctx.schemas || {}).length}</div>
            <div class="actions" style="margin-top:10px;">
              <a class="nav-link" href="${basePath}/schemas">View schemas</a>
            </div>
          </div>
          <div class="card">
            <div class="muted">Endpoints</div>
            <div style="font-size:24px;font-weight:700;">${countEndpoints(args.config)}</div>
            <div class="actions" style="margin-top:10px;">
              <a class="nav-link" href="${basePath}/endpoints">View endpoints</a>
            </div>
          </div>
          <div class="card">
            <div class="muted">Migrations</div>
            <div style="font-size:24px;font-weight:700;">Status</div>
            <div class="actions" style="margin-top:10px;">
              <a class="nav-link" href="${basePath}/migrations">View history</a>
            </div>
          </div>
        </div>
        <div style="margin-top:18px;">
          <h3>Entities</h3>
          ${crudEntities.length === 0 ? `<div class="empty">No CRUD-enabled entities found.</div>` : renderEntityBadges(crudEntities, basePath)}
        </div>
      `,
    });
    ctx.reply.type("text/html").send(html);
  });

  // Entities index
  register("GET", `${basePath}/entities`, async (ctx) => {
    const crudEntities = getCrudEntities(ctx.entities);
    const html = layout({
      title: "AdminX · Entities",
      basePath,
      currentPath: `${basePath}/entities`,
      content: crudEntities.length === 0
        ? `<div class="empty">No CRUD-enabled entities.</div>`
        : `
          <h2>Entities</h2>
          ${renderEntityBadges(crudEntities, basePath)}
        `,
    });
    ctx.reply.type("text/html").send(html);
  });

  // Entity list
  register("GET", `${basePath}/entities/:entity`, async (ctx) => {
    const { entity } = ctx.request.params || {};
    const entityDef = getEntityDef(ctx.entities, entity);
    if (!entityDef) {
      return sendNotFound(ctx.reply, basePath, `Entity "${escapeHtml(String(entity))}" not found or not CRUD-enabled.`);
    }
    const repo = ctx.repositories?.[entity];
    const { limit, offset, search } = ctx.request.query || {};
    const parsedLimit = Number(limit) || 25;
    const parsedOffset = Number(offset) || 0;
    let rows: any[] = [];
    let errorMsg: string | null = null;

    if (repo && typeof repo.findAll === "function") {
      try {
        const query: any = { limit: parsedLimit, offset: parsedOffset };
        if (search && typeof search === "string") {
          query.search = search;
        }
        const result = await repo.findAll(query);
        rows = Array.isArray(result) ? result : result?.items || [];
      } catch (error) {
        errorMsg = error instanceof Error ? error.message : String(error);
      }
    } else {
      errorMsg = "Repository not available. Run `yama generate` to generate repositories.";
    }

    const html = layout({
      title: `AdminX · ${entity} list`,
      basePath,
      currentPath: `${basePath}/entities`,
      message: errorMsg || undefined,
      content: `
        <h2>${escapeHtml(String(entity))}</h2>
        <div class="actions">
          <a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entity)}/new">+ New ${escapeHtml(String(entity))}</a>
        </div>
        ${rows.length === 0 ? `<div class="empty">No records found.</div>` : renderKeyValueTable(`${entity} list`, rows)}
      `,
    });
    ctx.reply.type("text/html").send(html);
  });

  // New entity form
  register("GET", `${basePath}/entities/:entity/new`, async (ctx) => {
    const { entity } = ctx.request.params || {};
    const entityDef = getEntityDef(ctx.entities, entity);
    if (!entityDef) {
      return sendNotFound(ctx.reply, basePath, `Entity "${escapeHtml(String(entity))}" not found or not CRUD-enabled.`);
    }
    const html = layout({
      title: `AdminX · New ${entity}`,
      basePath,
      currentPath: `${basePath}/entities`,
      content: renderEntityForm(basePath, entity, entityDef, "create"),
    });
    ctx.reply.type("text/html").send(html);
  });

  // Create entity
  register("POST", `${basePath}/entities/:entity`, async (ctx) => {
    const { entity } = ctx.request.params || {};
    const entityDef = getEntityDef(ctx.entities, entity);
    if (!entityDef) {
      return sendNotFound(ctx.reply, basePath, `Entity "${escapeHtml(String(entity))}" not found or not CRUD-enabled.`);
    }
    const repo = ctx.repositories?.[entity];
    if (!repo || typeof repo.create !== "function") {
      return sendNotFound(ctx.reply, basePath, `Repository for "${entity}" not available. Run 'yama generate'.`);
    }
    const payload = buildEntityPayload(ctx.request.body || {}, entityDef);
    try {
      await repo.create(payload);
      ctx.reply.type("text/html").send(
        layout({
          title: `Created ${entity}`,
          basePath,
          currentPath: `${basePath}/entities`,
          message: `${escapeHtml(String(entity))} created successfully.`,
          content: `<a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entity)}">Back to list</a>`,
        })
      );
    } catch (error) {
      ctx.reply.type("text/html").send(
        layout({
          title: `Create ${entity} failed`,
          basePath,
          currentPath: `${basePath}/entities`,
          message: `Failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
          content: renderEntityForm(basePath, entity, entityDef, "create", ctx.request.body || {}),
        })
      );
    }
  });

  // Edit form
  register("GET", `${basePath}/entities/:entity/:id`, async (ctx) => {
    const { entity, id } = ctx.request.params || {};
    const entityDef = getEntityDef(ctx.entities, entity);
    if (!entityDef) {
      return sendNotFound(ctx.reply, basePath, `Entity "${escapeHtml(String(entity))}" not found or not CRUD-enabled.`);
    }
    const repo = ctx.repositories?.[entity];
    let record: any = null;
    if (repo && typeof repo.findById === "function") {
      try {
        record = await repo.findById(id);
      } catch {
        // ignore
      }
    }
    if (!record) {
      return sendNotFound(ctx.reply, basePath, `${escapeHtml(String(entity))} not found.`);
    }
    ctx.reply.type("text/html").send(
      layout({
        title: `Edit ${entity}`,
        basePath,
        currentPath: `${basePath}/entities`,
        content: renderEntityForm(basePath, entity, entityDef, "update", record),
      })
    );
  });

  // Update entity
  register("POST", `${basePath}/entities/:entity/:id`, async (ctx) => {
    const { entity, id } = ctx.request.params || {};
    const entityDef = getEntityDef(ctx.entities, entity);
    if (!entityDef) {
      return sendNotFound(ctx.reply, basePath, `Entity "${escapeHtml(String(entity))}" not found or not CRUD-enabled.`);
    }
    const repo = ctx.repositories?.[entity];
    if (!repo || typeof repo.update !== "function") {
      return sendNotFound(ctx.reply, basePath, `Repository for "${entity}" not available. Run 'yama generate'.`);
    }
    const payload = buildEntityPayload(ctx.request.body || {}, entityDef, true);
    try {
      await repo.update(id, payload);
      ctx.reply.type("text/html").send(
        layout({
          title: `Updated ${entity}`,
          basePath,
          currentPath: `${basePath}/entities`,
          message: `${escapeHtml(String(entity))} updated successfully.`,
          content: `<a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entity)}">Back to list</a>`,
        })
      );
    } catch (error) {
      ctx.reply.type("text/html").send(
        layout({
          title: `Update ${entity} failed`,
          basePath,
          currentPath: `${basePath}/entities`,
          message: `Failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
          content: renderEntityForm(basePath, entity, entityDef, "update", ctx.request.body || {}),
        })
      );
    }
  });

  // Delete
  register("POST", `${basePath}/entities/:entity/:id/delete`, async (ctx) => {
    const { entity, id } = ctx.request.params || {};
    const repo = ctx.repositories?.[entity];
    if (repo && typeof repo.delete === "function") {
      try {
        await repo.delete(id);
      } catch (error) {
        ctx.reply.type("text/html").send(
          layout({
            title: `Delete ${entity} failed`,
            basePath,
            currentPath: `${basePath}/entities`,
            message: `Failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
            content: `<a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entity)}">Back</a>`,
          })
        );
        return;
      }
    }
    ctx.reply.type("text/html").send(
      layout({
        title: `Deleted ${entity}`,
        basePath,
        currentPath: `${basePath}/entities`,
        message: `${escapeHtml(String(entity))} deleted.`,
        content: `<a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entity)}">Back to list</a>`,
      })
    );
  });

  // Schemas (read-only)
  register("GET", `${basePath}/schemas`, async (ctx) => {
    const schemas = ctx.schemas || {};
    const entityEntries = Object.entries(ctx.entities || {});
    const html = layout({
      title: "AdminX · Schemas",
      basePath,
      currentPath: `${basePath}/schemas`,
      content: `
        <h2>Schemas</h2>
        ${entityEntries.length === 0 ? `<div class="empty">No entities/schemas defined.</div>` : renderSchemaCards(entityEntries)}
      `,
    });
    ctx.reply.type("text/html").send(html);
  });

  // Endpoints (read-only)
  register("GET", `${basePath}/endpoints`, async (ctx) => {
    const endpoints = collectEndpoints(args.config);
    const html = layout({
      title: "AdminX · Endpoints",
      basePath,
      currentPath: `${basePath}/endpoints`,
      content: endpoints.length === 0
        ? `<div class="empty">No endpoints configured.</div>`
        : renderKeyValueTable("Endpoints", endpoints),
    });
    ctx.reply.type("text/html").send(html);
  });

  // Migrations (read-only)
  register("GET", `${basePath}/migrations`, async (ctx) => {
    const history = loadVersionHistorySafe(ctx.projectDir);
    const html = layout({
      title: "AdminX · Migrations",
      basePath,
      currentPath: `${basePath}/migrations`,
      content: history
        ? `
            <h2>Schema Versions</h2>
            <div class="card">
              <div class="muted">Current version</div>
              <div style="font-size:20px;font-weight:700;">${escapeHtml(history.currentVersion)}</div>
              <div class="muted" style="font-size:12px;margin-top:6px;">Updated: ${escapeHtml(history.updatedAt)}</div>
            </div>
            <div style="margin-top:14px;">
              ${renderKeyValueTable("History", history.versions.map((v) => ({
                version: v.version,
                appliedAt: v.appliedAt,
                changedEntities: (v.changedEntities || []).join(", "),
              })))}
            </div>
          `
        : `<div class="empty">No schema version history found. Run migrations to populate history.</div>`,
    });
    ctx.reply.type("text/html").send(html);
  });
}

function authorize(ctx: AdminHandlerContext): boolean {
  const { config, request } = ctx;
  if (!config.requireAuth) {
    return true;
  }

  // In production, if explicitly allowed, require an explicit password (no default).
  const explicitRequired =
    config.nodeEnv === "production" && config.allowInProduction === true;
  const requiredToken = config.devPassword || (explicitRequired ? "" : DEFAULT_DEV_PASSWORD);

  if (!requiredToken) {
    // Refuse access if running in prod and no explicit password is set.
    return false;
  }

  const authHeader = (request.headers?.authorization as string | undefined) || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const headerToken =
    bearer ||
    (request.headers?.["x-adminx-token"] as string | undefined) ||
    (request.headers?.["x-adminx-key"] as string | undefined);
  const queryToken = (request.query?.adminx_token as string | undefined) || "";
  const cookieToken = parseCookieToken(request.headers?.cookie as string | undefined);
  const token = headerToken || queryToken || cookieToken;

  return token === requiredToken;
}

function unauthorized(ctx: AdminHandlerContext): void {
  const { reply, config } = ctx;
  const tokenHint = config.devPassword || (config.allowInProduction ? "<set ADMINX_PASSWORD>" : DEFAULT_DEV_PASSWORD);
  reply
    .status(401)
    .type("text/html")
    .send(
      layout({
        title: "Unauthorized",
        basePath: config.path,
        content: `
          <h2>Unauthorized</h2>
          <div class="muted" style="margin-bottom:10px;">
            AdminX requires an access token.
          </div>
          <div class="card">
            <div class="muted">Send a header</div>
            <code>Authorization: Bearer ${escapeHtml(tokenHint)}</code>
            <div class="muted" style="margin-top:10px;">You can set a custom token with ADMINX_PASSWORD or YAMA_ADMINX_PASSWORD.</div>
            ${
              config.nodeEnv === "production" && config.allowInProduction
                ? `<div class="muted" style="margin-top:10px;color:#f87171;">Production requires an explicit ADMINX_PASSWORD.</div>`
                : ""
            }
          </div>
        `,
      })
    );
}

function sendNotFound(reply: any, basePath: string, message: string): void {
  reply
    .status(404)
    .type("text/html")
    .send(
      layout({
        title: "Not found",
        basePath,
        content: `<div class="empty">${escapeHtml(message)}</div>`,
      })
    );
}

function getCrudEntities(entities?: YamaEntities): Array<[string, EntityDefinition]> {
  if (!entities) return [];
  return Object.entries(entities).filter(([, def]) => {
    if (!def) return false;
    const crud = (def as any).crud;
    if (crud === undefined) return false;
    if (crud === true) return true;
    if (typeof crud === "object") {
      return crud.enabled !== false;
    }
    return false;
  }) as Array<[string, EntityDefinition]>;
}

function getEntityDef(entities: YamaEntities | undefined, name: string | undefined): EntityDefinition | null {
  if (!entities || !name) return null;
  const def = entities[name];
  if (!def) return null;
  const crud = (def as any).crud;
  if (crud === undefined) return null;
  if (crud === true) return def as EntityDefinition;
  if (typeof crud === "object" && crud.enabled !== false) return def as EntityDefinition;
  return null;
}

function renderEntityBadges(crudEntities: Array<[string, EntityDefinition]>, basePath: string): string {
  return `
    <div class="grid">
      ${crudEntities
        .map(
          ([name, def]) => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-weight:700;">${escapeHtml(name)}</div>
              <span class="badge">CRUD</span>
            </div>
            <div class="muted" style="margin-top:6px;font-size:12px;">
              ${Object.keys((def as any).fields || {}).length} fields
            </div>
            <div class="actions" style="margin-top:10px;">
              <a class="nav-link" href="${basePath}/entities/${encodeURIComponent(name)}">Open</a>
              <a class="nav-link" href="${basePath}/entities/${encodeURIComponent(name)}/new">New</a>
            </div>
          </div>`
        )
        .join("")}
    </div>
  `;
}

function renderEntityForm(
  basePath: string,
  entityName: string,
  entityDef: EntityDefinition,
  mode: "create" | "update",
  values: Record<string, unknown> = {}
): string {
  const fields = Object.entries((entityDef as any).fields || {}) as Array<[string, EntityFieldDefinition]>;
  const filtered = fields.filter(([name, field]) => {
    if ((field as any).generated) return false;
    if (mode === "create" && (field as any).primary && (field as any).generated !== false) return false;
    return true;
  });

  const inputs = filtered
    .map(([name, field]) => renderField(name, field, values[name]))
    .join("");

  const action =
    mode === "create"
      ? `${basePath}/entities/${encodeURIComponent(entityName)}`
      : `${basePath}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(String(values.id ?? ""))}`;

  return `
    <h2>${mode === "create" ? "Create" : "Edit"} ${escapeHtml(entityName)}</h2>
    <form method="POST" action="${action}">
      ${inputs || `<div class="empty">No editable fields.</div>`}
      <div class="actions">
        <button type="submit">${mode === "create" ? "Create" : "Update"}</button>
        <a class="nav-link" href="${basePath}/entities/${encodeURIComponent(entityName)}">Cancel</a>
        ${
          mode === "update" && values.id
            ? `<button class="danger" formaction="${basePath}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(String(values.id))}/delete" formmethod="POST">Delete</button>`
            : ""
        }
      </div>
    </form>
  `;
}

function renderField(name: string, field: EntityFieldDefinition, value: unknown): string {
  const type = (field as any).type || "string";
  const required = (field as any).required === true || String((field as any).type || "").endsWith("!");
  const label = `${escapeHtml(name)}${required ? " *" : ""}`;
  const val = value ?? (field as any).default;

  if (type === "boolean") {
    const checked = val === true ? "checked" : "";
    return `
      <label>
        ${label}
        <input type="checkbox" name="${escapeHtml(name)}" value="true" ${checked} />
      </label>
    `;
  }

  if ((field as any).enum && Array.isArray((field as any).enum)) {
    const options = (field as any).enum
      .map((opt: string) => `<option value="${escapeHtml(opt)}" ${opt === val ? "selected" : ""}>${escapeHtml(opt)}</option>`)
      .join("");
    return `
      <label>
        ${label}
        <select name="${escapeHtml(name)}">
          ${options}
        </select>
      </label>
    `;
  }

  const inputType =
    type === "number" || type === "integer" ? "number" : type === "timestamp" || type === "date-time" ? "datetime-local" : "text";

  return `
    <label>
      ${label}
      <input type="${inputType}" name="${escapeHtml(name)}" value="${val !== undefined && val !== null ? escapeHtml(String(val)) : ""}" />
    </label>
  `;
}

function buildEntityPayload(
  body: Record<string, unknown>,
  entityDef: EntityDefinition,
  isUpdate = false
): Record<string, unknown> {
  const fields = Object.entries((entityDef as any).fields || {}) as Array<[string, EntityFieldDefinition]>;
  const payload: Record<string, unknown> = {};

  for (const [name, field] of fields) {
    if ((field as any).generated) continue;
    if (!isUpdate && (field as any).primary && (field as any).generated !== false) continue;

    const raw = (body as any)?.[name];
    if (raw === undefined) continue;
    payload[name] = coerceValue(raw, field);
  }

  return payload;
}

function coerceValue(value: unknown, field: EntityFieldDefinition): unknown {
  const type = (field as any).type || "string";
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (type === "number" || type === "integer") {
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
  }
  if (type === "boolean") {
    if (typeof value === "string") {
      return value === "true" || value === "on" || value === "1";
    }
    return Boolean(value);
  }
  return value;
}

function renderSchemaCards(entries: Array<[string, EntityDefinition]>): string {
  return `
    <div class="grid">
      ${entries
        .map(([name, def]) => {
          const fields = Object.entries((def as any).fields || {});
          return `
            <div class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-weight:700;">${escapeHtml(name)}</div>
                <span class="badge">${fields.length} fields</span>
              </div>
              <div style="margin-top:8px;">
                ${fields
                  .map(
                    ([fname, fdef]) => `
                      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,0.06);">
                        <span>${escapeHtml(fname)}</span>
                        <span class="muted">${escapeHtml(String((fdef as any).type || ""))}</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function countEndpoints(config: Record<string, unknown>): number {
  const endpoints = collectEndpoints(config);
  return endpoints.length;
}

function collectEndpoints(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const endpoints: Array<Record<string, unknown>> = [];
  const direct = (config as any)?.endpoints;
  if (Array.isArray(direct)) {
    for (const ep of direct) {
      endpoints.push({
        path: ep.path,
        method: ep.method,
        handler: ep.handler || ep.name || "",
      });
    }
  }

  const apis = (config as any)?.apis?.rest;
  if (apis && apis.endpoints && Array.isArray(apis.endpoints)) {
    for (const ep of apis.endpoints) {
      endpoints.push({
        path: ep.path,
        method: ep.method,
        handler: ep.handler || ep.name || "",
      });
    }
  }

  return endpoints;
}

function loadVersionHistorySafe(projectDir: string): {
  currentVersion: string;
  currentHash: string;
  versions: Array<{
    version: string;
    hash?: string;
    changedEntities?: string[];
    appliedAt: string;
  }>;
  updatedAt: string;
} | null {
  try {
    const historyPath = join(projectDir, ".yama", "versions", "history.json");
    if (!existsSync(historyPath)) {
      return null;
    }
    const raw = readFileSync(historyPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed?.versions) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookieToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.toLowerCase().startsWith("adminx_token=")) {
      return decodeURIComponent(part.split("=")[1] || "");
    }
  }
  return undefined;
}

