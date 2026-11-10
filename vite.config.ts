import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  // Les maquettes de design/ sont régénérées à part : elles ne doivent pas recharger le jeu en cours de partie.
  server: { watch: { ignored: ['**/design/**'] } },
});
