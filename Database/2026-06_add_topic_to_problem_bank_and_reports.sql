/*
    Migration:
      1. Thêm cột topic_id vào bảng problem_banks (phân loại ngân hàng theo chủ đề).
      2. Tạo bảng report_types (loại báo cáo).
      3. Tạo bảng reports (báo cáo nội dung từ user).
      4. Thêm cột bio và banner_url vào bảng users (hồ sơ cá nhân).

    Chạy 1 lần trên CSDL DevLearningHub. Script idempotent (an toàn khi chạy lại).
*/
USE [DevLearningHub];
GO

-- ==========================================================================
-- 1. Thêm topic_id vào problem_banks
-- ==========================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'problem_banks' AND COLUMN_NAME = 'topic_id'
)
BEGIN
    ALTER TABLE [dbo].[problem_banks]
        ADD [topic_id] [uniqueidentifier] NULL;

    ALTER TABLE [dbo].[problem_banks]
        ADD CONSTRAINT [FK_problem_banks_topic]
            FOREIGN KEY ([topic_id]) REFERENCES [dbo].[topics]([id]);

    CREATE INDEX [idx_problem_banks_topic] ON [dbo].[problem_banks]([topic_id]);

    PRINT 'Da them cot topic_id vao bang problem_banks.';
END
ELSE
    PRINT 'Cot topic_id da ton tai trong bang problem_banks - bo qua.';
GO

-- ==========================================================================
-- 2. Tạo bảng report_types
-- ==========================================================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'report_types')
BEGIN
    CREATE TABLE [dbo].[report_types] (
        [id]          [uniqueidentifier] NOT NULL CONSTRAINT [DF_report_types_id]   DEFAULT (newsequentialid()),
        [name]        [nvarchar](50)     NOT NULL,
        [description] [nvarchar](255)    NULL,
        CONSTRAINT [PK_report_types]   PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [UQ_report_types_name] UNIQUE ([name])
    );

    INSERT INTO [dbo].[report_types] ([name], [description]) VALUES
        (N'post',         N'Báo cáo bài viết'),
        (N'comment',      N'Báo cáo bình luận'),
        (N'problem',      N'Báo cáo lỗi bài tập code'),
        (N'quiz_question',N'Báo cáo lỗi câu hỏi trong bộ đề quiz');

    PRINT 'Da tao bang report_types va du lieu ban dau.';
END
ELSE
    PRINT 'Bang report_types da ton tai - bo qua.';
GO

-- ==========================================================================
-- 3. Tạo bảng reports
-- ==========================================================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'reports')
BEGIN
    CREATE TABLE [dbo].[reports] (
        [id]             [uniqueidentifier] NOT NULL CONSTRAINT [DF_reports_id]          DEFAULT (newsequentialid()),
        [report_type_id] [uniqueidentifier] NOT NULL,
        [reporter_id]    [uniqueidentifier] NOT NULL,
        [target_id]      [uniqueidentifier] NOT NULL,
        [description]    [nvarchar](max)    NULL,
        -- 'pending' | 'reviewed' | 'resolved' | 'dismissed'
        [status]         [nvarchar](20)     NOT NULL CONSTRAINT [DF_reports_status] DEFAULT (N'pending'),
        [created_at]     [datetime2](7)     NOT NULL CONSTRAINT [DF_reports_created_at] DEFAULT (getutcdate()),
        [resolved_at]    [datetime2](7)     NULL,
        [resolved_by]    [uniqueidentifier] NULL,
        CONSTRAINT [PK_reports]          PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [FK_reports_type]     FOREIGN KEY ([report_type_id]) REFERENCES [dbo].[report_types]([id]),
        CONSTRAINT [FK_reports_reporter] FOREIGN KEY ([reporter_id])    REFERENCES [dbo].[users]([id]),
        CONSTRAINT [FK_reports_resolver] FOREIGN KEY ([resolved_by])    REFERENCES [dbo].[users]([id])
    );

    CREATE INDEX [idx_reports_type]     ON [dbo].[reports]([report_type_id]);
    CREATE INDEX [idx_reports_reporter] ON [dbo].[reports]([reporter_id]);
    CREATE INDEX [idx_reports_target]   ON [dbo].[reports]([target_id]);
    CREATE INDEX [idx_reports_status]   ON [dbo].[reports]([status]);

    PRINT 'Da tao bang reports.';
END
ELSE
    PRINT 'Bang reports da ton tai - bo qua.';
GO

-- ==========================================================================
-- 4. Thêm bio và banner_url vào bảng users
-- ==========================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'bio'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [bio] [nvarchar](500) NULL;
    PRINT 'Da them cot bio vao bang users.';
END
ELSE
    PRINT 'Cot bio da ton tai trong bang users - bo qua.';
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'banner_url'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [banner_url] [nvarchar](1000) NULL;
    PRINT 'Da them cot banner_url vao bang users.';
END
ELSE
    PRINT 'Cot banner_url da ton tai trong bang users - bo qua.';
GO
