-- Creator-configured fixed number of questions drawn per mock-exam ("Thi thu")
-- attempt. Null means the exam uses every question in the quiz set (backward
-- compatible default for existing quiz sets). Run against the DevLearningHub database.

IF COL_LENGTH('quiz_sets', 'exam_question_count') IS NULL
BEGIN
    ALTER TABLE quiz_sets ADD exam_question_count int NULL;
END;
