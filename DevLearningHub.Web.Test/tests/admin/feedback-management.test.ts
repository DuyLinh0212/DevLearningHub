import { smokeTest } from '../../support/smokeTest';

smokeTest({
  app: 'admin',
  describeName: 'Admin > Feedback Management',
  featureSlug: 'feedback-management',
  steps: [
    { route: '/admin/feedback', assertBy: 'header.content-header, .feedback-management-container, .admin-management-table' },
  ],
});
