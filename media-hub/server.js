const express = require('express'), multer = require('multer');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_MB = 50;
const UPLOADS = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'data.json');

fs.mkdirSync(UPLOADS, { recursive: true });
let posts = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : [];
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(posts, null, 1));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, f, cb) =>
      cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, ''))
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 30 },
  fileFilter: (req, f, cb) => cb(null, /^(image|video)\//.test(f.mimetype))
}).array('files', 30);

const uid = req => String(req.get('x-user-id') || '').slice(0, 64);
// The owner id is never sent to other users; each client only learns "mine: true/false".
const view = (p, u) => ({ id: p.id, type: p.type, caption: p.caption, tags: p.tags, media: p.media, ts: p.ts, mine: !!u && p.owner === u });
const rmFiles = list => list.forEach(f => fs.unlink(path.join(UPLOADS, path.basename(f)), () => {}));

const app = express();
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/posts', (req, res) => res.json(posts.map(p => view(p, uid(req)))));

app.post('/api/posts', (req, res) => {
  upload(req, res, err => {
    const names = (req.files || []).map(f => f.filename);
    const fail = (code, msg) => { rmFiles(names); res.status(code).json({ error: msg }); };
    if (err) return fail(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
      err.code === 'LIMIT_FILE_SIZE' ? `A file is over the ${MAX_MB} MB limit` : err.message);
    const owner = uid(req);
    const caption = String(req.body.caption || '').trim().slice(0, 150);
    let tags = [];
    try { tags = JSON.parse(req.body.tags || '[]'); } catch (e) {}
    tags = [...new Set(tags.filter(t => typeof t === 'string' && /^#[\p{L}\p{N}_]+$/u.test(t)).map(t => t.slice(0, 40)))].slice(0, 30);
    if (owner.length < 8) return fail(400, 'Missing user id');
    if (!req.files || !req.files.length) return fail(400, 'No valid photos or videos');
    if (!caption) return fail(400, 'Caption is required');
    if (!tags.length) return fail(400, 'At least one hashtag is required');
    const media = req.files.map(f => ({ url: '/uploads/' + f.filename, kind: f.mimetype.startsWith('video') ? 'video' : 'image' }));
    // One photo -> Images, one video -> Videos, anything else -> Albums
    const type = media.length === 1 ? media[0].kind : 'album';
    const post = { id: crypto.randomUUID(), type, caption, tags, media, owner, ts: Date.now() };
    posts.push(post); save();
    res.status(201).json(view(post, owner));
  });
});

app.delete('/api/posts/:id', (req, res) => {
  const p = posts.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (p.owner !== uid(req)) return res.status(403).json({ error: 'You can only delete your own uploads' });
  rmFiles(p.media.map(m => m.url));
  posts = posts.filter(x => x !== p); save();
  res.status(204).end();
});

app.listen(PORT, () => console.log(`MediaHub running at http://localhost:${PORT}`));
