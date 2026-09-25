const express = require('express'), multer = require('multer'), crypto = require('crypto'), path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const PORT = process.env.PORT || 3000;
const MAX_MB = 50;

const { STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET } = process.env;
for (const [k, v] of Object.entries({ STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET })) {
  if (!v) { console.error(`Missing required environment variable: ${k}. See README.md.`); process.exit(1); }
}
const POSTS_KEY = 'posts.json';

// Works with any S3-compatible storage (Backblaze B2, Cloudflare R2, etc) via env vars.
const s3 = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: STORAGE_ACCESS_KEY_ID, secretAccessKey: STORAGE_SECRET_ACCESS_KEY }
});

const streamToString = async stream => {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
};

let posts = [];
async function loadPosts() {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: POSTS_KEY }));
    posts = JSON.parse(await streamToString(r.Body));
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) posts = [];
    else throw e;
  }
}
async function savePosts() {
  await s3.send(new PutObjectCommand({
    Bucket: STORAGE_BUCKET, Key: POSTS_KEY, Body: JSON.stringify(posts, null, 1), ContentType: 'application/json'
  }));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 30 },
  fileFilter: (req, f, cb) => cb(null, /^(image|video)\//.test(f.mimetype))
}).array('files', 30);

const uid = req => String(req.get('x-user-id') || '').slice(0, 64);
// The owner id is never sent to other users; each client only learns "mine: true/false".
const view = (p, u) => ({ id: p.id, type: p.type, caption: p.caption, tags: p.tags, media: p.media.map(m => ({ url: m.url, kind: m.kind })), ts: p.ts, mine: !!u && p.owner === u });

async function putMedia(file) {
  const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const key = 'uploads/' + crypto.randomUUID() + ext;
  await s3.send(new PutObjectCommand({ Bucket: STORAGE_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
  return { key, url: `/media/${key}`, kind: file.mimetype.startsWith('video') ? 'video' : 'image' };
}
async function deleteMedia(list) {
  await Promise.all(list.map(m =>
    s3.send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: m.key })).catch(() => {})
  ));
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Streams a file straight from private storage. The bucket itself never
// needs to be public — only this server holds the storage credentials.
app.get('/media/*', async (req, res) => {
  const key = req.params[0];
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
    res.set('Content-Type', obj.ContentType || 'application/octet-stream');
    if (obj.ContentLength) res.set('Content-Length', obj.ContentLength);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    obj.Body.pipe(res);
  } catch (e) {
    res.status(404).end();
  }
});

app.get('/api/posts', (req, res) => res.json(posts.map(p => view(p, uid(req)))));

app.post('/api/posts', (req, res) => {
  upload(req, res, async err => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? `A file is over the ${MAX_MB} MB limit` : err.message
    });
    try {
      const owner = uid(req);
      const caption = String(req.body.caption || '').trim().slice(0, 150);
      let tags = [];
      try { tags = JSON.parse(req.body.tags || '[]'); } catch (e) {}
      tags = [...new Set(tags.filter(t => typeof t === 'string' && /^#[\p{L}\p{N}_]+$/u.test(t)).map(t => t.slice(0, 40)))].slice(0, 30);
      if (owner.length < 8) return res.status(400).json({ error: 'Missing user id' });
      if (!req.files || !req.files.length) return res.status(400).json({ error: 'No valid photos or videos' });
      if (!caption) return res.status(400).json({ error: 'Caption is required' });
      if (!tags.length) return res.status(400).json({ error: 'At least one hashtag is required' });

      const media = await Promise.all(req.files.map(putMedia));
      // One photo -> Images, one video -> Videos, anything else -> Albums
      const type = media.length === 1 ? media[0].kind : 'album';
      const post = { id: crypto.randomUUID(), type, caption, tags, media, owner, ts: Date.now() };
      posts.push(post);
      await savePosts();
      res.status(201).json(view(post, owner));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Upload failed on the server' });
    }
  });
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const p = posts.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (p.owner !== uid(req)) return res.status(403).json({ error: 'You can only delete your own uploads' });
    posts = posts.filter(x => x !== p);
    await savePosts();
    deleteMedia(p.media);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed on the server' });
  }
});

loadPosts()
  .then(() => app.listen(PORT, () => console.log(`MediaHub running at http://localhost:${PORT}`)))
  .catch(e => { console.error('Could not load posts from storage on startup:', e.message); process.exit(1); });
