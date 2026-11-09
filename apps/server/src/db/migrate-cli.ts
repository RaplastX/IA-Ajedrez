/** `npm run db:migrate -w @ia-ajedrez/server`: aplica migraciones y carga los puzzles. */
import { loadConfig } from '../config.js';
import { connectDatabase, migrate } from './client.js';
import { seedPuzzles } from './seed.js';

const config = loadConfig();
const database = await connectDatabase(config);
const applied = await migrate(database.db);
const seeded = await seedPuzzles(database.db);
console.log(`Migraciones aplicadas: ${applied.join(', ') || 'ninguna'} · puzzles cargados: ${seeded}`);
await database.close();
