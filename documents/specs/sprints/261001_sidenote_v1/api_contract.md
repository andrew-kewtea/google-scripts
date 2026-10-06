# sidenote API contract

Status: corrected  
Date: 2026-10-06  
Code: `apps/chrome/sidenote`, Fast2 journal notes, shared tasks, and sidenote tables

This replaces the call list in `api_connect.md` where the two disagree. Cache trim is not a delete. A row is soft-deleted on Fast2 only when the user sets `deletedAt` and the outbox sends `DELETE`.

## Order

Outbox order is url, url about, collection, journal note, note url ref, then the other sections. A new collection slug has to exist before the note that points at it.

Login does not return `uname`. Before journal paths, the worker reads `GET /auth/me` and stores `uname`.

## Calls

| Local record | Method and path | Body |
| --- | --- | --- |
| Page URL | `POST /urls/` | `normalized_url` |
| About | `/url-abouts/` | `url_id`, `title`, `patterns` |
| Note | `POST /journals/@{uname}/notes` | `page_date` (`YYYY-MM-DD` in the user time zone), `body`, `title`, `tags` (names), `access` (`private` or `public`), `access_groups` (unames) when shared with a group, `collection_slug` when set |
| Note edit | `PATCH /journals/@{uname}/notes/{id}` | Same fields except `page_date`. A text edit does not move the date page |
| Note delete | `DELETE /journals/@{uname}/notes/{id}` | Journal date-page link and storage accounting. Not `DELETE /notes/{id}` |
| URL link | `/note-url-refs/` | `note_id`, `url_id`, `collection_slug` after the note id is known. Do not send `collection_id` |
| Collection | `POST /journals/@{uname}/collections` | `slug`, `name`, `access`. Update and delete use `/{slug}` |
| Note list | `GET /notes/?has_url=1&size=20` | Only `note_url_refs` owned by the signed-in user. Response `tags` is a list of names |
| Collection list | `GET /journals/@{uname}/collections` | `id` is the slug. `visibility` is `private`, `public`, or `ugroup` |
| Context, web history, url match, context task | `/contexts/`, `/web-histories/`, `/url-match-rules/`, `/context-tasks/` | Unchanged. `access_level` stays whatever the server stored |
| Task | `POST/PATCH /tasks/` | `title`, `project_id`, `status`. Do not send `access_level`. Omit `requested_by` and `org_id`; the server uses the signed-in user and that user's `org_id` |
| Task create result | | New tasks are stored as `draft`. The client copies `status` from the response |
| Project | `POST/PATCH /projects/` | `title` only. `org_id` is omitted and taken from the user. Do not send `access_level` |
| Tag visibility | `PATCH /tags/{id}` | `{ "id", "name", "access", "access_groups" }`. `access_level` is not the tag field |
| Groups | `GET/POST /usergroups/` | List returns `id` and `uname`. Update and delete use `/usergroups/{uname}` |
| readAccess | `PATCH /users/me/preferences` | `active_usergroup_unames`. This is not a group row update |
| Preferences | `PATCH /users/me/preferences` | `language` is `en` or `ko`. `theme` is `{ "journal": "system" \| "light" \| "dark" }`. `kchloe` theme is left as stored |

Create responses nest ids. Notes use `note.id`. Collections use `collection.id` (the slug). The outbox rewrites `tmp_` ids from those fields.

`access=ugroup` is not sent. Group sharing is `access: "private"` plus `access_groups`. The read model returns `access` or `visibility` `ugroup`.

Group create still requires Plus or Pro and a free read-access slot. A 422 is shown; the limit is not bypassed.

## Server notes

`has_url=1` matches `note_url_refs.owner_id` of the current user. Another user's link does not pull the note into this cache.

Sidenote list endpoints go through a service. The page query filters `org_id` and `owner_id` in SQL before `LIMIT`, except `sysadmin`.

Context and web history stay on the normal permission model. Default `private` is not a hard lock against a later `public` change.

URL canonicalization (drop query, fragment, `www`, and a trailing slash) applies to every `urls` row in this version. A later version can make that per user.

`app_service_scopes` can store `journal`, `kchloe`, `sidenote`, and `kworkers` as `active` or `inactive`. Nothing rejects an API from that table yet. See Fast2 `documents/specs/backlogs/app_service_scopes.md`.

