import { importText } from '../deps.ts';

export const appJs = await importText(import.meta.url, '../static/app.js');
