/*
    Migration: thêm cột allowed_copy vào bảng quiz_sets
    Lý do: Entity QuizSet (DevLearningHubContext) ánh xạ thuộc tính AllowedCopy -> cột
           [allowed_copy] (bit NOT NULL DEFAULT 0), nhưng script tạo DB gốc
           (DevLearningHubData.sql) chưa có cột này. Thiếu cột khiến API tạo bộ đề
           (POST /api/quiz-sets) ném lỗi: "Invalid column name 'allowed_copy'." -> HTTP 500.

    Chạy 1 lần trên CSDL DevLearningHub. Script idempotent (an toàn khi chạy lại).
*/
USE [DevLearningHub];
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'quiz_sets' AND COLUMN_NAME = 'allowed_copy'
)
BEGIN
    ALTER TABLE [dbo].[quiz_sets]
        ADD [allowed_copy] [bit] NOT NULL
        CONSTRAINT [DF_quiz_sets_allowed_copy] DEFAULT ((0));

    PRINT 'Da them cot allowed_copy vao bang quiz_sets.';
END
ELSE
BEGIN
    PRINT 'Cot allowed_copy da ton tai - bo qua.';
END
GO
