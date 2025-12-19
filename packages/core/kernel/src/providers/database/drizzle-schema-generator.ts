import type { DatabaseIR, TableIR, ColumnIR, IndexIR } from "./ir.js";

/**
 * Generate Drizzle schema code from Database IR
 */
export function generateDrizzleSchemaFromIR(ir: DatabaseIR): string {
    const header = `// This file is auto-generated from Database IR
// Do not edit manually - your changes will be overwritten

import { pgTable, index, uuid, varchar, text, integer, bigint, boolean, timestamp, jsonb, decimal, date, time } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";\n\n`;

    const tableDefinitions: string[] = [];
    const typeExports: string[] = [];

    for (const table of ir.tables) {
        const tableCode = generateDrizzleTable(table);
        tableDefinitions.push(tableCode);

        const tableName = table.entityName;
        const tableVar = table.entityName.toLowerCase();
        typeExports.push(`export type ${tableName}Entity = InferSelectModel<typeof ${tableVar}>;`);
        typeExports.push(`export type New${tableName}Entity = InferInsertModel<typeof ${tableVar}>;`);
    }

    const typeExportsSection = typeExports.length > 0 ? `\n\n${typeExports.join("\n")}\n` : "";

    return header + tableDefinitions.join("\n\n") + typeExportsSection;
}

function generateDrizzleTable(table: TableIR): string {
    const columns: string[] = [];
    const indexes: string[] = [];

    for (const column of table.columns) {
        const columnDef = generateDrizzleColumn(column);
        columns.push(`  ${column.fieldName}: ${columnDef}`);
    }

    const tableVar = table.entityName.toLowerCase();

    const tableDef = `export const ${tableVar} = pgTable("${table.name}", {
${columns.join(",\n")}
});`;

    for (const idx of table.indexes) {
        const idxName = idx.name || `${table.name}_${idx.columns.join("_")}_idx`;
        const fieldsRef = idx.columns.map(c => `${tableVar}.${c}`).join(", ");
        const uniqueModifier = idx.unique ? ".unique()" : "";
        indexes.push(`export const ${idxName} = index("${idxName}").on(${fieldsRef})${uniqueModifier};`);
    }

    const indexExports = indexes.length > 0 ? `\n\n${indexes.join("\n")}` : "";

    return `${tableDef}${indexExports}`;
}

function generateDrizzleColumn(column: ColumnIR): string {
    let columnCode = "";

    switch (column.type) {
        case "uuid":
            columnCode = `uuid("${column.name}")`;
            if (column.generated) columnCode += ".defaultRandom()";
            break;
        case "varchar":
            columnCode = `varchar("${column.name}"${column.length ? `, { length: ${column.length} }` : ""})`;
            break;
        case "text":
            columnCode = `text("${column.name}")`;
            break;
        case "integer":
            columnCode = `integer("${column.name}")`;
            break;
        case "bigint":
            columnCode = `bigint("${column.name}", { mode: "bigint" })`;
            break;
        case "boolean":
            columnCode = `boolean("${column.name}")`;
            break;
        case "timestamp":
            columnCode = `timestamp("${column.name}")`;
            if (column.default === "now()" || column.default === "now") {
                columnCode += ".defaultNow()";
            }
            break;
        case "timestamptz":
            columnCode = `timestamp("${column.name}", { withTimezone: true })`;
            if (column.default === "now()" || column.default === "now") {
                columnCode += ".defaultNow()";
            }
            break;
        case "date":
            columnCode = `date("${column.name}")`;
            break;
        case "time":
            columnCode = `time("${column.name}")`;
            break;
        case "jsonb":
            columnCode = `jsonb("${column.name}")`;
            break;
        case "decimal":
            columnCode = `decimal("${column.name}"${column.precision ? `, { precision: ${column.precision}, scale: ${column.scale} }` : ""})`;
            break;
        default:
            columnCode = `text("${column.name}")`;
    }

    if (column.primary) columnCode += ".primaryKey()";
    if (column.nullable === false) columnCode += ".notNull()";
    if (column.unique) columnCode += ".unique()";

    if (column.default !== undefined && column.type !== "timestamp" && column.type !== "timestamptz" && column.default !== "now()" && column.default !== "now") {
        columnCode += `.default(${JSON.stringify(column.default)})`;
    }

    if (column.references) {
        columnCode += `.references(() => ${column.references.table}.${column.references.column})`;
        if (column.references.onDelete) {
            columnCode += `.onDelete("${column.references.onDelete}")`;
        }
    }

    return columnCode;
}
