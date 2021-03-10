module.exports = {
  verbose: false,
  suites: ['test/*.html'],
  plugins: {
    local: {
      browsers: ['chrome']
    },
    istanbul: {
      dir: './coverage',
      reporters: ['text-summary', 'lcov'],
      include: ['/*.html', '**/bah-edhr-integration.js'],
      exclude: []
    }
  }
};
