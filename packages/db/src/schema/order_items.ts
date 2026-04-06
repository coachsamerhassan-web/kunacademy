import { pgTable, integer, uuid } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { products } from './products';

export const order_items = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_id: uuid("order_id").notNull().references(() => orders.id),
  product_id: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").default(1).notNull(),
  unit_price: integer("unit_price").notNull(),
});

export type OrderItems = typeof order_items.$inferSelect;
export type NewOrderItems = typeof order_items.$inferInsert;
