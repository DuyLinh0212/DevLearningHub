-- Soft-delete forum posts without removing comments, votes, tags, or audit history.
IF COL_LENGTH('dbo.posts', 'is_deleted') IS NULL
BEGIN
    ALTER TABLE dbo.posts ADD is_deleted bit NOT NULL CONSTRAINT DF_posts_is_deleted DEFAULT (0);
END
GO

IF COL_LENGTH('dbo.posts', 'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.posts ADD deleted_at datetime2 NULL;
END
GO

IF COL_LENGTH('dbo.posts', 'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.posts ADD deleted_by uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_posts_deleted_created' AND object_id = OBJECT_ID('dbo.posts'))
BEGIN
    CREATE INDEX idx_posts_deleted_created ON dbo.posts (is_deleted, created_at DESC);
END
GO
