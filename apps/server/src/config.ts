/** Configuración por variables de entorno, validada al arrancar (falla pronto si falta algo). */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** PostgreSQL en producción. Sin ella se usa PGlite (Postgres en WASM) en memoria o en PGLITE_DIR. */
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  /** Tutor: rules (sin coste), anthropic (Claude) o hf-tgi (modelo propio servido con Text Generation Inference). */
  TUTOR_PROVIDER: z.enum(['rules', 'anthropic', 'hf-tgi']).default('rules'),
  TUTOR_MODEL: z.string().default('claude-opus-5-5'),
  ANTHROPIC_API_KEY: z.string().optional(),
  HF_TGI_URL: z.string().url().optional(),
  /** Permite el tutor con LLM sin Premium (útil en desarrollo). */
  TUTOR_FREE: z.stringbool().default(false),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  /** Binario nativo de Stockfish para análisis en servidor (p. ej. /usr/games/stockfish). */
  STOCKFISH_PATH: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  /** Intentos por minuto e IP en registro/login/invitado (protección contra fuerza bruta). */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  return parsed.data;
}

/** Configuración para tests: base de datos en memoria y secretos de prueba. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    LOG_LEVEL: 'silent',
    AUTH_RATE_LIMIT: '1000',
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
  });
}
