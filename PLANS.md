# Plan: Bo sung tinh nang forum, code playground, moderation va RBAC

## Implementation status (2026-07-11)

- Phases 0-7 backend contracts and User/Admin UI are implemented and build-verified.
- Audit page clamping, role deletion cleanup/notifications, playground language+sandbox persistence, JSON/CSV testcase import, feedback screens, mention autocomplete/highlighting, mention persistence on new posts/comments, and Admin testcase import are included.
- API regression coverage includes testcase import and feedback creation (`105/105` tests pass). Phase 5 moderation now uses sanitized Markdown/HTML rendering, exposes reviewer-visible hidden test cases, and loads complete roadmap details. Phase 7 uses compact audit pagination with ellipses. SQL migration execution remains environment-specific: the configured `Agrimotor\\SQLEXPRESS` instance was not reachable from this session.
- Code submission now maps the Judge0 language ID to the programming-language database ID before enforcing each problem's allowed-language list; workspace options are filtered to the languages allowed by the problem.

## Context

- Active repo: `D:\ThucTap\fixBig\DevLearningHub`
- Related repos: none; changes are scoped to this repo's ASP.NET Core API and Angular User/Admin apps.
- Git scope: this repository only.
- Current state: moderation queue already covers `post`, `problem`, `problem_bank`, `quiz_set`, and `roadmap`; audit logs and role management exist; code playground has manual test cases, language tabs for starter code, and a custom Markdown parser.
- Known constraints: `semantic://health` is unavailable in this session; verify behavior from source and existing tests before implementation.

## Scope and assumptions

1. “Gửi ý kiến riêng yêu cầu lên admin” means an authenticated user can create a private feedback/request ticket visible to authorized Admin/Moderator users, with status and reply/notification lifecycle.
2. “Tag người khác” means `@mention` in posts/comments (distinct from existing content `#tag`), with validation and notifications.
3. “Gợi ý code” is planned as editor assistance based on problem starter templates/snippets first. An external AI completion provider is out of scope until product/API requirements are confirmed.
4. HTML support means allow a small sanitized HTML allow-list inside Markdown descriptions/details; never use unrestricted `bypassSecurityTrustHtml` on raw user input.

## Phase 0 - Contracts and data design

- Confirm UX copy, permissions, notification behavior, and whether feedback supports threaded admin replies.
- Add/extend entities and migrations:
  - `FeedbackRequest` (author, subject/body, target reference, status, admin response, timestamps).
  - `UserMention` or normalized mention records (source type/id, mentioned user, author, read state).
  - `ProblemLanguage`/starter-code mapping and sandbox configuration (allowed language IDs, limits, stdin policy, timeout/memory caps).
- Add permission catalog entries for feedback review, mention/notification access, and playground configuration/import where needed.
- Define DTOs with validation, paging envelopes, and consistent notification reference types.

## Phase 1 - Private feedback/request to admin

- API: create/list own feedback, admin queue/list/detail, update status, add response; enforce author/admin visibility and audit every transition.
- Notifications: notify admins on new request and user on status/response; support SignalR refresh where the existing notification hub is used.
- User UI: private request form, target/context attachment, status/history view, loading/error/empty states.
- Admin UI: feedback queue, filters/status actions, detail/reply modal, permission guards.
- Tests: API authorization/visibility/status tests and Angular service/component tests.

## Phase 2 - @mention người dùng

- Parse mentions on post/comment create/update; resolve by username, de-duplicate, ignore self/unknown users, and cap count/length.
- Persist source-to-user mention records so edits remove stale mentions and deletes clean them up.
- Add notification type/deep link and mark-read behavior; prevent notification leakage from private content.
- User UI: autocomplete while typing, highlighted rendered mentions, accessible keyboard selection; Admin moderation detail renders mentions safely.
- Tests: parser edge cases, authorization, edit/delete cleanup, notification recipient correctness, XSS-safe rendering.

## Phase 3 - Code playground creation and execution