## Deletes

Tags and user groups stay as they are. `DELETE /tags/{id}` returns `{deleted: false, reason: still_linked}` while any association remains. `DELETE /usergroups/{uname}` archives the group and does not remove shares. Do not unlink those by deleting the parent.

Collection, context, and project deletes keep the child rows and clear the link on the server. The client sends one `DELETE` for the parent. It also clears the local pointers in the same edit so the panel updates before the next pull. A child `PATCH` is not required.

| Parent | Method and path | What stays | What the server clears | Local state in the same edit |
| --- | --- | --- | --- | --- |
| Collection | `DELETE /journals/@{uname}/collections/{slug}` | Notes stay on the date page. URL links stay | Date-page `collection_id`, `note_url_refs.collection_id`, inbox inferred collection, and any other journal page `collection_id` | `deletedAt` on the collection. `note.collectionId = null` |
| Context | `DELETE /contexts/{id}` | Web history rows stay. Tasks stay | `web_histories.context_id` set to null. `context_tasks` for that context are soft-deleted | `deletedAt` on the context. `excerpt.contextId = null`. `context.taskIds = []` |
| Project | `DELETE /projects/{id}` | Tasks stay. Change requests and signals stay | `tasks.project_id`, `change_requests.project_id`, and `signals.project_id` set to null | `deletedAt` on the project. `task.projectId = null` |
| Task | `DELETE /tasks/{id}` | The context stays | `context_tasks` for that task are soft-deleted | `deletedAt` on the task. Drop that id from `context.taskIds` |

Collection delete returns 204. If the collection still has edition pages, the response is 409 `Journal collection has edition pages`. Show that error. Sidenote does not create editions.

Deleted parents are omitted from list responses. A pull therefore does not, by itself, mark a parent deleted on another device. The device that deletes must set `deletedAt` locally. Child rows that come back on pull already have the link removed: `collection_slug`, `context_id`, and `project_id` are null when the parent is deleted, and `context_tasks` whose context or task is deleted are left out of `GET /context-tasks/`. Apply those nulls onto the local note, excerpt, and task. Rebuild `context.taskIds` from the context-task page, using an empty list when that context has no returned links.

## Note URL link collection

Collection list `id` is the slug. `note_url_refs.collection_id` in the database is the numeric `journal_collections.id`. Sidenote sends and reads `collection_slug` only.

`POST /note-url-refs/` and `PATCH /note-url-refs/{id}` accept `collection_slug`. The server stores the signed-in user's personal collection (`usergroup_id = 0`, not deleted). An unknown slug is 422 `Journal collection not found`. Omit `collection_slug` on PATCH to keep the current link. Send `collection_slug: null` to clear it. Sending both `collection_slug` and `collection_id` is allowed only when they are the same collection; otherwise 422.

The response includes `collection_slug` for a live collection, and `collection_id` as that collection's numeric id. Both are null when the collection is missing or deleted. This is not the journal note sentinel `"journal"`.

The journal note body still sends its own `collection_slug` on `POST/PATCH /journals/@{uname}/notes`. That places the note on the date page and the collection page. `note_url_refs.collection_slug` is the value sidenote pull uses for the local collection id.

## Reuse on create

A local row synced after login uses the same create call. If this user already has a live row with the same key, the response is the existing create shape and its id. The server does not change that row's name, access, or child links. Replace the local `tmp_` id with the returned id. There is no schema change.

| Create | Same row when | If several exist |
| --- | --- | --- |
| `POST /journals/@{uname}/collections` | Personal collection, `usergroup_id = 0`, same slug, not deleted | Slug is already unique |
| `POST /tags/` | This user's live tag, same name as the `owner_id` + `name` unique key | One row |
| `POST /contexts/` | This user's live context, same trimmed name | Oldest id. Extras stay |
| `POST /projects/` | Project owned by this user, same trimmed title | Oldest id. Extras stay |
| `POST /usergroups/` | `uname` exists and the caller is a member, including archived | One uname |

A deleted collection slug stays 409 and is not restored. A group `uname` owned by someone else, or one the caller has left, is still rejected. Rejoining an existing membership does not spend the Plus/Pro create limit.
