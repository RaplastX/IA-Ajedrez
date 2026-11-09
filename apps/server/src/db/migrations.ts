/**
 * Migraciones SQL versionadas. Se aplican en orden y quedan registradas en `_migrations`.
 * Para un cambio de esquema: añade una entrada nueva (no edites las anteriores) y actualiza schema.ts.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '0001_init',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text NOT NULL UNIQUE,
  password_hash text,
  locale text NOT NULL DEFAULT 'es',
  is_guest boolean NOT NULL DEFAULT false,
  is_premium boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating real NOT NULL DEFAULT 1500,
  rd real NOT NULL DEFAULT 350,
  volatility real NOT NULL DEFAULT 0.06,
  solved integer NOT NULL DEFAULT 0,
  attempted integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS puzzles (
  id text PRIMARY KEY,
  fen text NOT NULL,
  moves text[] NOT NULL,
  rating integer NOT NULL,
  themes text[] NOT NULL,
  popularity integer
);
CREATE INDEX IF NOT EXISTS puzzles_rating_idx ON puzzles (rating);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id text NOT NULL REFERENCES puzzles(id),
  solved boolean NOT NULL,
  time_ms integer,
  rating_before real NOT NULL,
  rating_after real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS puzzle_attempts_user_idx ON puzzle_attempts (user_id, puzzle_id);

CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  white_id uuid REFERENCES users(id) ON DELETE SET NULL,
  black_id uuid REFERENCES users(id) ON DELETE SET NULL,
  white_name text NOT NULL,
  black_name text NOT NULL,
  mode text NOT NULL,
  time_control text,
  pgn text NOT NULL,
  result text NOT NULL,
  accuracy real,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_owner_idx ON games (owner_id);
CREATE INDEX IF NOT EXISTS games_white_idx ON games (white_id);
CREATE INDEX IF NOT EXISTS games_black_idx ON games (black_id);
`,
  },
];

/** Divide un script en sentencias (nuestras migraciones no usan funciones con ';' internos). */
export function splitStatements(script: string): string[] {
  return script
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
