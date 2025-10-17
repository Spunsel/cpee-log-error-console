import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Development server configuration
  server: {
    port: 8000,
    host: '0.0.0.0',
    open: true,
    cors: true,
    hmr: {
      overlay: true
    }
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'graph-viewer': resolve(__dirname, 'cpee_authentic_graph.html'),
        'test-viewer': resolve(__dirname, 'test_graph_viewer.html')
      },
      output: {
        // Organize built files
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Chunk splitting for better caching
    chunkSizeWarningLimit: 1000
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@core': resolve(__dirname, 'src/core'),
      '@models': resolve(__dirname, 'src/models'),
      '@config': resolve(__dirname, 'src/config'),
      '@validators': resolve(__dirname, 'src/validators'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      css: {
        charset: false
      }
    }
  },

  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
  },

  // Plugin configuration
  plugins: [
    // Custom plugin for development features
    {
      name: 'dev-middleware',
      configureServer(server) {
        // Add custom middleware for development
        server.middlewares.use('/api/health', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0'
          }));
        });
      }
    }
  ],

  // Optimization
  optimizeDeps: {
    include: [],
    exclude: []
  },

  // Preview configuration (for production preview)
  preview: {
    port: 8080,
    host: '0.0.0.0',
    open: true
  },

  // Base public path
  base: './',

  // Public directory
  publicDir: 'public'
});
