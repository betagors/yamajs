// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const todo = pgTable(`todos`, {
  id: uuid(`id`).defaultRandom().primaryKey(),
  title: varchar(`title`, { length: 255 }).notNull(),
  completed: boolean(`completed`).default(false),
  createdAt: timestamp(`created_at`).defaultNow()
});

export const todo_completed_idx = index(`todos_completed_idx`).on(todo.completed);
