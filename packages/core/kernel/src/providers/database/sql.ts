/**
 * SQL Template Tag Type
 */

export type SQLTemplateTag = (
    strings: TemplateStringsArray,
    ...values: unknown[]
) => { sql: string; params: unknown[] };
