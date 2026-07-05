-- Widen moderation_logs to support content-review actions (approve/reject)
-- alongside the original forum moderation actions (hide/restore/delete),
-- and widen target_type so 'problem_bank' (12 chars) fits.
-- Run against the DevLearningHub database.

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_moderation_logs_action'
)
BEGIN
    ALTER TABLE moderation_logs DROP CONSTRAINT CK_moderation_logs_action;
END;

IF COL_LENGTH('moderation_logs', 'target_type') IS NOT NULL
BEGIN
    ALTER TABLE moderation_logs ALTER COLUMN target_type nvarchar(20) NOT NULL;
END;

ALTER TABLE moderation_logs ADD CONSTRAINT CK_moderation_logs_action
    CHECK (action IN ('hide', 'restore', 'delete', 'approve', 'reject'));
