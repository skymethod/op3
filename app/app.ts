import { initShow } from './show.ts';
import { initStats } from './stats.ts';

const { pathname } = document.location;
if (pathname.startsWith('/show/')) await initShow();
if (pathname === '/stats') initStats();
