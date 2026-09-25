# MediaHub

Photo and video hosting site. Needs Node.js 18 or newer.

Uploaded files and post data are stored in Cloudflare R2 (free, no
credit card required for the free tier), so they survive restarts and
redeploys on free hosts like Render.

## 1. Create a free Cloudflare R2 bucket

1. Go to https://dash.cloudflare.com, sign up or log in (free).
2. In the left sidebar, go to R2 Object Storage, then Create bucket.
   Name it anything (e.g. `media-hub`). Leave default settings.
3. Open the bucket, go to Settings, and under "Public Access" enable the
   `r2.dev` public development URL. Copy that URL (looks like
   `https://pub-xxxxxxxx.r2.dev`) — this is your `R2_PUBLIC_URL`.
4. Back on the main R2 page, click "Manage R2 API Tokens" (or find API
   Tokens under your account), create a new API token with
   "Object Read & Write" permission, scoped to this bucket if possible.
5. Copy the three values it gives you: Account ID, Access Key ID, and
   Secret Access Key. You won't be able to see the secret again later.

## 2. Set environment variables

Wherever you run this (Render, or your own computer), set:

    R2_ACCOUNT_ID=<your account id>
    R2_ACCESS_KEY_ID=<your access key id>
    R2_SECRET_ACCESS_KEY=<your secret access key>
    R2_BUCKET=<your bucket name>
    R2_PUBLIC_URL=<your r2.dev public url, no trailing slash>

On Render: open your service, go to Environment, and add each one as a
key/value pair, then save (this triggers a redeploy).

Locally: export them in your terminal before starting, e.g. on
Mac/Linux:

    export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... R2_PUBLIC_URL=...
    npm start

## 3. Run it

    npm install
    npm start

Open http://localhost:3000 (or your Render URL). The server refuses to
start with a clear error naming any missing environment variable.

- All uploaded files live in your R2 bucket under a `media/` folder.
- Post details (captions, tags, who posted what) are stored as a single
  `posts.json` file in the same bucket, also surviving restarts.
- Max file size: 50 MB (change `MAX_MB` in server.js).
- One photo -> Images, one video -> Videos, several files -> Albums.
- Only the browser that made a post can delete it (a hidden ID stored
  in that browser, not a real account system). Deleting a post also
  deletes its files from R2.

## Costs to be aware of

R2's free tier includes 10 GB storage and no charge for data served to
users (unlike most cloud storage, R2 has no egress fees). For a small
personal site this comfortably stays free. If you go well beyond that,
Cloudflare's pricing page has current rates.
