import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  full_name_ar: text("full_name_ar"),
  full_name_en: text("full_name_en"),
  phone: text("phone"),
  country: text("country"),
  role: text("role").default('student'),
  status: text("status").notNull().default('active'),
  avatar_url: text("avatar_url"),
  preferred_language: text("preferred_language").default('ar'),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Profiles = typeof profiles.$inferSelect;
export type NewProfiles = typeof profiles.$inferInsert;

/**
 * profile_role_changes — immutable audit log of role transitions.
 * Populated by admin-gated mutations in /api/admin/users POST + PATCH.
 * See migration 0033.
 */
export const profileRoleChanges = pgTable("profile_role_changes", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    uuid("user_id").notNull(),
  old_role:   text("old_role"),
  new_role:   text("new_role").notNull(),
  changed_by: uuid("changed_by"),
  reason:     text("reason"),
  changed_at: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => ({
  user_idx: index("idx_profile_role_changes_user").on(t.user_id, t.changed_at),
  by_idx:   index("idx_profile_role_changes_by").on(t.changed_by, t.changed_at),
}));

export type ProfileRoleChange    = typeof profileRoleChanges.$inferSelect;
export type NewProfileRoleChange = typeof profileRoleChanges.$inferInsert;
