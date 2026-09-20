# Admin-managed jukebox

Local implementation, not published. No production database or music records changed.

## Use

Open Staff command, then Jukebox music. Admins can upload MP3, M4A, Ogg or WAV audio up to 25 MB per track. Uploads start as drafts. Load the audio preview, then Publish to jukebox. Edit title, artist and play order in the playlist. Unpublish retains the file and draft for later use.

Members have Play/Pause, Next, track selection, saved volume and playlist refresh. Playback starts only after Play, then advances through the playlist. There is no member file picker, local-object URL handling or unmanaged music.json fallback.

## Before release

1. Reconcile the existing unpublished website work before any deployment.
2. Apply `site/db/0060_admin_jukebox.sql` to the connected Supabase project through the approved migration workflow. It creates a private audio bucket, playlist table, admin-only management function and storage guards.
3. Confirm the existing personnel audit retention migration is installed. Jukebox saves use the same audit table and its existing 75-entry cap; this migration does not trim old records separately.
4. Publish the frontend through the normal repository release workflow.
5. With an admin account, upload an authorised test track, preview and publish it. In a separate member session verify playback, Next, pause/resume, ordering and removal after Unpublish. No real audio was supplied for this local change, so a live Storage/API round trip remains a release check.

## Access and behaviour

- Only the database's current admin identity can upload or save tracks. Moderators and players cannot. The UI role check is only presentation.
- Authenticated members can read published rows and sign published audio URLs. Drafts are visible only to admins. Signed playback URLs expire after one hour; an already-issued URL may remain playable until expiry after unpublishing.
- Visible jukeboxes refresh their playlist every minute, on tab focus, and on Refresh playlist. A withdrawn current track stops on refresh. Background tabs refresh when brought back into view.
- Audio objects cannot be overwritten or deleted while attached to a track. Failed registration cleans up only a confirmed orphan. A lost response is checked before cleanup so successful uploads are not destroyed.
- Restrictive storage policies scope the upload restriction to this bucket even if an older permissive policy grants general access elsewhere.
- File type and size checks exist in the form, bucket and registration function. These validate declared audio metadata, not copyright or malware scanning. Admins should preview and upload only music they are allowed to share.
- `AdminWorkspace.tsx` adds music management without editing the separately claimed `Admin.tsx`.

## Verification

- `node --test site/tests/jukebox.test.mjs`: validation, upload-as-draft, lost-response cleanup, member filtering, signed links, no local picker, admin-only UI.
- `node site/scripts/test-jukebox-db.mjs`: isolated PostgreSQL migration and role/storage tests, including an intentionally broad legacy policy. Uses synthetic objects, not the hosted Storage HTTP service.
- `npm run build --prefix site` and the complete website test suite.
