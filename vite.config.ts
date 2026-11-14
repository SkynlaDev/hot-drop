import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  // Les maquettes de design/ sont régénérées à part : elles ne doivent pas recharger le jeu en cours de partie.
  server: { watch: { ignored: ['**/design/**'] } },
  // Les copies de travail des agents (.claude/worktrees) ne doivent pas être testées en double.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
