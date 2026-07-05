-- DevLearningHub permission catalog sync.
-- Idempotent upsert of the full 33-permission catalog (plan section 8) plus
-- roadmap:review, which the moderation queue relies on. Safe to run repeatedly
-- and after the base seed / earlier migrations: it only inserts missing rows
-- and corrects description/module drift. No schema changes.

DECLARE @Permissions TABLE (Name nvarchar(100), Description nvarchar(200), Module nvarchar(50));
INSERT INTO @Permissions (Name, Description, Module) VALUES
-- Moderation / Review
('problem_bank:review', N'Duyệt ngân hàng bài tập', 'problem_bank'),
('post:review',         N'Duyệt bài viết',           'post'),
('quiz:review',         N'Duyệt bộ đề',              'quiz'),
('problem:review',      N'Duyệt bài tập lập trình',  'problem'),
('roadmap:review',      N'Duyệt lộ trình',           'roadmap'),
-- Post
('post:create',      N'Tạo bài viết',        'post'),
('post:edit_own',    N'Sửa bài viết của mình', 'post'),
('post:edit_any',    N'Sửa bất kỳ bài viết',  'post'),
('post:delete_any',  N'Xóa bất kỳ bài viết',  'post'),
('post:hide',        N'Ẩn bài viết',          'post'),
('post:hide_any',    N'Ẩn / hiện lại bài viết', 'post'),
-- Comment
('comment:create', N'Viết bình luận',  'comment'),
('comment:hide',   N'Ẩn bình luận',    'comment'),
('comment:delete', N'Xóa bình luận',   'comment'),
-- User
('user:view_all',  N'Xem danh sách người dùng', 'user'),
('user:ban',       N'Khóa tài khoản người dùng', 'user'),
('user:edit_role', N'Gán vai trò cho người dùng', 'user'),
-- Problem
('problem:create', N'Tạo bài tập lập trình', 'problem'),
('problem:edit',   N'Sửa bài tập lập trình', 'problem'),
-- Quiz
('quiz:create', N'Tạo bộ đề', 'quiz'),
('quiz:edit',   N'Sửa bộ đề', 'quiz'),
-- Roadmap
('roadmap:create',        N'Tạo lộ trình',              'roadmap'),
('roadmap:edit',          N'Sửa lộ trình',              'roadmap'),
('roadmap:delete',        N'Xóa lộ trình',              'roadmap'),
('roadmap:view_progress', N'Xem tiến độ học của lộ trình', 'roadmap'),
-- Role
('role:create',            N'Tạo vai trò',            'role'),
('role:assign_permission', N'Gán quyền cho vai trò',  'role'),
('role:view',              N'Xem vai trò',            'role'),
('role:delete',            N'Xóa vai trò',            'role'),
('role:edit',              N'Sửa vai trò',            'role'),
-- System / Admin
('analytics:view',       N'Xem phân tích quản trị',       'analytics'),
('audit:view',           N'Xem nhật ký hệ thống',         'audit'),
('admin:access',         N'Quyền truy cập quản trị',      'admin'),
('system.full_control',  N'Toàn quyền trên hệ thống',     'system');

-- Insert any permission that does not yet exist.
INSERT INTO permissions (id, name, description, module, created_at)
SELECT NEWID(), p.Name, p.Description, p.Module, GETDATE()
FROM @Permissions p
WHERE NOT EXISTS (SELECT 1 FROM permissions existing WHERE existing.name = p.Name);

-- Correct description/module drift on existing rows.
UPDATE existing
SET existing.description = p.Description,
    existing.module = p.Module
FROM permissions existing
INNER JOIN @Permissions p ON p.Name = existing.name
WHERE ISNULL(existing.description, '') <> p.Description
   OR ISNULL(existing.module, '') <> p.Module;

-- Ensure the Admin system role holds every catalog permission.
IF EXISTS (SELECT 1 FROM roles WHERE name = 'Admin')
BEGIN
    INSERT INTO role_permissions (role_id, permission_id, granted_at)
    SELECT r.id, p.id, GETDATE()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Admin'
      AND p.name IN (SELECT Name FROM @Permissions)
      AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
      );
END;
