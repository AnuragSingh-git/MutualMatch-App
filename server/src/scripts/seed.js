import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });
const { resetState } = await import('../../store.js');
await resetState();
console.log(`Demo state reset in ${process.env.MONGODB_URI ? 'MongoDB' : 'JSON'} storage.`);
