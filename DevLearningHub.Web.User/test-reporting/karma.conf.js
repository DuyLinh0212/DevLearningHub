module.exports = function (config) {
  config.set({
    basePath: '..',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('karma-junit-reporter'),
    ],
    client: {
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: 'coverage/DevLearningHub.Web',
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    junitReporter: {
      outputDir: 'test-reports/jasmine-karma',
      outputFile: 'junit-results.xml',
      suite: 'DevLearningHub.Web',
      useBrowserName: false,
    },
    reporters: ['progress', 'kjhtml', 'junit'],
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
