/*
    Migration:
      1. Add reports.recipient_id to remember who receives/owns a report.
      2. Expand notifications.type check constraint for current app notification types.

    Run once on DevLearningHub. Idempotent and safe to re-run.
*/
USE [DevLearningHub];
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'reports'
      AND COLUMN_NAME = 'recipient_id'
)
BEGIN
    ALTER TABLE [dbo].[reports]
        ADD [recipient_id] [uniqueidentifier] NULL;

    ALTER TABLE [dbo].[reports]
        ADD CONSTRAINT [FK_reports_recipient]
            FOREIGN KEY ([recipient_id]) REFERENCES [dbo].[users]([id]);

    CREATE INDEX [idx_reports_recipient] ON [dbo].[reports]([recipient_id]);

    PRINT 'Added recipient_id to reports.';
END
ELSE
BEGIN
    PRINT 'reports.recipient_id already exists - skipped.';
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_notifications_type'
      AND parent_object_id = OBJECT_ID(N'[dbo].[notifications]')
)
BEGIN
    ALTER TABLE [dbo].[notifications] DROP CONSTRAINT [CK_notifications_type];
    PRINT 'Dropped old CK_notifications_type.';
END
GO

ALTER TABLE [dbo].[notifications] WITH CHECK ADD CONSTRAINT [CK_notifications_type]
CHECK ([type] IN (
    N'system',
    N'comment',
    N'vote',
    N'accept',
    N'comment_reply',
    N'post_comment',
    N'content_reported',
    N'post_deleted',
    N'comment_deleted',
    N'quiz_deleted',
    N'problem_deleted'
));
GO

ALTER TABLE [dbo].[notifications] CHECK CONSTRAINT [CK_notifications_type];
GO

