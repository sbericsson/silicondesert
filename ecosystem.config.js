module.exports = {
  apps: [
    {
      name: 'silicon',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/Phoenix'
      }
    }
  ]
}
