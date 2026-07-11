import { smokeTest } from '../../support/smokeTest';

smokeTest({
  app: 'user',
  describeName: 'User > Feedback',
  featureSlug: 'feedback',
  steps: [
    { route: '/feedback', assertBy: 'header.content-header, .feedback-container, form' },
  ],
});
