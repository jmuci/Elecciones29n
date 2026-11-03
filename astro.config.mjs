import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    // Fija el tsconfig del proyecto. Sin esto, Vite 8 también carga los tsconfig.json de
    // directorios superiores; en un worktree anidado (.claude/worktrees/…) el del checkout
    // principal no resuelve su `extends` si allí no hay node_modules, y el build falla.
    tsconfig: './tsconfig.json',
  },
});
