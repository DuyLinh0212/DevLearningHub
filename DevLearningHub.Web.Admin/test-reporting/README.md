# Jasmine/Karma reporting

Run once with a JUnit XML report:

```powershell
npm run test:report
```

Report output:

```text
test-reports/jasmine-karma/junit-results.xml
```

Run once with JUnit XML and a Markdown summary of failed features:

```powershell
npm run test:report:summary
```

Summary output:

```text
test-reports/jasmine-karma/summary.md
```

Run once with JUnit and coverage:

```powershell
npm run test:coverage
```

Coverage output:

```text
coverage/DevLearningHub.Web/index.html
```
