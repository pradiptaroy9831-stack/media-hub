# MediaHub

Photo and video hosting site. Needs Node.js 18 or newer.

    npm install
    npm start

Open http://localhost:3000. To use it from other devices on your network, open
http://<your-computer-ip>:3000 (note: phones on plain http can still upload, but
each browser is a separate "user", identified by an id stored in that browser).

- Uploads are saved in `uploads/`, post details in `data.json`.
- Max file size: 50 MB (change MAX_MB in server.js).
- One photo -> Images, one video -> Videos, several files -> Albums.
- Only the browser that made a post can delete it. This is browser-based
  identification, not real accounts. For a public site add login first.
