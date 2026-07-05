-- CK_moderation_logs_target only allowed 'post'/'comment', but content-review
-- moderation also inserts 'problem', 'problem_bank', 'quiz_set', 'roadmap'
-- (see AdminModerationController.AllTypes), causing approve/reject to fail
-- with a CHECK constraint violation for those types.
-- Run against the DevLearningHub database.

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_moderation_logs_target'
)
BEGIN
    ALTER TABLE moderation_logs DROP CONSTRAINT CK_moderation_logs_target;
END;

ALTER TABLE moderation_logs ADD CONSTRAINT CK_moderation_logs_target
    CHECK (target_type IN ('post', 'comment', 'problem', 'problem_bank', 'quiz_set', 'roadmap'));
