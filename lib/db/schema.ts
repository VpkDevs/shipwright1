import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  github_id: text("github_id").unique().notNull(),
  github_username: text("github_username").notNull(),
  email: text("email"),
  avatar_url: text("avatar_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    github_repo_id: text("github_repo_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    framework: text("framework"),
    risk_score: integer("risk_score"),
    last_analyzed_at: timestamp("last_analyzed_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("repositories_user_github_repo_unique").on(table.user_id, table.github_repo_id),
  ]
);

export const pull_requests = pgTable("pull_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  repo_id: uuid("repo_id")
    .references(() => repositories.id)
    .notNull(),
  pr_number: integer("pr_number"),
  pr_url: text("pr_url"),
  branch_name: text("branch_name").notNull(),
  status: text("status").default("open").notNull(),
  generated_files: jsonb("generated_files").$type<string[]>().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  repo_id: uuid("repo_id")
    .references(() => repositories.id)
    .notNull(),
  provider: text("provider").notNull(),
  deploy_url: text("deploy_url"),
  status: text("status").default("pending").notNull(),
  deployed_at: timestamp("deployed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const stripe_events = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").default("processing").notNull(),
  error: text("error"),
  processed_at: timestamp("processed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(repositories),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, {
    fields: [repositories.user_id],
    references: [users.id],
  }),
  pull_requests: many(pull_requests),
  deployments: many(deployments),
}));

export const pull_requestsRelations = relations(pull_requests, ({ one }) => ({
  repository: one(repositories, {
    fields: [pull_requests.repo_id],
    references: [repositories.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  repository: one(repositories, {
    fields: [deployments.repo_id],
    references: [repositories.id],
  }),
}));
