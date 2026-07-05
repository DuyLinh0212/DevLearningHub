-- Roadmap item completion tracking changed from time-window-derived (global Submissions/QuizSessions
-- state filtered by a timestamp cutoff) to strictly explicit, per-roadmap-item completion rows
-- inserted only via POST /api/roadmaps/{roadmapId}/items/{itemId}/complete.
--
-- Existing rows in user_roadmap_item_completions were populated by the old derived logic and can be
-- stale/incorrect (e.g. a quiz set completed through one roadmap incorrectly marked as completed in
-- another roadmap that references the same quiz set). Clear them so completion state rebuilds cleanly
-- under the new explicit-only mechanism; this does not claw back any XP already awarded.

TRUNCATE TABLE dbo.user_roadmap_item_completions;
