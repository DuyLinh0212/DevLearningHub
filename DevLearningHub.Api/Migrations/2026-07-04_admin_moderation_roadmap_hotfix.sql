-- DevLearningHub moderation roadmap hotfix delta.
-- Use this file only if the older 2026-07-03 script has already been run
-- and you only want the additional safe-fix changes.

IF COL_LENGTH('roadmaps', 'created_by') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD created_by uniqueidentifier NULL;
END;

IF COL_LENGTH('roadmaps', 'is_public') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD is_public bit NOT NULL
        CONSTRAINT DF_roadmaps_is_public DEFAULT 1;
END;

IF COL_LENGTH('roadmaps', 'review_status') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD review_status nvarchar(20) NOT NULL
        CONSTRAINT DF_roadmaps_review_status DEFAULT 'approved';
END;

IF COL_LENGTH('roadmaps', 'reviewed_by') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD reviewed_by uniqueidentifier NULL;
END;

IF COL_LENGTH('roadmaps', 'reviewed_at') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD reviewed_at datetime2 NULL;
END;

IF COL_LENGTH('roadmaps', 'review_note') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD review_note nvarchar(500) NULL;
END;

IF COL_LENGTH('roadmaps', 'created_at') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD created_at datetime2 NOT NULL
        CONSTRAINT DF_roadmaps_created_at DEFAULT getutcdate();
END;

GO

DECLARE @RoadmapFallbackCreator uniqueidentifier;

SELECT TOP 1 @RoadmapFallbackCreator = id
FROM users
WHERE is_active = 1
ORDER BY created_at, id;

IF @RoadmapFallbackCreator IS NULL
BEGIN
    SELECT TOP 1 @RoadmapFallbackCreator = id
    FROM users
    ORDER BY created_at, id;
END;

IF @RoadmapFallbackCreator IS NOT NULL
BEGIN
    UPDATE roadmaps
    SET created_by = @RoadmapFallbackCreator
    WHERE created_by IS NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('roadmaps')
      AND name = 'created_by'
      AND is_nullable = 1
)
AND NOT EXISTS (SELECT 1 FROM roadmaps WHERE created_by IS NULL)
BEGIN
    ALTER TABLE roadmaps ALTER COLUMN created_by uniqueidentifier NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_roadmaps_creator'
)
BEGIN
    ALTER TABLE roadmaps ADD CONSTRAINT FK_roadmaps_creator
        FOREIGN KEY (created_by) REFERENCES users(id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_roadmaps_reviewer'
)
BEGIN
    ALTER TABLE roadmaps ADD CONSTRAINT FK_roadmaps_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('roadmaps')
      AND name = 'idx_roadmaps_creator'
)
BEGIN
    CREATE INDEX idx_roadmaps_creator ON roadmaps(created_by);
END;

DECLARE @Permissions TABLE (Name nvarchar(100), Description nvarchar(200), Module nvarchar(50));
INSERT INTO @Permissions (Name, Description, Module) VALUES
('analytics:view', 'View admin analytics', 'analytics'),
('roadmap:create', 'Create roadmaps', 'roadmap'),
('roadmap:edit', 'Edit roadmaps', 'roadmap'),
('roadmap:delete', 'Delete roadmaps', 'roadmap'),
('roadmap:view_progress', 'View roadmap learner progress', 'roadmap'),
('roadmap:review', 'Review roadmaps', 'roadmap'),
('role:view', 'View roles', 'role'),
('role:create', 'Create roles', 'role'),
('role:edit', 'Edit roles', 'role'),
('role:delete', 'Delete roles', 'role'),
('role:assign_permission', 'Assign permissions to roles', 'role'),
('post:review', 'Review posts', 'post'),
('problem:review', 'Review code problems', 'problem'),
('quiz:review', 'Review quiz sets', 'quiz'),
('problem_bank:review', 'Review problem banks', 'problem_bank'),
('post:hide_any', 'Hide or restore posts', 'post');

UPDATE existing
SET existing.description = p.Description,
    existing.module = p.Module
FROM permissions existing
INNER JOIN @Permissions p ON p.Name = existing.name
WHERE ISNULL(existing.description, '') <> p.Description
   OR ISNULL(existing.module, '') <> p.Module;

IF EXISTS (SELECT 1 FROM roles WHERE name = 'Admin')
BEGIN
    INSERT INTO role_permissions (role_id, permission_id, granted_at)
    SELECT r.id, p.id, GETDATE()
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Admin'
      AND p.name IN (SELECT Name FROM @Permissions)
      AND NOT EXISTS (
          SELECT 1
          FROM role_permissions rp
          WHERE rp.role_id = r.id
            AND rp.permission_id = p.id
      );
END;
