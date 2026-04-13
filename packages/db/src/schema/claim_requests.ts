import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { communityMembers } from './community_members';
import { profiles } from './profiles';

export const claimRequests = pgTable("claim_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  member_id: uuid("member_id").notNull().references(() => communityMembers.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  message: text("message"),
  status: text("status").notNull().default('pending'),  // pending, approved, rejected
  reviewed_by: uuid("reviewed_by").references(() => profiles.id),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type ClaimRequest = typeof claimRequests.$inferSelect;
export type NewClaimRequest = typeof claimRequests.$inferInsert;
