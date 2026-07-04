-- DevLearningHub admin/moderation/roadmap v2 support.
-- Run against the DevLearningHub database.

IF COL_LENGTH('posts', 'review_status') IS NULL
BEGIN
    ALTER TABLE posts ADD
        review_status nvarchar(20) NOT NULL CONSTRAINT DF_posts_review_status DEFAULT 'approved',
        reviewed_by uniqueidentifier NULL,
        reviewed_at datetime2 NULL,
        review_note nvarchar(500) NULL;

    ALTER TABLE posts ADD CONSTRAINT FK_posts_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
END;

IF COL_LENGTH('problems', 'review_status') IS NULL
BEGIN
    ALTER TABLE problems ADD
        review_status nvarchar(20) NOT NULL CONSTRAINT DF_problems_review_status DEFAULT 'approved',
        reviewed_by uniqueidentifier NULL,
        reviewed_at datetime2 NULL,
        review_note nvarchar(500) NULL;

    ALTER TABLE problems ADD CONSTRAINT FK_problems_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
END;

IF COL_LENGTH('problem_banks', 'review_status') IS NULL
BEGIN
    ALTER TABLE problem_banks ADD
        review_status nvarchar(20) NOT NULL CONSTRAINT DF_problem_banks_review_status DEFAULT 'approved',
        reviewed_by uniqueidentifier NULL,
        reviewed_at datetime2 NULL,
        review_note nvarchar(500) NULL;

    ALTER TABLE problem_banks ADD CONSTRAINT FK_problem_banks_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
END;

IF COL_LENGTH('quiz_sets', 'review_status') IS NULL
BEGIN
    ALTER TABLE quiz_sets ADD
        review_status nvarchar(20) NOT NULL CONSTRAINT DF_quiz_sets_review_status DEFAULT 'approved',
        reviewed_by uniqueidentifier NULL,
        reviewed_at datetime2 NULL,
        review_note nvarchar(500) NULL;

    ALTER TABLE quiz_sets ADD CONSTRAINT FK_quiz_sets_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
END;

IF OBJECT_ID('roadmap_items', 'U') IS NULL
BEGIN
    CREATE TABLE roadmap_items
    (
        id uniqueidentifier NOT NULL CONSTRAINT DF_roadmap_items_id DEFAULT newsequentialid(),
        roadmap_id uniqueidentifier NOT NULL,
        item_type nvarchar(30) NOT NULL,
        topic_id uniqueidentifier NULL,
        quiz_set_id uniqueidentifier NULL,
        problem_id uniqueidentifier NULL,
        problem_bank_id uniqueidentifier NULL,
        title_override nvarchar(200) NULL,
        description_override nvarchar(max) NULL,
        order_index smallint NOT NULL,
        is_required bit NOT NULL CONSTRAINT DF_roadmap_items_is_required DEFAULT 1,
        created_at datetime2 NOT NULL CONSTRAINT DF_roadmap_items_created_at DEFAULT getutcdate(),
        CONSTRAINT PK_roadmap_items PRIMARY KEY (id),
        CONSTRAINT FK_roadmap_items_roadmap FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
        CONSTRAINT FK_roadmap_items_topic FOREIGN KEY (topic_id) REFERENCES topics(id),
        CONSTRAINT FK_roadmap_items_quiz_set FOREIGN KEY (quiz_set_id) REFERENCES quiz_sets(id),
        CONSTRAINT FK_roadmap_items_problem FOREIGN KEY (problem_id) REFERENCES problems(id),
        CONSTRAINT FK_roadmap_items_problem_bank FOREIGN KEY (problem_bank_id) REFERENCES problem_banks(id),
        CONSTRAINT CK_roadmap_items_one_target CHECK (
            (CASE WHEN topic_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN quiz_set_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN problem_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN problem_bank_id IS NULL THEN 0 ELSE 1 END) = 1
        ),
        CONSTRAINT CK_roadmap_items_type CHECK (item_type IN ('topic', 'quiz_set', 'problem', 'problem_bank'))
    );

    CREATE INDEX idx_roadmap_items_order ON roadmap_items(roadmap_id, order_index);
END;

IF OBJECT_ID('user_roadmaps', 'U') IS NULL
BEGIN
    CREATE TABLE user_roadmaps
    (
        user_id uniqueidentifier NOT NULL,
        roadmap_id uniqueidentifier NOT NULL,
        started_at datetime2 NOT NULL CONSTRAINT DF_user_roadmaps_started_at DEFAULT getutcdate(),
        completed_at datetime2 NULL,
        last_activity_at datetime2 NULL,
        CONSTRAINT PK_user_roadmaps PRIMARY KEY (user_id, roadmap_id),
        CONSTRAINT FK_user_roadmaps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_user_roadmaps_roadmap FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
    );
END;

DECLARE @Permissions TABLE (Name nvarchar(100), Description nvarchar(200), Module nvarchar(50));
INSERT INTO @Permissions (Name, Description, Module) VALUES
('analytics:view', 'View admin analytics', 'analytics'),
('roadmap:create', 'Create roadmaps', 'roadmap'),
('roadmap:edit', 'Edit roadmaps', 'roadmap'),
('roadmap:delete', 'Delete roadmaps', 'roadmap'),
('roadmap:view_progress', 'View roadmap learner progress', 'roadmap'),
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

INSERT INTO permissions (id, name, description, module, created_at)
SELECT NEWID(), p.Name, p.Description, p.Module, GETDATE()
FROM @Permissions p
WHERE NOT EXISTS (SELECT 1 FROM permissions existing WHERE existing.name = p.Name);

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
