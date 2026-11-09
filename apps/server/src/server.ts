/** Punto de entrada del servidor. */
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();

// Observabilidad opcional: si hay SENTRY_DSN y el paquete @sentry/node está instalado.
if (config.SENTRY_DSN) {
  const moduleName = '@sentry/node';
  try {
    const Sentry = (await import(moduleName)) as { init: (o: Record<string, unknown>) => void };
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0.1 });
  } catch {
    console.warn('SENTRY_DSN definido pero @sentry/node no está instalado');
  }
}

const { app } = await buildApp(config);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Cerrando servidor');
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: config.HOST });
