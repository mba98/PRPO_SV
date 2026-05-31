module.exports = {
  apps: [
    {
      name: 'procurement-portal',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 5420',
      env: {
        NODE_ENV: 'production',
        PORT: '5420',
        // For internal HTTP (no TLS), set in .env.local: COOKIE_SECURE=false
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
