/** Esquema de base de datos (PostgreSQL) con Drizzle ORM. Debe coincidir con migrations.ts. */
import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  displayName: text('display_name').notNull().unique(),
  passwordHash: text('password_hash'),
  locale: text('locale').notNull().default('es'),
  isGuest: boolean('is_guest').notNull().default(false),
  isPremium: boolean('is_premium').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id'),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ratings = pgTable('ratings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  rating: real('rating').notNull().default(1500),
  rd: real('rd').notNull().default(350),
  volatility: real('volatility').notNull().default(0.06),
  solved: integer('solved').notNull().default(0),
  attempted: integer('attempted').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const progress = pgTable('progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  xp: integer('xp').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const puzzles = pgTable(
  'puzzles',
  {
    id: text('id').primaryKey(),
    fen: text('fen').notNull(),
    moves: text('moves').array().notNull(),
    rating: integer('rating').notNull(),
    themes: text('themes').array().notNull(),
    popularity: integer('popularity'),
  },
  (t) => [index('puzzles_rating_idx').on(t.rating)],
);

export const puzzleAttempts = pgTable(
  'puzzle_attempts',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    puzzleId: text('puzzle_id')
      .notNull()
      .references(() => puzzles.id),
    solved: boolean('solved').notNull(),
    timeMs: integer('time_ms'),
    ratingBefore: real('rating_before').notNull(),
    ratingAfter: real('rating_after').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('puzzle_attempts_user_idx').on(t.userId, t.puzzleId)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    whiteId: uuid('white_id').references(() => users.id, { onDelete: 'set null' }),
    blackId: uuid('black_id').references(() => users.id, { onDelete: 'set null' }),
    whiteName: text('white_name').notNull(),
    blackName: text('black_name').notNull(),
    mode: text('mode').notNull(),
    timeControl: text('time_control'),
    pgn: text('pgn').notNull(),
    result: text('result').notNull(),
    accuracy: real('accuracy'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('games_owner_idx').on(t.ownerId), index('games_white_idx').on(t.whiteId), index('games_black_idx').on(t.blackId)],
);

export const schema = { users, ratings, progress, puzzles, puzzleAttempts, games };
