-- SCRIPT: Gán full admin portal permissions cho Moderator role
-- và gán Moderator role cho user namtqn4
USE DevLearningHub;
GO

PRINT '=== Starting Moderator Permission Setup ===';
GO

-- 1. Đảm bảo tất cả permissions cần thiết tồn tại
DECLARE @RequiredPermissions TABLE (Name NVARCHAR(100), Description NVARCHAR(200), Module NVARCHAR(50));
INSERT INTO @RequiredPermissions VALUES
('user:view_all', 'View all users', 'user'),
('user:edit_role', 'Edit user roles and permissions', 'user'),
('user:ban', 'Ban/lock user accounts', 'user'),
('audit:view', 'View audit logs', 'audit'),
('quiz:edit', 'Edit/manage quizzes and problems', 'quiz'),
('comment:hide', 'Hide/unhide comments', 'comment'),
('comment:delete', 'Delete any comment', 'comment'),
('post:hide', 'Hide/unhide posts', 'post'),
('post:delete_any', 'Delete any post', 'post'),
('post:edit_any', 'Edit any post', 'post'),
('tag:edit', 'Edit/manage tags', 'tag'),
('topic:edit', 'Edit/manage topics', 'topic'),
('roadmap:edit', 'Edit/manage roadmaps', 'roadmap');

DECLARE @permName NVARCHAR(100);
DECLARE perm_cursor CURSOR FOR SELECT Name FROM @RequiredPermissions;
OPEN perm_cursor;
FETCH NEXT FROM perm_cursor INTO @permName;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permissions WHERE name = @permName)
    BEGIN
        DECLARE @desc NVARCHAR(200), @mod NVARCHAR(50);
        SELECT @desc = Description, @mod = Module FROM @RequiredPermissions WHERE Name = @permName;
        INSERT INTO permissions (id, name, description, module, created_at)
        VALUES (NEWID(), @permName, @desc, @mod, GETDATE());
        PRINT 'Created permission: ' + @permName;
    END
    FETCH NEXT FROM perm_cursor INTO @permName;
END
CLOSE perm_cursor;
DEALLOCATE perm_cursor;
GO

-- 2. Đảm bảo Moderator role tồn tại
IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Moderator')
BEGIN
    INSERT INTO roles (id, name, description, is_active, created_at, updated_at)
    VALUES (NEWID(), 'Moderator', 'Moderator with admin portal access', 1, GETDATE(), GETDATE());
    PRINT 'Created Moderator role';
END
GO

-- 3. Gán TẤT CẢ permissions cần thiết cho Moderator role
DECLARE @moderatorRoleId UNIQUEIDENTIFIER = (SELECT id FROM roles WHERE name = 'Moderator');

DECLARE @permTable TABLE (Name NVARCHAR(100));
INSERT INTO @permTable VALUES
('user:view_all'),
('user:edit_role'),
('user:ban'),
('audit:view'),
('quiz:edit'),
('comment:hide'),
('comment:delete'),
('post:hide'),
('post:delete_any'),
('post:edit_any'),
('tag:edit'),
('topic:edit'),
('roadmap:edit');

DECLARE @permId UNIQUEIDENTIFIER;
DECLARE @permNameToAssign NVARCHAR(100);
DECLARE assign_cursor CURSOR FOR SELECT Name FROM @permTable;
OPEN assign_cursor;
FETCH NEXT FROM assign_cursor INTO @permNameToAssign;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @permId = (SELECT id FROM permissions WHERE name = @permNameToAssign);
    IF @moderatorRoleId IS NOT NULL AND @permId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = @moderatorRoleId AND permission_id = @permId)
        BEGIN
            INSERT INTO role_permissions (role_id, permission_id, granted_at)
            VALUES (@moderatorRoleId, @permId, GETDATE());
            PRINT 'Granted permission: ' + @permNameToAssign + ' to Moderator';
        END
    END
    FETCH NEXT FROM assign_cursor INTO @permNameToAssign;
END
CLOSE assign_cursor;
DEALLOCATE assign_cursor;
GO

-- 4. Gán Moderator role cho user namtqn4
DECLARE @userId UNIQUEIDENTIFIER = (SELECT id FROM users WHERE username = 'namtqn4');
IF @userId IS NOT NULL AND @moderatorRoleId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = @userId AND role_id = @moderatorRoleId)
    BEGIN
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        VALUES (@userId, @moderatorRoleId, GETDATE());
        PRINT 'Assigned Moderator role to user namtqn4';
    END
    ELSE
    BEGIN
        PRINT 'User namtqn4 already has Moderator role';
    END
END
ELSE
BEGIN
    IF @userId IS NULL PRINT 'ERROR: User namtqn4 not found';
    IF @moderatorRoleId IS NULL PRINT 'ERROR: Moderator role not found';
END
GO

PRINT '=== Moderator setup completed ===';
GO

-- Kiểm tra kết quả
SELECT
    'Moderator Permissions' as Type,
    p.name as PermissionName,
    p.module as Module
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Moderator'
ORDER BY p.module, p.name;

SELECT
    'User namtqn4 roles' as Type,
    r.name as RoleName
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.username = 'namtqn4';
GO
