/*
    Migration: thêm tính năng "Kho quản lý bài tập Code" (problem_bank).
    Tạo 4 bảng:
      - problem_banks          : kho (collection) do 1 user tạo.
      - problem_bank_items     : liên kết kho <-> bài tập (problems), n-n có metadata.
      - problem_bank_likes     : lượt thích của user cho kho (1 user / 1 kho).
      - problem_bank_ratings   : đánh giá 1-5 sao + nhận xét của user (1 user / 1 kho).

    Tiến độ hoàn thành và độ chính xác KHÔNG lưu ở đây mà tính động từ bảng
    submissions sẵn có, nên luôn chính xác.

    Chạy 1 lần trên CSDL DevLearningHub. Script idempotent (an toàn khi chạy lại).
*/
USE [DevLearningHub];
GO

-- 1. problem_banks ----------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'problem_banks')
BEGIN
    CREATE TABLE [dbo].[problem_banks](
        [id]          [uniqueidentifier] NOT NULL CONSTRAINT [DF_problem_banks_id]         DEFAULT (newsequentialid()),
        [created_by]  [uniqueidentifier] NOT NULL,
        [title]       [nvarchar](200)    NOT NULL,
        [description] [nvarchar](max)    NULL,
        [is_public]   [bit]              NOT NULL CONSTRAINT [DF_problem_banks_is_public]  DEFAULT ((1)),
        [created_at]  [datetime2](7)     NOT NULL CONSTRAINT [DF_problem_banks_created_at] DEFAULT (getutcdate()),
        [updated_at]  [datetime2](7)     NULL,
        CONSTRAINT [PK_problem_banks] PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [FK_problem_banks_user] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id])
    );

    CREATE INDEX [idx_problem_banks_creator] ON [dbo].[problem_banks]([created_by]);

    PRINT 'Da tao bang problem_banks.';
END
ELSE
    PRINT 'Bang problem_banks da ton tai - bo qua.';
GO

-- 2. problem_bank_items -----------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'problem_bank_items')
BEGIN
    CREATE TABLE [dbo].[problem_bank_items](
        [bank_id]     [uniqueidentifier] NOT NULL,
        [problem_id]  [uniqueidentifier] NOT NULL,
        [order_index] [int]              NOT NULL CONSTRAINT [DF_problem_bank_items_order] DEFAULT ((0)),
        [added_at]    [datetime2](7)     NOT NULL CONSTRAINT [DF_problem_bank_items_added] DEFAULT (getutcdate()),
        CONSTRAINT [PK_problem_bank_items] PRIMARY KEY CLUSTERED ([bank_id] ASC, [problem_id] ASC),
        CONSTRAINT [FK_problem_bank_items_bank] FOREIGN KEY ([bank_id])
            REFERENCES [dbo].[problem_banks]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_problem_bank_items_problem] FOREIGN KEY ([problem_id])
            REFERENCES [dbo].[problems]([id])
    );

    CREATE INDEX [idx_problem_bank_items_problem] ON [dbo].[problem_bank_items]([problem_id]);

    PRINT 'Da tao bang problem_bank_items.';
END
ELSE
    PRINT 'Bang problem_bank_items da ton tai - bo qua.';
GO

-- 3. problem_bank_likes -----------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'problem_bank_likes')
BEGIN
    CREATE TABLE [dbo].[problem_bank_likes](
        [bank_id]    [uniqueidentifier] NOT NULL,
        [user_id]    [uniqueidentifier] NOT NULL,
        [created_at] [datetime2](7)     NOT NULL CONSTRAINT [DF_problem_bank_likes_created] DEFAULT (getutcdate()),
        CONSTRAINT [PK_problem_bank_likes] PRIMARY KEY CLUSTERED ([bank_id] ASC, [user_id] ASC),
        CONSTRAINT [FK_problem_bank_likes_bank] FOREIGN KEY ([bank_id])
            REFERENCES [dbo].[problem_banks]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_problem_bank_likes_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id])
    );

    PRINT 'Da tao bang problem_bank_likes.';
END
ELSE
    PRINT 'Bang problem_bank_likes da ton tai - bo qua.';
GO

-- 4. problem_bank_ratings ---------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'problem_bank_ratings')
BEGIN
    CREATE TABLE [dbo].[problem_bank_ratings](
        [bank_id]    [uniqueidentifier] NOT NULL,
        [user_id]    [uniqueidentifier] NOT NULL,
        [rating]     [tinyint]          NOT NULL,
        [comment]    [nvarchar](500)    NULL,
        [created_at] [datetime2](7)     NOT NULL CONSTRAINT [DF_problem_bank_ratings_created] DEFAULT (getutcdate()),
        [updated_at] [datetime2](7)     NULL,
        CONSTRAINT [PK_problem_bank_ratings] PRIMARY KEY CLUSTERED ([bank_id] ASC, [user_id] ASC),
        CONSTRAINT [CK_problem_bank_ratings_range] CHECK ([rating] >= 1 AND [rating] <= 5),
        CONSTRAINT [FK_problem_bank_ratings_bank] FOREIGN KEY ([bank_id])
            REFERENCES [dbo].[problem_banks]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_problem_bank_ratings_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id])
    );

    PRINT 'Da tao bang problem_bank_ratings.';
END
ELSE
    PRINT 'Bang problem_bank_ratings da ton tai - bo qua.';
GO