- Replace single `StarterCode` contract with per-language starter code while preserving backward compatibility during migration.
- Creation form: checkbox/multi-select programming languages; language-specific starter editors; validation that selected languages have valid templates.
- Sandbox configuration: expose only safe server-controlled options (timeout, memory, stdin, allowed imports/runtime policy); never trust client limits. Apply limits in Judge0 submission mapping and persist versioned config.
- “Gợi ý code”: provide starter/snippet suggestions per selected language, insertion into editor, and deterministic fallback when no template exists. Keep provider abstraction open for a future AI service.
- Add API migration/backfill, DTO mapping, list/detail response updates, and user/admin UI updates.
- Tests: language persistence, legacy data fallback, sandbox limit enforcement, Judge0 request mapping, editor behavior.

## Phase 4 - Testcase import

- API endpoint for bulk import attached to a problem; accept validated JSON and CSV (document exact schema), enforce row/count/size limits, transactional replace/append mode, and return row-level errors.
- Admin UI: file picker, preview, validation errors, import mode, progress/result summary; retain manual add/edit/delete.
- Add audit event for imports and tests for malformed files, duplicate order indexes, hidden cases, rollback on failure, and authorization.

## Phase 5 - Markdown/HTML and moderation detail

- Introduce one shared sanitization/rendering policy for Markdown + safe HTML (allow-list tags/attributes, safe links, no scripts/styles/event handlers).
- Code playground moderation detail: render description as sanitized HTML, show starter code and all test cases according to reviewer permission, and preserve hidden-case masking for non-authorized viewers.
- Roadmap moderation detail: load/render complete roadmap metadata, items, referenced content, ordering, required flags, and review note; handle missing/deleted references explicitly.
- Add rendering tests with allowed HTML, blocked XSS payloads, code fences, tables, and roadmap references.

## Phase 6 - Role deletion and affected-user notifications

- Change delete-role API to a transaction: load affected users, remove role assignments, preserve each user's baseline/default role policy, delete role permissions, audit affected count, and return a summary.
- Notify every affected user before/after removal with role name, reason, and link to account/permissions; handle notification failure without leaving a partial role deletion.
- UI: allow delete when assigned (subject to permission), show affected-user count and explicit confirmation; refresh role/user lists and display partial/error result. Keep system roles protected.
- Tests: transactional cleanup, self-protection, default-role behavior, notification recipients, audit event, concurrent deletion/idempotency.

## Phase 7 - Audit log pagination fix

- Reproduce with the current `/api/admin/audit-logs` response and compare it with the “template” pagination implementation used by other admin lists.
- Normalize `PagedResult`/`TotalPages` serialization and clamp page after filters so an out-of-range page returns the last valid page or an empty page consistently.
- Fix Admin `audit-logs` page-number generation/navigation, preserve filters on page changes, and use compact ellipsis pagination for large totals.
- Add API tests for zero rows, exact page boundaries, filtered totals, out-of-range pages, and UI tests for next/previous/filter reset.

## Verification gate

- API: `dotnet build` and focused `dotnet test` for each changed contract/controller/service.
- Angular User/Admin: `npm ci` only if dependencies are missing, then `npm test -- --watch=false` and `npm run build` in each app.
- E2E: run focused Playwright suites for moderation, RBAC, code playground, and audit pagination after the relevant phases.
- Security review: authorization matrix, HTML/XSS sanitization, sandbox server-side limits, private feedback visibility, and notification recipient checks.

## Suggested implementation order

1. Phase 0 contracts/migrations and shared notification/sanitization helpers.
2. Phase 7 pagination quick fix (low risk, independently verifiable).
3. Phase 6 role deletion (RBAC/data integrity first).
4. Phases 3-4 playground data model, languages/sandbox, and testcase import.
5. Phase 5 moderation detail rendering.
6. Phases 1-2 feedback and mentions.
7. Full verification and migration/backfill rehearsal.
