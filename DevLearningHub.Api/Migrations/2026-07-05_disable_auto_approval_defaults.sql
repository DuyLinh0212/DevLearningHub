-- Disable default auto-approval for moderated content.
-- Run after the moderation schema scripts so new rows default to pending review.

IF COL_LENGTH('posts', 'review_status') IS NOT NULL
BEGIN
    DECLARE @postsReviewStatusConstraint sysname;

    SELECT @postsReviewStatusConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'posts'
      AND c.name = 'review_status';

    IF @postsReviewStatusConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE posts DROP CONSTRAINT [' + @postsReviewStatusConstraint + ']');
    END;

    ALTER TABLE posts ADD CONSTRAINT DF_posts_review_status DEFAULT 'pending' FOR review_status;
END;

IF COL_LENGTH('problems', 'review_status') IS NOT NULL
BEGIN
    DECLARE @problemsReviewStatusConstraint sysname;

    SELECT @problemsReviewStatusConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'problems'
      AND c.name = 'review_status';

    IF @problemsReviewStatusConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE problems DROP CONSTRAINT [' + @problemsReviewStatusConstraint + ']');
    END;

    ALTER TABLE problems ADD CONSTRAINT DF_problems_review_status DEFAULT 'pending' FOR review_status;
END;

IF COL_LENGTH('problem_banks', 'review_status') IS NOT NULL
BEGIN
    DECLARE @problemBanksReviewStatusConstraint sysname;

    SELECT @problemBanksReviewStatusConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'problem_banks'
      AND c.name = 'review_status';

    IF @problemBanksReviewStatusConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE problem_banks DROP CONSTRAINT [' + @problemBanksReviewStatusConstraint + ']');
    END;

    ALTER TABLE problem_banks ADD CONSTRAINT DF_problem_banks_review_status DEFAULT 'pending' FOR review_status;
END;

IF COL_LENGTH('quiz_sets', 'review_status') IS NOT NULL
BEGIN
    DECLARE @quizSetsReviewStatusConstraint sysname;

    SELECT @quizSetsReviewStatusConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'quiz_sets'
      AND c.name = 'review_status';

    IF @quizSetsReviewStatusConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE quiz_sets DROP CONSTRAINT [' + @quizSetsReviewStatusConstraint + ']');
    END;

    ALTER TABLE quiz_sets ADD CONSTRAINT DF_quiz_sets_review_status DEFAULT 'pending' FOR review_status;
END;

IF COL_LENGTH('roadmaps', 'review_status') IS NOT NULL
BEGIN
    DECLARE @roadmapsReviewStatusConstraint sysname;

    SELECT @roadmapsReviewStatusConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
        ON t.object_id = c.object_id
    WHERE t.name = 'roadmaps'
      AND c.name = 'review_status';

    IF @roadmapsReviewStatusConstraint IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE roadmaps DROP CONSTRAINT [' + @roadmapsReviewStatusConstraint + ']');
    END;

    ALTER TABLE roadmaps ADD CONSTRAINT DF_roadmaps_review_status DEFAULT 'pending' FOR review_status;
END;
