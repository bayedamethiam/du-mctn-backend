module.exports = {
  apps: [{
    name: 'du-mctn-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};