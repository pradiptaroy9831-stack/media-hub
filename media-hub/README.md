# MediaHub

Photo and video hosting site. Needs Node.js 18 or newer.

Uploaded files and post data are stored in S3-compatible cloud storage,
kept **private**. Your own server fetches each file with its storage
credentials and streams it to visitors, so the bucket itself never
needs to be made public — this avoids Backblaze's and Cloudflare's
"pay a small fee to unlock public buckets" requirement entirely.

## 1. Create a free Backblaze B2 account (no card needed)

1. Go to https://www.backblaze.com/sign-up/cloud-storage and sign up.
   No credit card is required for this.
2. Once logged in, go to the B2 Cloud Storage section and click
   Create a Bucket. Name it anything unique (e.g. `my-media-hub-2026`).
   Leave it set to **Private** — you do not need Public, and turning
   it Public is the step that asks for payment info, so skip it.
3. After creating it, open the bucket's details and note down:
   - The **Endpoint**, e.g. `s3.us-west-004.backblazeb2.com`
   - The **Bucket Unique Name** (what you named it)
4. Go to "Application Keys" in the left menu, click
   "Add a New Application Key". Give it access to just this bucket,
   with Read and Write permission. Create it, then copy the
   **keyID** and **applicationKey** shown — the applicationKey is
   only shown once.

## 2. Set environment variables

Wherever you run this (Render, or your own computer), set:

    STORAGE_ENDPOINT=https://s3.us-west-004.backblazeb2.com
    STORAGE_REGION=us-west-004
    STORAGE_ACCESS_KEY_ID=<the keyID from step 1.4>
    STORAGE_SECRET_ACCESS_KEY=<the applicationKey from step 1.4>
    STORAGE_BUCKET=<your bucket's unique name>

Use exactly what your bucket's details page shows for the endpoint and
region (the region code, like `us-west-004`, is embedded in the
endpoint hostname).

On Render: open your service, go to Environment, add each one as a
key/value pair, then save (this triggers a redeploy).

Locally: export them in your terminal before starting, e.g. on
Mac/Linux:

    export STORAGE_ENDPOINT=... STORAGE_REGION=... STORAGE_ACCESS_KEY_ID=... STORAGE_SECRET_ACCESS_KEY=... STORAGE_BUCKET=...
    npm start

## 3. Run it

    npm install
    npm start

Open http://localhost:3000 (or your Render URL). The server refuses to
start with a clear error naming any missing environment variable.

- Uploaded files live in your bucket under an `uploads/` folder, and
  are served to visitors at `/media/uploads/<file>` by your own app
  (never a direct storage link) — no public bucket needed.
- Post details (captions, tags, who posted what) are stored as a single
  `posts.json` file in the same bucket, also surviving restarts.
- Max file size: 50 MB (change `MAX_MB` in server.js).
- One photo -> Images, one video -> Videos, several files -> Albums.
- Only the browser that made a post can delete it (a hidden ID stored
  in that browser, not a real account system). Deleting a post also
  deletes its files from storage.

## Using Cloudflare R2 instead

If you later get a card and prefer R2, the same code works — just set:

    STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
    STORAGE_REGION=auto
    STORAGE_ACCESS_KEY_ID=<R2 access key id>
    STORAGE_SECRET_ACCESS_KEY=<R2 secret access key>
    STORAGE_BUCKET=<bucket name>

The bucket can stay private here too, since the app streams files
itself either way.

## Costs to be aware of

Backblaze B2's free tier: 10 GB storage, free egress up to 3x your
average stored data per month, no minimum storage duration. For a
small personal site this comfortably stays free. If you go well
beyond that, Backblaze's pricing page has current rates.
