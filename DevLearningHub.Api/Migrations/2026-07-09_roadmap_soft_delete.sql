-- Roadmap delete changed from hard DELETE to soft delete.
--
-- Reason: DELETE FROM roadmaps cascades to roadmap_items (FK_roadmap_items_roadmap ON DELETE
-- CASCADE), but roadmap_items can already have rows in user_roadmap_item_completions
-- (FK_user_roadmap_item_completions_item -> roadmap_items(id), NO ACTION/no cascade). As soon as
-- any learner has completed at least one step of a roadmap, deleting that roadmap throws:
--   "The DELETE statement conflicted with the REFERENCE constraint
--   'FK_user_roadmap_item_completions_item'... table 'dbo.user_roadmap_item_completions',
--   column 'roadmap_item_id'."
-- Soft-deleting instead (is_deleted = 1) hides the roadmap everywhere without touching
-- roadmap_items / completions, so learner progress and awarded XP are preserved.
--
-- Run against the DevLearningHub database. Idempotent (safe to run again).

IF COL_LENGTH('roadmaps', 'is_deleted') IS NULL
BEGIN
    ALTER TABLE roadmaps ADD is_deleted bit NOT NULL
        CONSTRAINT DF_roadmaps_is_deleted DEFAULT (0);

    PRINT 'Da them cot is_deleted vao bang roadmaps.';
END
ELSE
BEGIN
    PRINT 'Cot is_deleted da ton tai - bo qua.';
END
GO
