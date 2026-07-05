-- Phase 3b/3c: per-item pass threshold for quiz_set roadmap items (sequential
-- unlock uses this to decide when an item counts as completed), and a table
-- to track first-time roadmap item completions so EXP is only awarded once.
-- Run against the DevLearningHub database.

IF COL_LENGTH('roadmap_items', 'pass_threshold') IS NULL
BEGIN
    ALTER TABLE roadmap_items ADD pass_threshold tinyint NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_roadmap_item_completions')
BEGIN
    CREATE TABLE user_roadmap_item_completions (
        user_id uniqueidentifier NOT NULL,
        roadmap_item_id uniqueidentifier NOT NULL,
        completed_at datetime2 NOT NULL DEFAULT (getutcdate()),
        CONSTRAINT PK_user_roadmap_item_completions PRIMARY KEY (user_id, roadmap_item_id),
        CONSTRAINT FK_user_roadmap_item_completions_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT FK_user_roadmap_item_completions_item FOREIGN KEY (roadmap_item_id) REFERENCES roadmap_items(id)
    );
END;
