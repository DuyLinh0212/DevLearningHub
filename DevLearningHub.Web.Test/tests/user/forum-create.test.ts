import { smokeTest } from '../../support/smokeTest';

// Kiểm tra trang Tạo bài viết diễn đàn tải được
smokeTest({
  app: 'user',
  describeName: 'User > Forum Create Post',
  featureSlug: 'forum-create',
  steps: [
    { route: '/forum/create', assertBy: 'header.content-header' },
  ],
});
