# Kem.Bali — Postgres (Supabase) schema

The real source of truth is `supabase/schema.sql` (tables, Row Level Security policies, and RPC
functions) — run it once in the Supabase SQL Editor. This file is the quick-reference map.

`group_id: null` (or no row at all, for personal-only tables) means "personal" — it's how solo-trip
data and a group member's own stuff stay separate from the group's shared data.

| Table                   | Key columns                                                                | Notes |
|--------------------------|------------------------------------------------------------------------|-------|
| `profiles`               | `id` (= auth.users.id), `username`, `display_name`, `gender`, `group_id`, `role`, `departure_date`, `share_location`, `last_location`, `seeded` | `group_id: null` = solo. |
| `groups`                 | `code`, `name`, `owner_uid`, `member_uids[]`, `start_date`, `end_date`   | `code` is the shareable join code (`KB-XXXX`). |
| `group_codes`            | `code`, `group_id`, `owner_uid`                                          | Join-code lookup. Readable by anyone signed in; only written by the `create_group()` RPC. |
| `documents`               | `owner_uid`, `group_id`, `name`, `category`, `source_type`, `url`, `storage_path` | `source_type`: `upload` (Supabase Storage) or `drive_link`. |
| `packing_bags`           | `owner_uid`, `name`, `items` (jsonb)                                     | `items`: `[{id, name, qty, in, out}]`. Always personal. `seed_key` is internal (default-template dedup). |
| `outfit_items`           | `owner_uid`, `category`, `name`, `qty`, `bag`, `done`                   | Seeded per-gender on first visit (`seed_outfit_items()` RPC; list also in `lib/defaults.ts`). |
| `supplies_items`         | `owner_uid`, `name`, `checked`                                          | The "Tambahan" (obat & keperluan) checklist, seeded with 22 defaults. |
| `itinerary_items`        | `group_id`, `day`, `time`, `title`, `status`, `options` (jsonb), `created_by` | `status: "voting"` uses `options` (`[{id, label, votes: [uid], proposedBy}]`); `status: "final"` uses `title` directly. Voting/adding an option/finalizing go through RPCs for atomicity. |
| `accommodation_options`  | `group_id`, `title`, `price_text`, `link`, `source`, `image_url`, `votes[]`, `proposed_by` | `image_url`/`title` filled in by the `link-unfurl` Edge Function. Votes/`chosen` only change via RPC or the Edge Function (service role) — no client UPDATE policy. |
| `expenses`                | `group_id`, `day`, `title`, `category`, `amount`, `paid_by`, `split_among[]` | Settle-up math lives client-side in `lib/settleUp.ts`. |
| `spots`                   | `area`, `category`, `name`, `ticket_price`, `duration_text`, `image_url`, `maps_url` | Curated from `/admin`. Target ~30 per category per area. |
| `favorites`               | `uid`, `spot_id` (composite primary key)                                | Primary key on `(uid, spot_id)`, so a favorite can't be duplicated. |
| `spot_submissions`        | `group_id`, `name`, `category`, `reference_links` (jsonb), `submitted_by`, `status` | Member-submitted places not yet in `spots`, with TikTok/IG/Maps reference links. |
| `activity_log`            | `group_id`, `actor_uid`, `actor_name`, `action`, `message`               | Powers `/history`. Append-only. |
| `announcements`           | `group_id`, `author_uid`, `message`                                      | Sent from `/admin`. |

## RPC functions (Postgres functions called via `supabase.rpc(...)`)

Used wherever a change needs to be atomic (the Postgres equivalent of the app's old Firestore
transactions/batches) or needs to touch a row the caller isn't normally allowed to write
directly:

- `username_available(p_username)` — pre-signup check.
- `create_group(p_name)`, `join_group_by_code(p_code, p_display_name)`, `leave_group()`.
- `cast_itinerary_vote(p_item_id, p_option_id)`, `add_itinerary_option(p_item_id, p_label)`, `finalize_itinerary(p_item_id, p_option_id)`.
- `vote_accommodation(p_option_id)`, `choose_accommodation(p_option_id)`.
- `seed_packing_bags()`, `seed_outfit_items()`, `seed_supplies_items()` — idempotent default-template seeders.

See `supabase/schema.sql` for the full definitions, Row Level Security policies, and the
Storage bucket config for `documents`.
