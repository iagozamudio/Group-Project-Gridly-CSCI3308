// // tmp.js — Gridly application server
// // ─────────────────────────────────────────────────────────────────────────────
// // This file is both the web-app entry point (started by nodemon via npm start)
// // AND the module imported by test/server.spec.js (via require('../tmp')).
// //
// // Design rule: if the incoming request carries Content-Type: application/json
// // (which chai-http sets automatically when you call .send(object)), the route
// // returns a JSON response with the correct HTTP status code.
// // Browser form submissions (Content-Type: application/x-www-form-urlencoded)
// // get redirects / rendered pages as normal.
// // ─────────────────────────────────────────────────────────────────────────────

// const express       = require('express');
// const path          = require('path');
// const pgp           = require('pg-promise')();
// const bodyParser    = require('body-parser');
// const session       = require('express-session');
// const bcrypt        = require('bcryptjs');
// const handlebars    = require('express-handlebars');
// const fs = require('fs');
// const multer = require('multer');

// const app  = express();
// const PORT = 3000;

// // ── Database ──────────────────────────────────────────────────────────────────
// const db = pgp({
//   host:     'db',
//   port:     5432,
//   database: process.env.POSTGRES_DB,
//   user:     process.env.POSTGRES_USER,
//   password: process.env.POSTGRES_PASSWORD,
// });

// db.connect()
//   .then(obj => { console.log('DB connected!'); obj.done(); })
//   .catch(err => console.log('DB ERROR:', err.message));

// // ── Handlebars ────────────────────────────────────────────────────────────────
// const hbs = handlebars.create({
//   extname:     'hbs',
//   layoutsDir:  path.join(__dirname, 'views', 'layouts'),
//   partialsDir: path.join(__dirname, 'views', 'partials'),
// });
// app.engine('hbs', hbs.engine);
// app.set('view engine', 'hbs');
// app.set('views', path.join(__dirname, 'views'));

// // ── Middleware ────────────────────────────────────────────────────────────────
// app.use(express.static(path.join(__dirname)));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(session({
//   secret:           process.env.SESSION_SECRET || 'gridly_dev_secret',
//   saveUninitialized: false,
//   resave:           false,
// }));

// // Essentailly multer configuration for handling profile picture uploads in the Settings page.
// const uploadDir = path.join(__dirname, 'img', 'uploads');

// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadDir),
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${req.session.user.username}-${Date.now()}${ext}`);
//   }
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 800 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowed = /jpeg|jpg|png|gif/;
//     const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
//     const mimeOk = allowed.test(file.mimetype);
//     if (extOk && mimeOk) return cb(null, true);
//     cb(new Error('Only image files are allowed'));
//   }
// });

// // ── Helper ────────────────────────────────────────────────────────────────────
// // chai-http .send(object) automatically sets Content-Type: application/json,
// // so this check correctly detects API / test calls vs. browser form POSTs.
// const wantsJson = (req) =>
//   !!req.is('application/json') ||
//   !!(req.headers.accept && req.headers.accept.includes('application/json'));

// // ── Auth guard (web pages only) ───────────────────────────────────────────────
// const auth = (req, res, next) => {
//   if (!req.session.user) return res.redirect('/login');
//   next();
// };

// // ═════════════════════════════════════════════════════════════════════════════
// // ROUTES
// // ═════════════════════════════════════════════════════════════════════════════

// // ── Default probe — required by the starter test case in server.spec.js ──────
// app.get('/welcome', (req, res) => {
//   res.json({ status: 'success', message: 'Welcome!' });
// });

// app.get('/', (req, res) => res.redirect('/login'));

// // ── Page renders ─────────────────────────────────────────────────────────────
// app.get('/login',    (req, res) => res.render('pages/login'));
// app.get('/register', (req, res) => res.render('pages/register'));
// app.get('/leaderboard', (req, res) => {res.render('pages/leaderboard');});

// //single player page route
// app.get('/singleplayer', auth, (req, res) => res.render('pages/SinglePlayer', { layout: false }));



// // ── POST /register ────────────────────────────────────────────────────────────
// //
// //  Positive case  → 200  { message: 'Success' }
// //  Negative cases → 400  { message: 'Invalid input' }
// //     • missing username or password (catches empty-string '')
// //     • duplicate username already in DB
// app.post('/register', async (req, res) => {
//   const { username, password, securityQuestion, securityAnswer } = req.body;

//   // ── 1. Field validation ────────────────────────────────────────────────────
//   if (!username || !password) {
//     if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
//     return res.redirect('/register');
//   }

//   try {
//     // ── 2. Duplicate check ───────────────────────────────────────────────────
//     const existing = await db.oneOrNone(
//       'SELECT username FROM users WHERE username = $1',
//       [username]
//     );
//     if (existing) {
//       if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
//       return res.redirect('/register');
//     }

//     // ── 3. Hash & insert ─────────────────────────────────────────────────────
//     const hash = await bcrypt.hash(password, 10);
//     await db.none(
//       'INSERT INTO users (username, password) VALUES ($1, $2)',
//       [username, hash]
//     );

//     // ── 4. Security question (web form only — API tests don't send it) ───────
//     if (!wantsJson(req) && securityQuestion && securityAnswer) {
//       await db.none(
//         'INSERT INTO security_questions (username, question, answer) VALUES ($1, $2, $3)',
//         [username, securityQuestion, securityAnswer]
//       );
//     }

//     if (wantsJson(req)) return res.status(200).json({ message: 'Success' });
//     return res.redirect('/login');

//   } catch (err) {
//     console.error('Registration error:', err.message);
//     if (wantsJson(req)) return res.status(500).json({ message: 'Server error' });
//     return res.redirect('/register');
//   }
// });

// // ── POST /login ───────────────────────────────────────────────────────────────
// //
// //  Positive case  → 200  { message: 'Login successful', username }
// //  Negative cases → 400  { message: 'Invalid credentials' }
// //     • username not found in DB
// //     • password does not match stored hash
// app.post('/login', async (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
//     return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
//   }

//   try {
//     const user = await db.oneOrNone(
//       'SELECT * FROM users WHERE username = $1',
//       [username]
//     );

//     if (!user) {
//       if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
//       return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
//     }

//     const match = await bcrypt.compare(password, user.password);
//     if (!match) {
//       if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
//       return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
//     }

//     // Success
//     req.session.user = user;
//     req.session.save();

//     if (wantsJson(req)) return res.status(200).json({ message: 'Login successful', username: user.username });
//     return res.redirect('/home');

//   } catch (err) {
//     console.error('Login error:', err.message);
//     if (wantsJson(req)) return res.status(500).json({ message: 'Server error' });
//     return res.redirect('/login');
//   }
// });

// // ── Authenticated pages ───────────────────────────────────────────────────────
// app.get('/home',   auth, (req, res) => res.render('pages/home', { user: req.session.user }));
// app.get('/logout', auth, (req, res) => { req.session.destroy(); res.redirect('/login'); });
// app.get('/profile', auth, (req, res) => {res.render('pages/Profile', { user: req.session.user});});
// app.get('/Settings', auth, (req, res) => {res.render('pages/Settings', { user: req.session.user, pageCSS: '<link rel="stylesheet" href="/css/settings.css">'});});
// // ── Forgot-password flow ──────────────────────────────────────────────────────
// const questionMap = {
//   q1: 'What was the name of your first pet?',
//   q2: 'What city were you born in?',
//   q3: "What is your mother's maiden name?",
//   q4: 'What was the make of your first car?',
// };

// app.get('/forgot-password', (req, res) => res.render('pages/forgot-password'));

// app.post('/forgot-password', async (req, res) => {
//   try {
//     const row = await db.oneOrNone(
//       'SELECT question FROM security_questions WHERE username = $1',
//       [req.body.username]
//     );
//     if (!row) {
//       return res.render('pages/forgot-password', { message: 'Username not found.', error: true });
//     }
//     res.render('pages/forgot-password', {
//       question:     row.question,
//       questionText: questionMap[row.question] || row.question,
//       username:     req.body.username,
//     });
//   } catch (err) {
//     res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
//   }
// });

// app.post('/verify-answer', async (req, res) => {
//   try {
//     const row = await db.oneOrNone(
//       'SELECT answer FROM security_questions WHERE username = $1 AND question = $2',
//       [req.body.username, req.body.question]
//     );
//     if (!row || row.answer.toLowerCase() !== req.body.securityAnswer.toLowerCase()) {
//       return res.render('pages/forgot-password', { message: 'Incorrect answer.', error: true });
//     }
//     res.render('pages/forgot-password', { resetReady: true, username: req.body.username });
//   } catch (err) {
//     res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
//   }
// });

// app.post('/reset-password', async (req, res) => {
//   const { username, newPassword, confirmPassword } = req.body;
//   if (newPassword !== confirmPassword) {
//     return res.render('pages/forgot-password', {
//       message: 'Passwords do not match.', error: true, resetReady: true, username,
//     });
//   }
//   try {
//     const hash = await bcrypt.hash(newPassword, 10);
//     await db.none('UPDATE users SET password = $1 WHERE username = $2', [hash, username]);
//     res.render('pages/login', { message: 'Password reset successful. Please log in.', error: false });
//   } catch (err) {
//     res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
//   }
// });

// // ── Test-only cleanup route (DELETE a user by username) ───────────────────────
// // Only active when NODE_ENV is not 'production' so it can never run in prod
// app.post('/test-cleanup', async (req, res) => {
//   if (process.env.NODE_ENV === 'production') return res.status(404).end();
//   try {
//     await db.none('DELETE FROM users WHERE username = $1', [req.body.username]);
//     return res.status(200).json({ message: 'Cleaned' });
//   } catch (err) {
//     return res.status(500).json({ message: err.message });
//   }
// });

// // ── POST /game-session  (save a completed puzzle) ─────────────────────────────
// app.post('/game-session', async (req, res) => {
//   const { time_seconds } = req.body;
//   const username = req.session.user?.username ?? null; // null = guest

//   if (typeof time_seconds !== 'number' || time_seconds < 0) {
//     return res.status(400).json({ message: 'Invalid time' });
//   }

//   try {
//     const row = await db.one(
//       `INSERT INTO game_sessions (username, time_seconds)
//        VALUES ($1, $2)
//        RETURNING session_id, time_seconds, completed_at`,
//       [username, time_seconds]
//     );
//     return res.status(201).json({ message: 'Saved', session: row });
//   } catch (err) {
//     console.error('Save session error:', err.message);
//     return res.status(500).json({ message: 'Server error' });
//   }
// });

// // ── GET /api/leaderboard  (top 20 fastest completions) ───────────────────────
// app.get('/api/leaderboard', async (req, res) => {
//   try {
//     const rows = await db.any(
//       `SELECT COALESCE(username, 'Guest') AS username,
//               time_seconds,
//               completed_at
//        FROM game_sessions
//        ORDER BY time_seconds ASC
//        LIMIT 20`
//     );
//     return res.json(rows);
//   } catch (err) {
//     console.error('Leaderboard error:', err.message);
//     return res.status(500).json({ message: 'Server error' });
//   }
// });

// // Uploading the profile image in the Settings page. Uses multer middleware to handle file uploads and updates the user's profile_image path in the database.
// app.post('/upload-profile-image', auth, upload.single('profileImage'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.redirect('/Settings');
//     }

//     const imagePath = `/img/uploads/${req.file.filename}`;

//     await db.none(
//       'UPDATE users SET profile_image = $1 WHERE username = $2',
//       [imagePath, req.session.user.username]
//     );

//     req.session.user.profile_image = imagePath;

//     return res.redirect('/Settings');
//   } catch (err) {
//     console.error('Upload error:', err.message);
//     return res.redirect('/Settings');
//   }
// });

// // ═════════════════════════════════════════════════════════════════════════════
// // EXPORT — must be app.listen(), not just app, so chai-http can bind to it
// // ═════════════════════════════════════════════════════════════════════════════
// module.exports = app.listen(PORT);
// console.log(`Gridly running on port ${PORT}`);
// tmp.js — Gridly application server
// tmp.js — Gridly application server

const express       = require('express');
const path          = require('path');
const pgp           = require('pg-promise')();
const bodyParser    = require('body-parser');
const session       = require('express-session');
const bcrypt        = require('bcryptjs');
const handlebars    = require('express-handlebars');
const fs            = require('fs');
const multer        = require('multer');
const http = require('http');
const WebSocket = require('ws');
const { receiveMessageOnPort } = require('worker_threads');

const sessionParser = session({
  secret: "your-secret",
  resave: false,
  saveUninitialized: false,
});


const app  = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
const PORT = 3000;

const clients = new Map();
wss.on("connection", (ws, req) => {
  sessionParser(req, {}, () => {
    if (!req.session || !req.session.user) {
      ws.close();
      return;
    }

    const username = req.session.user.username;
    ws.username = username;

    clients.set(username, ws);

    console.log("WebSocket connected:", username);

    ws.send(JSON.stringify({ type: "system", text: "Connected" }));

    ws.on("message", (message) => { // when message is recieved from user to websocket server
      let messageJSON;

      try {
        messageJSON = JSON.parse(message);
      } catch {
        return;
      }

      if (messageJSON.type === "chat") { // in the future game info will be sent, so other cases will be available as well
        const recipient = clients.get(messageJSON.recipient); // pull recipient socket instance from map

        if (messageJSON.recipient == "*") { // temporary send to all users case; once multiplayer is ready delete
          const outgoing = {
            type: "chat",
            sender: username,
            text: messageJSON.text
          };
          for (const [recipientUsername, client] of clients.entries()) { // send to all connected users
            if (recipientUsername != username) {
              client.send(JSON.stringify(outgoing));
            }
          };
          const successMessage = { // success msg to return to sender
            type: "chat",
            sender: username,
            text: messageJSON.text,
            status: "success"
          };
          ws.send(JSON.stringify(successMessage));
        } else if (!recipient) { // if recipient socket not found in clients map (e.g. they have disconnected or dont exist)
          ws.send(JSON.stringify({
            type: "chat",
            status: "failure",
            text: "Recipient not connected"
          }));
        } else {
          const messageToRecipient = {
            type: "chat",
            sender: username,
            text: messageJSON.text
          };

          recipient.send(JSON.stringify(messageToRecipient));
          const successMessage = {
            type: "chat",
            sender: username,
            text: messageJSON.text,
            status: "success"
          };
          ws.send(JSON.stringify(successMessage)); // success message is important; how else would the sender know whether or not their message has been sent, and whether or not it should be rendered in chat?
        }
      }

      console.log("Received:", message.toString());
    });

    ws.on("close", () => {
      console.log("Client disconnected:", ws.username);
      clients.delete(ws.username); // clients map only stores current (live) sockets
    });
  });
});

// ── Database ──────────────────────────────────────────────────────────────────
const db = pgp({
  host:     'db',
  port:     5432,
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

db.connect()
  .then(obj => { console.log('DB connected!'); obj.done(); })
  .catch(err => console.log('DB ERROR:', err.message));

// ── Handlebars ────────────────────────────────────────────────────────────────
const hbs = handlebars.create({
  extname:     'hbs',
  layoutsDir:  path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
});

hbs.handlebars.registerHelper("json", function (context) {
  return JSON.stringify(context);
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionParser);

// ── Multer config for profile uploads ────────────────────────────────────────
const uploadDir = path.join(__dirname, 'img', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.session.user.username}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 800 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);

    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
// JSON requests from tests should get JSON responses.
// Browser form submits should still get redirects / rendered pages.
const wantsJson = (req) =>
  !!req.is('application/json') ||
  !!(req.headers.accept && req.headers.accept.includes('application/json'));

// ── Auth guard ────────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// Required by your tests
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.get('/', (req, res) => res.redirect('/login'));

// ── Page renders ─────────────────────────────────────────────────────────────
app.get('/login', (req, res) => res.render('pages/login'));
app.get('/register', (req, res) => res.render('pages/register'));
app.get('/leaderboard', (req, res) => res.render('pages/leaderboard'));
app.get('/singleplayer', auth, (req, res) =>
  res.render('pages/SinglePlayer', { layout: false, user: req.session.user  })
);
app.get('/lobby', auth, (req, res) =>
  res.render('pages/lobby', { layout: false, user: req.session.user})
);
app.get('/twoplayer', auth, (req, res) =>
  res.render('pages/TwoPlayer', { layout: false, user: req.session.user  })
);
// ── POST /register ────────────────────────────────────────────────────────────
//
//  Positive case  → 200  { message: 'Success' }
//  Negative cases → 400  { message: 'Invalid input' }
//     • missing username or password (catches empty-string '')
//     • duplicate username already in DB
app.post('/register', async (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;

  if (!username || !password) {
    if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
    return res.redirect('/register');
  }

  try {
    const existing = await db.oneOrNone(
      'SELECT username FROM users WHERE username = $1',
      [username]
    );

    if (existing) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, 10);

    await db.none(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hash]
    );

    if (!wantsJson(req) && securityQuestion && securityAnswer) {
      await db.none(
        'INSERT INTO security_questions (username, question, answer) VALUES ($1, $2, $3)',
        [username, securityQuestion, securityAnswer]
      );
    }

    if (wantsJson(req)) return res.status(200).json({ message: 'Success' });
    return res.redirect('/login');

  } catch (err) {
    console.error('Registration error:', err.message);
    if (wantsJson(req)) return res.status(500).json({ message: 'Server error' });
    return res.redirect('/register');
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
    return res.render('pages/login', {
      message: 'Incorrect username or password.',
      error: true
    });
  }

  try {
    const user = await db.oneOrNone(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (!user) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
      return res.render('pages/login', {
        message: 'Incorrect username or password.',
        error: true
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
      return res.render('pages/login', {
        message: 'Incorrect username or password.',
        error: true
      });
    }

    req.session.user = user;
    req.session.save();

    if (wantsJson(req)) {
      return res.status(200).json({
        message: 'Login successful',
        username: user.username
      });
    }

    return res.redirect('/home');

  } catch (err) {
    console.error('Login error:', err.message);
    if (wantsJson(req)) return res.status(500).json({ message: 'Server error' });
    return res.redirect('/login');
  }
});

// ── Authenticated pages ──────────────────────────────────────────────────────
app.get('/home', auth, (req, res) =>
  res.render('pages/home', { user: req.session.user })
);

app.get('/logout', auth, (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/profile', auth, (req, res) =>
  res.render('pages/Profile', { user: req.session.user })
);

app.get('/Settings', auth, (req, res) =>
  res.render('pages/Settings', {
    user: req.session.user,
    pageCSS: '<link rel="stylesheet" href="/css/settings.css">'
  })
);

// ── Forgot password flow ─────────────────────────────────────────────────────
const questionMap = {
  q1: 'What was the name of your first pet?',
  q2: 'What city were you born in?',
  q3: "What is your mother's maiden name?",
  q4: 'What was the make of your first car?',
};

app.get('/forgot-password', (req, res) => res.render('pages/forgot-password'));

app.post('/forgot-password', async (req, res) => {
  try {
    const row = await db.oneOrNone(
      'SELECT question FROM security_questions WHERE username = $1',
      [req.body.username]
    );

    if (!row) {
      return res.render('pages/forgot-password', {
        message: 'Username not found.',
        error: true
      });
    }

    return res.render('pages/forgot-password', {
      question: row.question,
      questionText: questionMap[row.question] || row.question,
      username: req.body.username,
    });
  } catch (err) {
    return res.render('pages/forgot-password', {
      message: 'An error occurred.',
      error: true
    });
  }
});

app.post('/verify-answer', async (req, res) => {
  try {
    const row = await db.oneOrNone(
      'SELECT answer FROM security_questions WHERE username = $1 AND question = $2',
      [req.body.username, req.body.question]
    );

    if (!row || row.answer.toLowerCase() !== req.body.securityAnswer.toLowerCase()) {
      return res.render('pages/forgot-password', {
        message: 'Incorrect answer.',
        error: true
      });
    }

    return res.render('pages/forgot-password', {
      resetReady: true,
      username: req.body.username
    });
  } catch (err) {
    return res.render('pages/forgot-password', {
      message: 'An error occurred.',
      error: true
    });
  }
});

app.post('/reset-password', async (req, res) => {
  const { username, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('pages/forgot-password', {
      message: 'Passwords do not match.',
      error: true,
      resetReady: true,
      username,
    });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.none(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hash, username]
    );

    return res.render('pages/login', {
      message: 'Password reset successful. Please log in.',
      error: false
    });
  } catch (err) {
    return res.render('pages/forgot-password', {
      message: 'An error occurred.',
      error: true
    });
  }
});

// ── Test cleanup route ───────────────────────────────────────────────────────
app.post('/test-cleanup', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();

  try {
    await db.none('DELETE FROM users WHERE username = $1', [req.body.username]);
    return res.status(200).json({ message: 'Cleaned' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── Save game session ────────────────────────────────────────────────────────
app.post('/game-session', async (req, res) => {
  const { time_seconds, puzzle_data } = req.body;
  const username = req.session.user?.username ?? null; // null = guest

  if (typeof time_seconds !== 'number' || time_seconds < 0) {
    return res.status(400).json({ message: 'Invalid time' });
  }

  try {
    const row = await db.one(
      `INSERT INTO game_sessions (username, time_seconds, puzzle_data)
       VALUES ($1, $2, $3)
       RETURNING session_id, time_seconds, completed_at, puzzle_data`,
      [username, time_seconds, puzzle_data ? JSON.stringify(puzzle_data) : null]
    );

    return res.status(201).json({ message: 'Saved', session: row });
  } catch (err) {
    console.error('Save session error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Leaderboard API ──────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await db.any(
      `SELECT COALESCE(username, 'Guest') AS username,
              time_seconds,
              completed_at
       FROM game_sessions
       ORDER BY time_seconds ASC
       LIMIT 20`
    );

    return res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Upload profile image ─────────────────────────────────────────────────────
app.post('/upload-profile-image', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/Settings');
    }

    const imagePath = `/img/uploads/${req.file.filename}`;

    await db.none(
      'UPDATE users SET profile_image = $1 WHERE username = $2',
      [imagePath, req.session.user.username]
    );

    req.session.user.profile_image = imagePath;

    return res.redirect('/Settings');
  } catch (err) {
    console.error('Upload error:', err.message);
    return res.redirect('/Settings');
  }
});

// ── Export server ─────────────────────────────────────────────────────────────
// ── GET /api/game-session/:id  (retrieve a saved puzzle by session ID) ────────
app.get('/api/game-session/:id', auth, async (req, res) => {
  try {
    const row = await db.oneOrNone(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Not found' });
    return res.json(row);
  } catch (err) {
    console.error('Get session error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Crossword generation ──────────────────────────────────────────────────────
const crosswordClues = [
  { clue: "Declare publicly", answer: "AVOW" },
  { clue: "Opposite of yes", answer: "NO" },
  { clue: "Prefix meaning again", answer: "RE" },
  { clue: "Not off", answer: "ON" },
  { clue: "Consumed", answer: "ATE" },
  { clue: "Frozen water", answer: "ICE" },
  { clue: "Direction of sunrise", answer: "EAST" },
  { clue: "Negative reply", answer: "NAH" },
  { clue: "Before, poetically", answer: "ERE" },
  { clue: "Exist", answer: "ARE" },
  { clue: "A large body of water", answer: "SEA" },
  { clue: "Opposite of out", answer: "IN" },
  { clue: "Actor's role", answer: "PART" },
  { clue: "Quick bite", answer: "NOSH" },
  { clue: "Casual greeting", answer: "HEY" },
  { clue: "Feline pet", answer: "CAT" },
  { clue: "Canine pet", answer: "DOG" },
  { clue: "Bird's home", answer: "NEST" },
  { clue: "Ocean movement", answer: "TIDE" },
  { clue: "Make a mistake", answer: "ERR" },
  { clue: "Therefore", answer: "SO" },
  { clue: "Not old", answer: "NEW" },
  { clue: "To have travelled to or existed as", answer: "BEEN" },
  { clue: "Opposite of high", answer: "LOW" },
  { clue: "Unit of time", answer: "SEC" },
  { clue: "Musical pause", answer: "REST" },
  { clue: "Anger", answer: "IRE" },
  { clue: "Writing tool", answer: "PEN" },
  { clue: "Not fast", answer: "SLOW" },
  { clue: "Shiny metal", answer: "TIN" },
  { clue: "Baby bed", answer: "CRIB" },
  { clue: "Sound of hesitation", answer: "UM" },
  { clue: "Affirmative vote", answer: "YEA" },
  { clue: "Opposite of wet", answer: "DRY" },
  { clue: "A shape with no corners", answer: "RING" },
  { clue: "38th US president", answer: "FORD" },
  { clue: "To put in your hands", answer: "HOLD" },
  { clue: "Opposite of in", answer: "OUT" },
  { clue: "Attempt", answer: "TRY" },
  { clue: "Above the rest", answer: "BEST" },
  { clue: "Small child", answer: "TOT" },
  { clue: "Friend", answer: "PAL" },
  { clue: "Enemy", answer: "FOE" },
  { clue: "Mother", answer: "MA" },
  { clue: "Father", answer: "PA" },
  { clue: "Adult boys", answer: "MEN" },
  { clue: "Beverage holder", answer: "MUG" },
  { clue: "Opposite of begin", answer: "END" },
  { clue: "Before now", answer: "AGO" },
  { clue: "To be done incredibly quickly", answer: "ASAP" },
  { clue: "Amusing, entertaining, or enjoyable", answer: "FUN" },
  { clue: "The chickens have gone where to roost?", answer: "HOME" },
  { clue: "Part of the eye", answer: "IRIS" },
  { clue: "To conceal", answer: "HIDE" },
  { clue: "Stalker fan", answer: "STAN" },
  { clue: "Abbreviation for exclaiming surprise", answer: "OMG" },
  { clue: "Compass dir.", answer: "SSW" },
  { clue: "Irritate; annoy", answer: "IRK" },
  { clue: "Opposite of many", answer: "FEW" },
  { clue: "Opposite of full", answer: "VOID" },
  { clue: "To remove dry powder from a surface by wiping it", answer: "DUST" },
  { clue: "Opposite of soft", answer: "HARD" },
  { clue: "Texter's approval", answer: "YEP" },
  { clue: "Compass dir.", answer: "WNW" },
  { clue: "Farm sound", answer: "MOO" },
  { clue: "Dog sound", answer: "ARF" },
  { clue: "Cat sound", answer: "MEOW" },
  { clue: "Makes things unclean", answer: "DIRT" },
  { clue: "Opposite of light", answer: "DARK" },
  { clue: "Opposite of new", answer: "OLD" },
  { clue: "Opposite of kind", answer: "MEAN" },
  { clue: "Short nap", answer: "NAP" },
  { clue: "Look at", answer: "SEE" },
  { clue: "To move quickly", answer: "RUN" },
  { clue: "To move slowly", answer: "WALK" },
  { clue: "To create", answer: "MAKE" },
  { clue: "Morning drink", answer: "TEA" },
  { clue: "Bread spread", answer: "JAM" },
  { clue: "Soup container", answer: "BOWL" },
  { clue: "Opposite of win", answer: "LOSE" },
  { clue: "Opposite of love", answer: "HATE" },
  { clue: "Push or", answer: "PULL" },
  { clue: "Opposite of buy", answer: "SELL" },
  { clue: "Opposite of laugh", answer: "CRY" },
  { clue: "Water falling from sky", answer: "RAIN" },
  { clue: "Frozen flakes", answer: "SNOW" },
  { clue: "Moving air", answer: "WIND" },
  { clue: "Bright light in sky", answer: "SUN" },
  { clue: "Night sky object", answer: "MOON" },
  { clue: "A vehicle with two wheels", answer: "BIKE" },
  { clue: "A vehicle with four wheels", answer: "CAR" },
  { clue: "A large passenger vehicle", answer: "BUS" },
  { clue: "A water vehicle", answer: "BOAT" },
  { clue: "Small boat", answer: "RAFT" },
  { clue: "Prefix meaning single", answer: "UNI" },
  { clue: "Tool for cutting wood", answer: "SAW" },
  { clue: "Body part for seeing", answer: "EYE" },
  { clue: "Body part for hearing", answer: "EAR" },
  { clue: "Body part for smelling", answer: "NOSE" },
  { clue: "Body part for touching", answer: "HAND" },
  { clue: "Body part for walking", answer: "FOOT" },
  { clue: "Opposite of east", answer: "WEST" },
  { clue: "2009 Pixar film", answer: "UP" },
  { clue: "Bottom direction", answer: "DOWN" },
  { clue: "2 steps forward, 1 step _", answer: "BACK" },
  { clue: "Not right", answer: "LEFT" },
  { clue: "A round shaped object", answer: "ORB" },
  { clue: "3-D square", answer: "CUBE" },
  { clue: "An ice-cream [blank]", answer: "CONE" },
  { clue: "Counterpart of this", answer: "THAT" },
  { clue: "Opposite of all", answer: "NONE" },
  { clue: "Material derived from trees", answer: "WOOD" },
  { clue: "A dry sandy place", answer: "DUNE" },
  { clue: "A small water body", answer: "POND" },
  { clue: "Land surrounded by water", answer: "ISLE" },
  { clue: "A person who cooks", answer: "CHEF" },
  { clue: "A person who heals", answer: "DOC" },
  { clue: "Opposite of stop", answer: "GO" },
  { clue: "Golfer's support", answer: "TEE" },
  { clue: "Pool stick", answer: "CUE" },
  { clue: "Board game cube", answer: "DIE" },
  { clue: "Card game cry", answer: "UNO" },
  { clue: "Poker stake", answer: "ANTE" },
  { clue: "Chess royal", answer: "KING" },
  { clue: "Ref's call", answer: "FOUL" },
  { clue: "Runner's unit", answer: "LAP" },
  { clue: "Soccer score", answer: "GOAL" },
  { clue: "Bowling score", answer: "TEN" },
  { clue: "Yoga sound", answer: "OM" },
  { clue: "Senior", answer: "SR" },
  { clue: "Disgust sound", answer: "EW" },
  { clue: "Realization sound", answer: "OHO" },
  { clue: "Sleep sound", answer: "ZZZ" },
  { clue: "Clock sound", answer: "TICK" },
  { clue: "Impact sound", answer: "POW" },
  { clue: "Knock sound", answer: "RAP" },
  { clue: "Heartbeat sound", answer: "LUB" },
  { clue: "Sneeze start", answer: "AH" },
  { clue: "Doctor's title", answer: "DR" },
  { clue: "Pain sound", answer: "OW" },
  { clue: "Mister, briefly", answer: "MR" },
  { clue: "Junior, briefly", answer: "JR" },
  { clue: "Street suffix", answer: "RD" },
  { clue: "Avenue abbr.", answer: "AVE" },
  { clue: "Mount, briefly", answer: "MT" },
  { clue: "Saint, briefly", answer: "ST" },
  { clue: "2006 Pixar film", answer: "CARS" },
  { clue: "United Nations", answer: "UN" },
  { clue: "When stranded, you send one out", answer: "SOS" },
  { clue: "A group of workers", answer: "CREW" },
  { clue: "Greatest of all time", answer: "GOAT" },
  { clue: "Sandwich cookie", answer: "OREO" },
  { clue: "Not pass", answer: "FAIL" },
  { clue: "2017 Pixar film", answer: "COCO" },
  { clue: "A collection of ants", answer: "ARMY" },
  { clue: "A group of musicians", answer: "BAND" },
  { clue: "Three performers", answer: "TRIO" },
  { clue: "A route", answer: "PATH" },
  { clue: "The Beatles' fifth studio album", answer: "HELP" },
  { clue: "The one", answer: "NEO" },
  { clue: "It's best you make it while the sun shines", answer: "HAY" },
  { clue: "A rolling stone gathers none of it", answer: "MOSS" },
  { clue: "Easy as", answer: "ABC" },
  { clue: "The European Organization for Nuclear Research", answer: "CERN" },
  { clue: "2020 Pixar film", answer: "SOUL" },
  { clue: "Dynamite", answer: "TNT" },
  { clue: "Australian rock band", answer: "ACDC" },
  { clue: "Capital of Italy", answer: "ROME" },
  { clue: "Capital of Norway", answer: "OSLO" },
  { clue: "Castle in the", answer: "SKY" },
  { clue: "Boxer and singer", answer: "MJ" },
  { clue: "Led Zeppelin lead guitarist", answer: "PAGE" },
  { clue: "Let the cat out of it", answer: "BAG" },
  { clue: "A founding father and clock-tower", answer: "BEN" },
  { clue: "Benjamin Button and Fight Club", answer: "PITT" },
  { clue: "Ryan Gosling Oscar-nominated role", answer: "KEN" },
  { clue: "DECA", answer: "TEN" },
  { clue: "Second", answer: "BETA" },
  { clue: "Fourth planet", answer: "MARS" },
  { clue: "Fee-fi-fo-fum", answer: "FUM" },
  { clue: "Not mean", answer: "NICE" },
  { clue: "A fox's home", answer: "DEN" },
  { clue: "1985 American black comedy mystery film", answer: "CLUE" },
  { clue: "Definite article", answer: "THE" },
  { clue: "Used to find your way from point A to B", answer: "MAP" },
  { clue: "To swear", answer: "CUSS" },
  { clue: "To iterate", answer: "LOOP" },
  { clue: "Napoleon and Snowball are examples", answer: "PIG" },
  { clue: "Appendage used by fish to swim", answer: "FIN" },
  { clue: "Biggest MMA organization", answer: "UFC" },
  { clue: "1975 American thriller film directed by Steven Spielberg", answer: "JAWS" },
  { clue: "2004 American biographical drama film about a soul musician", answer: "RAY" },
  { clue: "You swear it", answer: "OATH" },
  { clue: "Interactive hobby where participants act out characters", answer: "LARP" },
  { clue: "2004 American science fiction adventure drama", answer: "LOST" },
  { clue: "35th US president", answer: "JFK" },
  { clue: "2025 Pixar film", answer: "ELIO" },
  { clue: "2021 Pixar film", answer: "LUCA" },
  { clue: "36th US president", answer: "LBJ" },
  { clue: "English rock band formed in London in 1988", answer: "BLUR" },
  { clue: "American basic cable sports broadcasting network", answer: "ESPN" },
  { clue: "American science fiction comedy involving aliens", answer: "MIB" },
  { clue: "Superman's alter-ego", answer: "KENT" },
  { clue: "Third Monday of January each year is dedicated to him", answer: "MLK" },
  { clue: "They make honey", answer: "BEES" },
  { clue: "Blue fish voiced by Ellen DeGeneres", answer: "DORY" },
  { clue: "The Eternal City", answer: "ROME" },
  { clue: "Lost clown fish", answer: "NEMO" },
  { clue: "Used after a company's name to indicate it is a legal corporation", answer: "INC" },
  { clue: "When people lose or get humiliated, they are said to eat this", answer: "CROW" },
  { clue: "You go to it to withdraw cash", answer: "ATM" },
  { clue: "Wolves hunt in them", answer: "PACK" },
  { clue: "Responsible for the United States' civil space program", answer: "NASA" },
  { clue: "Not in danger", answer: "SAFE" },
  { clue: "A person who repeatedly doesn't tell the truth", answer: "LIAR" },
  { clue: "A short or informal test", answer: "QUIZ" },
  { clue: "Co-founder of Apple", answer: "JOBS" },
  { clue: "Worry or concern regarding being left out", answer: "FOMO" },
  { clue: "Not present at one's computer", answer: "AFK" },
  { clue: "2001 Spielberg film", answer: "AI" },
  { clue: "A group of people deciding a court case", answer: "JURY" },
  { clue: "Stealing a motor vehicle", answer: "GTA" },
  { clue: "US foreign intelligence agency", answer: "CIA" },
  { clue: "US domestic law enforcement and intelligence agency", answer: "FBI" },
  { clue: "Rhythm and blues", answer: "RNB" },
  { clue: "Band that made Losing My Religion", answer: "REM" },
  { clue: "Negation of a word or group of words", answer: "NOT" },
  { clue: "Completely given to or absorbed by", answer: "ALL" },
  { clue: "In bed", answer: "ABED" },
  { clue: "Determine by choice", answer: "WILL" },
  { clue: "Able to act at will; not hampered", answer: "FREE" },
  { clue: "Used of a single unit or thing; not two or more", answer: "ONE" },
  { clue: "Assist or encourage, usually in some wrongdoing", answer: "ABET" },
  { clue: "Get done", answer: "DO" },
  { clue: "An instance or single occasion for some event", answer: "TIME" },
  { clue: "Physical position in relation to the surroundings", answer: "SITE" },
  { clue: "A dull persistent pain", answer: "ACHE" },
  { clue: "The month following April and preceding June", answer: "MAY" },
  { clue: "Information about recent and important events", answer: "NEWS" },
  { clue: "A rounded thickly curled hairdo", answer: "AFRO" },
  { clue: "In or at this place; where the speaker or writer is", answer: "HERE" },
  { clue: "Come into the possession of something", answer: "GET" },
  { clue: "Look at carefully; study mentally", answer: "VIEW" },
  { clue: "Highly excited", answer: "AGOG" },
  { clue: "Relatively much but unspecified in amount or extent", answer: "SOME" },
  { clue: "Equal in amount or value", answer: "LIKE" },
  { clue: "Come upon, as if by accident; meet with", answer: "FIND" },
  { clue: "Someone who acts as assistant", answer: "AIDE" },
  { clue: "Only a moment ago", answer: "JUST" },
  { clue: "A period of time containing 365 days", answer: "YEAR" },
  { clue: "Time for Earth to make a complete rotation on its axis", answer: "DAY" },
  { clue: "Be ill or unwell", answer: "AIL" },
  { clue: "Being one more than one", answer: "TWO" },
  { clue: "At the time or occasion immediately following", answer: "NEXT" },
  { clue: "Employed in accomplishing something", answer: "USED" },
  { clue: "Slightly open", answer: "AJAR" },
  { clue: "Be employed", answer: "WORK" },
  { clue: "The item at the end", answer: "LAST" },
  { clue: "A collection of facts from which conclusions may be drawn", answer: "DATA" },
  { clue: "Similar in quality or character", answer: "AKIN" },
  { clue: "Past tense of not telling the truth", answer: "LIED" },
  { clue: "Affix in a public place or for public notice", answer: "POST" },
  { clue: "State or say further", answer: "ADD" },
  { clue: "Dark, flammable substance", answer: "TAR" },
  { clue: "To so extreme a degree", answer: "SUCH" },
  { clue: "Money or goods contributed to the poor", answer: "ALMS" },
  { clue: "In a most excellent way or manner", answer: "BEST" },
  { clue: "Subsequently or soon afterward", answer: "THEN" },
  { clue: "To have a justified, true belief", answer: "KNOW" },
  { clue: "Having desirable or positive qualities", answer: "GOOD" },
  { clue: "Wildly; without self-control", answer: "AMOK" },
  { clue: "To move smoothly along", answer: "FLOW" },
  { clue: "Thoroughly or completely; fully", answer: "WELL" },
  { clue: "At a great altitude", answer: "HIGH" },
  { clue: "To do something bad", answer: "SIN" },
  { clue: "To or from every one of two or more", answer: "EACH" },
  { clue: "Imitate uncritically and in every aspect", answer: "APE" },
  { clue: "A dirty or untidy state", answer: "MESS" },
  { clue: "Precisely so", answer: "VERY" },
  { clue: "Engage for a performance", answer: "BOOK" },
  { clue: "The male parent of an animal", answer: "SIRE" },
  { clue: "Interpret something that is written or printed", answer: "READ" },
  { clue: "An elaborate song for solo voice", answer: "ARIA" },
  { clue: "A condition requiring relief", answer: "NEED" },
  { clue: "An abstract collection of numbers or symbols", answer: "SET" },
  { clue: "Send via the postal service", answer: "MAIL" },
  { clue: "Lacking sufficient water or rainfall", answer: "ARID" },
  { clue: "Containing as much or as many as is possible or normal", answer: "FULL" },
  { clue: "A characteristic state or mode of living", answer: "LIFE" },
  { clue: "The condition of things generally", answer: "WAY" },
  { clue: "As soon as possible", answer: "ASAP" },
  { clue: "The time during which someone's life continues", answer: "DAYS" },
  { clue: "No less than what is stated; worthy of the name", answer: "REAL" },
  { clue: "Highly recommended", answer: "MUST" },
  { clue: "On, to, or at the top", answer: "ATOP" },
  { clue: "Produced by a manufacturing process", answer: "MADE" },
  { clue: "Not in operation or operational", answer: "OFF" },
  { clue: "Cause to go somewhere", answer: "SEND" },
  { clue: "Ardently or excessively desirous", answer: "AVID" },
  { clue: "Slightly wet", answer: "DAMP" },
  { clue: "Write by means of a keyboard with types", answer: "TYPE" },
  { clue: "A subject of study", answer: "AREA" },
  { clue: "Have need of", answer: "WANT" },
  { clue: "One who is away or absent without leave", answer: "AWOL" },
  { clue: "Cut of meat", answer: "LOIN" },
  { clue: "For an extended time or at a distant time", answer: "LONG" },
  { clue: "Give an exhibition of to an interested audience", answer: "SHOW" },
  { clue: "In spite of; notwithstanding", answer: "EVEN" },
  { clue: "Away from the correct or expected course", answer: "AWRY" },
  { clue: "Gentle tap", answer: "PAT" },
  { clue: "To a great degree or extent", answer: "MUCH" },
  { clue: "Mark with one's signature; write one's name", answer: "SIGN" },
  { clue: "Record in a public office or in a court of law", answer: "FILE" },
  { clue: "Chop or split with an ax", answer: "AXE" },
  { clue: "The means of connection between things linked in series", answer: "LINK" },
  { clue: "Affording unobstructed entrance and exit; not shut or closed", answer: "OPEN" },
  { clue: "2011 American animated musical adventure-comedy film", answer: "RIO" },
  { clue: "Look over, usually with the intention to rob", answer: "CASE" },
  { clue: "A shaft on which a wheel rotates", answer: "AXLE" },
  { clue: "Two considered together; the two", answer: "BOTH" },
  { clue: "A contest with rules to determine a winner", answer: "GAME" },
  { clue: "Feel concern or interest", answer: "CARE" },
  { clue: "The cry made by sheep", answer: "BAA" },
  { clue: "The collection of rules imposed by authority", answer: "LAW" },
  { clue: "Do one's shopping", answer: "SHOP" },
  { clue: "The words of something written", answer: "TEXT" },
  { clue: "Release after a security has been paid", answer: "BAIL" },
  { clue: "Assign a rank or rating to", answer: "RATE" },
  { clue: "Have a great affection or liking for", answer: "LOVE" },
  { clue: "The last of the four Gospels in the New Testament", answer: "JOHN" },
  { clue: "Anything that serves as an enticement", answer: "BAIT" },
  { clue: "Any very large body of water", answer: "MAIN" },
  { clue: "A telephone connection", answer: "CALL" },
  { clue: "Texter's laugh", answer: "LOL" },
  { clue: "The act of preventing the opposition from scoring", answer: "SAVE" },
  { clue: "Something causing misery or death", answer: "BANE" },
  { clue: "Compass point", answer: "ENE" },
  { clue: "Take charge of a certain job; occupy a certain work place", answer: "MAN" },
  { clue: "Thin cardboard, usually rectangular", answer: "CARD" },
  { clue: "Bee sound", answer: "BUZZ" },
  { clue: "Anything that provides mental stimulus for thinking", answer: "FOOD" },
  { clue: "The pointed part of barbed wire", answer: "BARB" },
  { clue: "A particular instance of selling", answer: "SALE" },
  { clue: "Work occasionally", answer: "JOB" },
  { clue: "An area within a building enclosed by walls and floor and ceiling", answer: "ROOM" },
  { clue: "Speak in an unfriendly tone", answer: "BARK" },
  { clue: "Become part of; become a member of a group or organization", answer: "JOIN" },
  { clue: "Give a certain impression or have a certain outward aspect", answer: "LOOK" },
  { clue: "Full of merriment", answer: "GAY" },
  { clue: "An uproarious party", answer: "BASH" },
  { clue: "Empty", answer: "VOID" },
  { clue: "Any period of seven consecutive days", answer: "WEEK" },
  { clue: "Make mention of", answer: "NOTE" },
  { clue: "Exerting force or containing energy", answer: "LIVE" },
  { clue: "Be exposed", answer: "BASK" },
  { clue: "To be broadcast", answer: "AIR" },
  { clue: "Have the intention to carry out some action", answer: "PLAN" },
  { clue: "Shout loudly and without restraint", answer: "BAWL" },
  { clue: "Be priced at", answer: "COST" },
  { clue: "Beaklike mouth of animals other than birds", answer: "BEAK" },
  { clue: "A way of checking progress", answer: "TEST" },
  { clue: "Round red root vegetable", answer: "BEET" },
  { clue: "Move toward or travel toward something", answer: "COME" },
  { clue: "Participate in games or sport", answer: "PLAY" },
  { clue: "Actively cause something to happen", answer: "LET" },
  { clue: "Call upon in supplication; entreat", answer: "BEG" },
  { clue: "Place temporarily", answer: "PARK" },
  { clue: "Perform an action, or work out or perform", answer: "ACT" },
  { clue: "Cause to have, in the abstract sense or physical sense", answer: "GIVE" },
  { clue: "Top part of an apron; covering the chest", answer: "BIB" },
  { clue: "Begin to seem older; get older", answer: "AGE" },
  { clue: "Gather and spend time together", answer: "CLUB" },
  { clue: "An open way for travel or transportation", answer: "ROAD" },
  { clue: "A sudden minor shock or meaningless interruption", answer: "BLIP" },
  { clue: "Something acquired without compensation", answer: "GIFT" },
  { clue: "Give money, usually in exchange for goods or services", answer: "PAY" },
  { clue: "Being one more than three", answer: "FOUR" },
  { clue: "An indistinct shapeless form", answer: "BLOB" },
  { clue: "Posing no difficulty", answer: "EASY" },
  { clue: "Send something via it", answer: "FAX" },
  { clue: "A group of countries in special alliance", answer: "BLOC" },
  { clue: "A card or badge used to identify the bearer", answer: "ID" },
  { clue: "The main tower within the walls of a medieval castle or fortress", answer: "KEEP" },
  { clue: "The youngest member of a group", answer: "BABY" },
  { clue: "An uncastrated male hog", answer: "BOAR" },
  { clue: "To go or travel towards", answer: "HEAD" },
  { clue: "Any small compartment", answer: "CELL" },
  { clue: "A person considered as a unique individual", answer: "SELF" },
  { clue: "Indicate by signs", answer: "BODE" },
  { clue: "An object that is rung", answer: "BELL" },
  { clue: "From a particular thing or place or position", answer: "AWAY" },
  { clue: "On one occasion", answer: "ONCE" },
  { clue: "Physically secure or dependable", answer: "SURE" },
  { clue: "Ring loudly and deeply", answer: "BONG" },
  { clue: "Let something be known", answer: "TELL" },
  { clue: "Have the skills and qualifications to do things well", answer: "ABLE" },
  { clue: "Activities that are enjoyable or amusing", answer: "FUN" },
  { clue: "Show displeasure, as after a performance or speech", answer: "BOO" },
  { clue: "A piece of land with fixed boundaries", answer: "LOT" },
  { clue: "Inquire about", answer: "ASK" },
  { clue: "Earlier than the present time", answer: "PAST" },
  { clue: "An early form of modern jazz", answer: "BOP" },
  { clue: "Directly or exactly", answer: "DUE" },
  { clue: "Make imperfect", answer: "MAR" },
  { clue: "Cause to be uninterested", answer: "BORE" },
  { clue: "The boss or head", answer: "DON" },
  { clue: "Reach or come to rest", answer: "LAND" },
  { clue: "Having finished or arrived at completion", answer: "DONE" },
  { clue: "An argument in favor of a proposal", answer: "PRO" },
  { clue: "A period of illness", answer: "BOUT" },
  { clue: "At any time", answer: "EVER" },
  { clue: "A unit of language that native speakers can identify", answer: "WORD" },
  { clue: "A statute in draft before it becomes law", answer: "BILL" },
  { clue: "An instance of boastful talk", answer: "BRAG" },
  { clue: "A collection of cattle", answer: "HERD" },
  { clue: "A number or letter indicating quality", answer: "MARK" },
  { clue: "Move back and forth or sideways", answer: "ROCK" },
  { clue: "Having undesirable or negative qualities", answer: "BAD" },
  { clue: "The cry of an ass", answer: "BRAY" },
  { clue: "On the positive side or higher end of a scale", answer: "PLUS" },
  { clue: "Prepare for publication or presentation by correcting, revising, or adapting", answer: "EDIT" },
  { clue: "Quickly or rapidly", answer: "FAST" },
  { clue: "Food prepared from the husks of cereal grains", answer: "BRAN" },
  { clue: "An event known to have happened or something known to have existed", answer: "FACT" },
  { clue: "An organization regarded as part of a larger social group", answer: "UNIT" },
  { clue: "Come together", answer: "MEET" },
  { clue: "Prepare beer", answer: "BREW" },
  { clue: "Half the width of an em", answer: "EN" },
  { clue: "Undergo an emotional sensation", answer: "FEEL" },
  { clue: "Soft creamy white cheese; milder than Camembert", answer: "BRIE" },
  { clue: "Tip laterally", answer: "BANK" },
  { clue: "A venture undertaken without regard to possible loss or injury", answer: "RISK" },
  { clue: "The people living in a municipality smaller than a city", answer: "TOWN" },
  { clue: "Be completely full", answer: "BRIM" },
  { clue: "A young woman", answer: "GIRL" },
  { clue: "The temporary provision of money", answer: "LOAN" },
  { clue: "Excitement and cheer", answer: "PEP" },
  { clue: "With or by a broad space", answer: "WIDE" },
  { clue: "Develop buds", answer: "BUD" },
  { clue: "An approximate definition or example", answer: "SORT" },
  { clue: "Cause to execute a single command", answer: "STEP" },
  { clue: "United States feminist", answer: "PAUL" },
  { clue: "Polish and make shiny", answer: "BUFF" },
  { clue: "A body of water surrounded by land", answer: "LAKE" },
  { clue: "The event of something burning", answer: "FIRE" },
  { clue: "Refine a skill", answer: "HONE" },
  { clue: "An informal conversation", answer: "CHAT" },
  { clue: "A rounded part of a cylindrical instrument", answer: "BULB" },
  { clue: "Something that is lost", answer: "LOSS" },
  { clue: "Visage", answer: "FACE" },
  { clue: "A lodging that provides overnight stay and breakfast", answer: "BNB" },
  { clue: "A small fragment of something broken off from the whole", answer: "BIT" },
  { clue: "Knock against with force or violence", answer: "BUMP" },
  { clue: "Installation from which a military force initiates operations", answer: "BASE" },
  { clue: "The act of changing or reversing the direction of the course", answer: "TURN" },
  { clue: "A thing made to be similar or identical to another thing", answer: "COPY" },
  { clue: "Small rounded bread either plain or sweet", answer: "BUN" },
  { clue: "Of a moderate reddish-brown color", answer: "BAY" },
  { clue: "Located on the left side of a ship or aircraft", answer: "PORT" },
  { clue: "A counter where you can obtain food or drink", answer: "BAR" },
  { clue: "Float on the surface of water", answer: "BUOY" },
  { clue: "In the near future", answer: "SOON" },
  { clue: "Occupied or in the control of", answer: "HELD" },
  { clue: "Turn over and spread out", answer: "TED" },
  { clue: "Be offended or bothered by", answer: "MIND" },
  { clue: "Cover from sight", answer: "BURY" },
  { clue: "A list of dishes available at a restaurant", answer: "MENU" },
  { clue: "Expect and wish", answer: "HOPE" },
  { clue: "Normal or customary activity of a person in a particular social setting", answer: "ROLE" },
  { clue: "Expel gas from the stomach", answer: "BURP" },
  { clue: "Money extracted as a penalty", answer: "FINE" },
  { clue: "A period of time equal to 1/24th of a day", answer: "HOUR" },
  { clue: "A large wilderness area", answer: "BUSH" },
  { clue: "Young of domestic cattle", answer: "CALF" },
  { clue: "An attempt to get something", answer: "BID" },
  { clue: "Agreeable, conducive to comfort", answer: "KIND" },
  { clue: "The act of deciding to do something", answer: "MOVE" },
  { clue: "An absolute certainty", answer: "CERT" },
  { clue: "A company emblem or device", answer: "LOGO" },
  { clue: "A form of address for a woman", answer: "MS" },
  { clue: "Crack due to dehydration", answer: "CHAP" },
  { clue: "Take somebody somewhere", answer: "LEAD" },
  { clue: "A particular functioning condition or arrangement", answer: "MODE" },
  { clue: "Having been taken in marriage", answer: "WED" },
  { clue: "Elegant and stylish", answer: "CHIC" },
  { clue: "Characteristic of a man", answer: "MALE" },
  { clue: "A short musical composition with words", answer: "SONG" },
  { clue: "Later than usual or than expected", answer: "LATE" },
  { clue: "Cut into pieces", answer: "CHOP" },
  { clue: "The content of cognition", answer: "IDEA" },
  { clue: "Be the winner in a contest or competition; be victorious", answer: "WIN" },
  { clue: "A particular instance of buying or selling", answer: "DEAL" },
  { clue: "Informal terms for a meal", answer: "CHOW" },
  { clue: "Provide as food", answer: "FEED" },
  { clue: "Fashioned or shaped by cutting", answer: "CUT" },
  { clue: "A large room for gatherings or entertainment", answer: "HALL" },
  { clue: "Make a dull, explosive sound", answer: "CHUG" },
  { clue: "Not in favor of", answer: "ANTI" },
  { clue: "A vessel that carries passengers or freight", answer: "SHIP" },
  { clue: "Marked by the reception of pay", answer: "PAID" },
  { clue: "Put quickly or forcibly", answer: "CLAP" },
  { clue: "Filamentous hairlike growth on a plant", answer: "HAIR" },
  { clue: "A case for containing a set of articles", answer: "KIT" },
  { clue: "We get paper from it", answer: "TREE" },
  { clue: "Become or cause to become obstructed", answer: "CLOG" },
  { clue: "In the way indicated", answer: "THUS" },
  { clue: "A friendly informal reference to a grown man", answer: "BOY" },
  { clue: "A male human offspring", answer: "SON" },
  { clue: "Informal term for the nose", answer: "CONK" },
  { clue: "A principle or condition that customarily governs behavior", answer: "RULE" },
  { clue: "Store in bins", answer: "BIN" },
  { clue: "Anything providing a means of access", answer: "DOOR" },
  { clue: "Speak softly or lovingly", answer: "COO" },
  { clue: "Neither warm nor very cold; giving relief from heat", answer: "COOL" },
  { clue: "The nations of the Asian continent collectively", answer: "ASIA" },
  { clue: "Birth place of Einstein", answer: "ULM" },
  { clue: "A platform-independent object-oriented programming language", answer: "JAVA" },
  { clue: "Slate-black slow-flying birds somewhat resembling ducks", answer: "COOT" },
  { clue: "A written leave of absence", answer: "PASS" },
  { clue: "A closed railroad car that carries baggage or freight", answer: "VAN" },
  { clue: "An alcoholic spirit", answer: "GIN" },
  { clue: "A brilliant and notable success", answer: "COUP" },
  { clue: "Cause to move by striking", answer: "HIT" },
  { clue: "Combine into a common fund", answer: "POOL" },
  { clue: "Used of women's clothing; very short with hemline above the knee", answer: "MINI" },
  { clue: "A loose hood or hooded robe", answer: "COWL" },
  { clue: "Seek indirectly", answer: "FISH" },
  { clue: "Brought into existence", answer: "BORN" },
  { clue: "Any competition", answer: "RACE" },
  { clue: "A steep rugged rock or cliff", answer: "CRAG" },
  { clue: "The state of owing something", answer: "DEBT" },
  { clue: "A fixed charge for a privilege or for professional services", answer: "FEE" },
  { clue: "Let for money", answer: "RENT" },
  { clue: "The most important point", answer: "CRUX" },
  { clue: "A resource", answer: "AID" },
  { clue: "A lyric poem that addresses a particular subject", answer: "ODE" },
  { clue: "Not excessive or extreme", answer: "FAIR" },
  { clue: "The young one of a lion", answer: "CUB" },
  { clue: "A thin, light-weight rod", answer: "WAND" },
  { clue: "Having an abundance of flesh", answer: "FAT" },
  { clue: "No longer having or seeming to have or expecting to have life", answer: "DEAD" },
  { clue: "A journey for some purpose", answer: "TRIP" },
  { clue: "Hit with the hand", answer: "CUFF" },
  { clue: "Having little money or few possessions", answer: "POOR" },
  { clue: "Be a farmer; work as a farmer", answer: "FARM" },
  { clue: "Selective slaughter of wild animals", answer: "CULL" },
  { clue: "Male cat", answer: "TOM" },
  { clue: "A titled peer of the realm", answer: "LORD" },
  { clue: "Perceive via the auditory sense", answer: "HEAR" },
  { clue: "An inferior dog or one of mixed breed", answer: "CUR" },
  { clue: "Strike out", answer: "FAN" },
  { clue: "A married woman; a man's partner in marriage", answer: "WIFE" },
  { clue: "Regulate housing in; of certain areas of towns", answer: "ZONE" },
  { clue: "A male monarch or emperor", answer: "CZAR" },
  { clue: "Lift with a special device", answer: "JACK" },
  { clue: "Stroke or caress gently", answer: "PET" },
  { clue: "Repair by sewing", answer: "DARN" },
  { clue: "An informal term for a youth or man", answer: "GUY" },
  { clue: "A light, bouncing step", answer: "SKIP" },
  { clue: "Set the level or character of", answer: "GEAR" },
  { clue: "Confusion characterized by lack of clarity", answer: "DAZE" },
  { clue: "Soldier of the American Revolution", answer: "LEE" },
  { clue: "A mouth or mouthlike opening", answer: "OS" },
  { clue: "Bill Clinton was born in this small Arkansas city", answer: "HOPE" },
  { clue: "With resolute determination", answer: "FIRM" },
  { clue: "Move forward by leaps and bounds", answer: "JUMP" },
  { clue: "Disposed of to a purchaser", answer: "SOLD" },
  { clue: "A hair style for women and children; a short haircut all around", answer: "BOB" },
  { clue: "Meeting adequate standards for a purpose", answer: "FIT" },
  { clue: "A symptom of some physical hurt or disorder", answer: "PAIN" },
  { clue: "Using speech rather than writing", answer: "ORAL" },
  { clue: "Advance slowly, as if by inches", answer: "EDGE" },
  { clue: "Of a light shade of red", answer: "PINK" },
  { clue: "Signal or hint", answer: "CUE" },
  { clue: "A solid blow from a firearm", answer: "SHOT" },
  { clue: "Having lost heat", answer: "COLD" },
  { clue: "A European river; flows into the Adriatic Sea", answer: "PO" },
  { clue: "Second letter of the Greek alphabet", answer: "BETA" },
  { clue: "Make hot or hotter", answer: "HEAT" },
  { clue: "Marked by extreme lack of restraint or control", answer: "WILD" },
  { clue: "Feel or suffer from the lack of", answer: "MISS" },
  { clue: "General term for any insect or similar creeping or crawling invertebrate", answer: "BUG" },
  { clue: "The counterpart to borrow", answer: "LEND" },
  { clue: "Used in combination to denote the middle", answer: "MID" },
  { clue: "Yielding readily to pressure or weight", answer: "SOFT" },
  { clue: "Provide with a combustible substance that provides energy", answer: "FUEL" },
  { clue: "Of something having a dusty purplish pink color", answer: "ROSE" },
  { clue: "Remove in small bits", answer: "PICK" },
  { clue: "Let fall to the ground", answer: "DROP" },
  { clue: "Possessing material wealth", answer: "RICH" },
  { clue: "Appear to exist", answer: "SEEM" },
  { clue: "Very fertile; producing profuse growth", answer: "RANK" },
  { clue: "A unit of length equal to one twelfth of a foot", answer: "INCH" },
  { clue: "A workplace for the conduct of scientific research", answer: "LAB" },
  { clue: "Make full, also in a metaphorical sense", answer: "FILL" },
  { clue: "No longer retained", answer: "GONE" },
  { clue: "The actors in a play", answer: "CAST" },
  { clue: "A quad with a square body", answer: "EM" },
  { clue: "A tiny piece of anything", answer: "ATOM" },
  { clue: "A commercially prepared mixture of dry ingredients", answer: "MIX" },
  { clue: "Sunniest City on Earth", answer: "YUMA" },
  { clue: "Something with a round shape resembling a flat circular plate", answer: "DISK" },
  { clue: "Informal terms for a difficult situation", answer: "FIX" },
  { clue: "A specific form of evildoing", answer: "VICE" },
  { clue: "Work that you are obliged to perform for moral or legal reasons", answer: "DUTY" },
  { clue: "Obtain advantages, such as points, etc.", answer: "GAIN" },
  { clue: "The state of needing something that is absent or unavailable", answer: "LACK" },
  { clue: "A state in midwestern United States", answer: "IOWA" },
  { clue: "In opposition to a proposition, opinion, etc.", answer: "CON" },
  { clue: "Move along very quickly", answer: "ZOOM" },
  { clue: "Exhale hard", answer: "BLOW" },
  { clue: "Provide with electrical circuits", answer: "WIRE" },
  { clue: "Send unwanted or junk e-mail", answer: "SPAM" },
  { clue: "A fractional monetary unit of several countries", answer: "CENT" },
  { clue: "Lacking any legal or binding force", answer: "NULL" },
  { clue: "Having no measurable or otherwise determinable value", answer: "ZERO" },
  { clue: "A list of names", answer: "ROLL" },
  { clue: "You soak and wash your body in a bathtub", answer: "BATH" },
  { clue: "A dry form of lava resembling clinkers", answer: "AA" },
  { clue: "A specific size and style of type within a type family", answer: "FONT" },
  { clue: "Not subject to defeat, past tense", answer: "WON" },
  { clue: "Be dressed in", answer: "WEAR" },
  { clue: "Not widely known; especially valued for its uncommonness", answer: "RARE" },
  { clue: "Propel with oars", answer: "ROW" },
  { clue: "Move upward", answer: "RISE" },
  { clue: "Wound or injure", answer: "MAIM" },
  { clue: "Watch and study birds in their natural habitat", answer: "BIRD" },
  { clue: "Male sheep", answer: "RAM" },
  { clue: "A polite name for any woman", answer: "LADY" },
  { clue: "Take in solid food", answer: "EAT" },
  { clue: "Dismiss from employment", answer: "SACK" },
  { clue: "A small wooded hollow", answer: "DELL" },
  { clue: "Large, starchy, tropical tubers", answer: "YAMS" },
  { clue: "Propose or intend", answer: "AIM" },
  { clue: "Ring slowly", answer: "TOLL" },
  { clue: "Pure color or pigment", answer: "HUE" },
  { clue: "A strip of land projecting into a body of water", answer: "CAPE" },
  { clue: "The southernmost country in Africa", answer: "RSA" },
  { clue: "Cause to tilt", answer: "TIP" },
  { clue: "Get from the earth by excavation", answer: "MINE" },
  { clue: "Largest organ", answer: "SKIN" },
  { clue: "Move along on skis", answer: "SKI" },
  { clue: "Not to be deceived or hoodwinked", answer: "FLY" },
  { clue: "Come out better in a competition, race, or conflict", answer: "BEAT" },
  { clue: "Manipulate manually or in one's mind or imagination", answer: "TOY" },
  { clue: "Either side of the body below the waist and above the thigh", answer: "HIP" },
  { clue: "Detect with the senses", answer: "SPOT" },
  { clue: "Become larger, greater, or bigger; expand or gain", answer: "GROW" },
  { clue: "Infection by the human immunodeficiency virus", answer: "HIV" },
  { clue: "Having or denoting a low vocal or instrumental range", answer: "BASS" },
  { clue: "Be carried or travel on or in a vehicle", answer: "RIDE" },
  { clue: "A Spanish gentleman or nobleman", answer: "DON" },
  { clue: "Morally bad or wrong", answer: "EVIL" },
  { clue: "Lie at the top of", answer: "CAP" },
  { clue: "Append one's signature to", answer: "INK" },
  { clue: "The top or extreme point of something", answer: "PEAK" },
  { clue: "Painful or bitter", answer: "SALT" },
  { clue: "A piece of jewelry that is pinned onto the wearer's garment", answer: "PIN" },
  { clue: "Informal terms for nakedness", answer: "RAW" },
  { clue: "A narrow way or road", answer: "LANE" },
  { clue: "Thwart the passage of", answer: "KILL" },
  { clue: "Prepare a hot meal", answer: "COOK" },
  { clue: "Try to get or reach", answer: "SEEK" },
  { clue: "A rotating disk shaped to convert circular into linear motion", answer: "CAM" },
  { clue: "The part of the earth's surface consisting of humus and disintegrated rock", answer: "SOIL" },
  { clue: "Covered or soaked with a liquid such as water", answer: "WET" },
  { clue: "A tool for driving or forcing something by impact", answer: "RAM" },
  { clue: "Move out of or depart from", answer: "EXIT" },
  { clue: "Prepare oneself for a military confrontation", answer: "ARM" },
  { clue: "A movement up and down or back and forth", answer: "WAVE" },
  { clue: "Belonging to or derived from or associated with a divine power", answer: "HOLY" },
  { clue: "The act of interlocking or meshing", answer: "MESH" },
  { clue: "An administrator in charge of a division of a university or college", answer: "DEAN" },
  { clue: "Get the opinions by asking specific questions", answer: "POLL" },
  { clue: "Trademark for a powerful operating system", answer: "UNIX" },
  { clue: "British secret operative 007 in novels by Ian Fleming", answer: "BOND" },
  { clue: "Jump lightly", answer: "HOP" },
  { clue: "Free of extraneous elements of any kind", answer: "PURE" },
  { clue: "A channel through which something can be seen or understood", answer: "LENS" },
  { clue: "A gully that is shallower than a ravine", answer: "DRAW" },
  { clue: "Staying power", answer: "LEGS" },
  { clue: "A connecting point at which several lines come together", answer: "NODE" },
  { clue: "A large distance", answer: "MILE" },
  { clue: "Be silly or tease one another", answer: "KID" },
  { clue: "Make a sweeping movement", answer: "PAN" },
  { clue: "A neutral achromatic color midway between white and black", answer: "GRAY" },
  { clue: "A city in northwest Indiana on Lake Michigan; steel production", answer: "GARY" },
  { clue: "Be subject to change in accordance with a variable", answer: "VARY" },
  { clue: "Move with force", answer: "PUSH" },
  { clue: "A quantity of money", answer: "SUM" },
  { clue: "A deciduous tree of the genus Quercus; has acorns and lobed leaves", answer: "OAK" },
  { clue: "Term of address for a man", answer: "SIR" },
  { clue: "Acquire or deserve by one's efforts or actions", answer: "EARN" },
  { clue: "Duplicate or match", answer: "TWIN" },
  { clue: "Watch, observe, or inquire secretly", answer: "SPY" },
  { clue: "Be agreeable or acceptable to", answer: "SUIT" },
  { clue: "A triangular wooden float attached to the end of a log line", answer: "CHIP" },
  { clue: "Impress greatly", answer: "WOW" },
  { clue: "Singer of Rainbow in the Dark", answer: "DIO" },
  { clue: "Capital of Fiji", answer: "SUVA" },
  { clue: "Burn to charcoal", answer: "CHAR" },
  { clue: "Poet of 'The Raven'", answer: "POE" },
  { clue: "The repetition of a sound resulting from reflection of the sound waves", answer: "ECHO" },
  { clue: "A pattern of regularly spaced horizontal and vertical lines", answer: "GRID" },
  { clue: "Mediterranean tree widely cultivated for its edible fruit", answer: "FIG" },
  { clue: "Plan secretly, usually something illegal", answer: "PLOT" },
  { clue: "A long-playing phonograph record; designed to be played at 33.3 rpm", answer: "LP" },
  { clue: "Fearless and daring", answer: "BOLD" },
  { clue: "Examine minutely or intensely", answer: "SCAN" },
  { clue: "Advanced in years", answer: "AGED" },
  { clue: "The property of something that is great in magnitude", answer: "BULK" },
  { clue: "Obviously contrived to charm", answer: "CUTE" },
  { clue: "Look searchingly", answer: "PEER" },
  { clue: "To produce a sharp often metallic explosive or percussive sound", answer: "BANG" },
  { clue: "Utter monotonously and repetitively and rhythmically", answer: "TONE" },
  { clue: "Actively or fully engaged or occupied", answer: "BUSY" },
  { clue: "One of the supports for a piece of furniture", answer: "LEG" },
  { clue: "Kiss, embrace, or fondle with sexual passion", answer: "NECK" },
  { clue: "A movable organ for flying", answer: "WING" },
  { clue: "Enclose with rails", answer: "RAIL" },
  { clue: "Crested largely blue bird", answer: "JAY" },
  { clue: "Endless loop of flexible material between two rotating shafts or pulleys", answer: "BELT" },
  { clue: "Take something away by force or without the consent of the owner", answer: "ROB" },
  { clue: "Of southern Europe; similar to but smaller than the adder", answer: "ASP" },
  { clue: "An unknown and unpredictable phenomenon that leads to a favorable outcome", answer: "LUCK" },
  { clue: "Act as an organized group", answer: "GANG" },
  { clue: "A block of solid substance", answer: "CAKE" },
  { clue: "A small restaurant where drinks and snacks are sold", answer: "CAFE" },
  { clue: "Furnish with shoes", answer: "SHOE" },
  { clue: "A loose material consisting of grains of rock or coral", answer: "SAND" },
  { clue: "The emotion of great happiness", answer: "JOY" },
  { clue: "Transport by pipeline", answer: "PIPE" },
  { clue: "Unfavorably or with disapproval", answer: "ILL" },
  { clue: "Not of or from a profession", answer: "LAY" },
  { clue: "Be beautiful to look at", answer: "DECK" },
  { clue: "Lacking excess flesh", answer: "THIN" },
  { clue: "Treat with an agent; add to", answer: "DOSE" },
  { clue: "Stake on the outcome of an issue", answer: "BET" },
  { clue: "Chinese distance measure", answer: "LI" },
  { clue: "People in general", answer: "FOLK" },
  { clue: "The act of giving temporary assistance", answer: "LIFT" },
  { clue: "An informal term for a father; probably derived from baby talk", answer: "DAD" },
  { clue: "Pad for the floor", answer: "MAT" },
  { clue: "Sew a seam by folding the edges", answer: "FELL" },
  { clue: "The enclosed land around a house or other building", answer: "YARD" },
  { clue: "Cause to run", answer: "POUR" },
  { clue: "Limit or restrict to", answer: "TIE" },
  { clue: "The act of caressing with the lips", answer: "KISS" },
  { clue: "Relating to a recently developed fashion or style", answer: "MOD" },
  { clue: "Done under pressure", answer: "RUSH" },
  { clue: "An artificial source of visible illumination", answer: "LAMP" },
  { clue: "Showing or causing joy and pleasure; especially made happy", answer: "GLAD" },
  { clue: "Framework for holding objects", answer: "RACK" },
  { clue: "Informal abbreviation of representative", answer: "REP" },
  { clue: "A person responsible for hiring workers", answer: "BOSS" },
  { clue: "British physician who discovered that mosquitos transmit malaria", answer: "ROSS" },
  { clue: "A former copper coin of Pakistan and India", answer: "ANNA" },
  { clue: "Composed or performed by a single voice or instrument", answer: "SOLO" },
  { clue: "Great in stature", answer: "TALL" },
  { clue: "The wave that spreads behind a boat as it moves forward", answer: "WAKE" },
  { clue: "Make a rhythmic sound", answer: "DRUM" },
  { clue: "Move gently or carefully", answer: "EASE" },
  { clue: "A coniferous tree", answer: "PINE" },
  { clue: "Be inclined", answer: "TEND" },
  { clue: "An unbridgeable disparity", answer: "GULF" },
  { clue: "Pursue for food or sport", answer: "HUNT" },
  { clue: "Of or relating to or characteristic of Thailand or its people", answer: "THAI" },
  { clue: "Destroy by fire", answer: "BURN" },
  { clue: "Be located or situated somewhere; occupy a certain position", answer: "LIE" },
  { clue: "Wanting in physical strength", answer: "WEAK" },
  { clue: "Having or prompted by wisdom or discernment", answer: "WISE" },
  { clue: "The likelihood of a thing occurring rather than not occurring", answer: "ODDS" },
  { clue: "The day before", answer: "EVE" },
  { clue: "The main organ of photosynthesis and transpiration in higher plants", answer: "LEAF" },
  { clue: "A number of sheets of paper fastened together along one edge", answer: "PAD" },
  { clue: "A long thin implement made of metal or wood", answer: "ROD" },
  { clue: "A fabric made from the fine threads produced by certain insect larvae", answer: "SILK" },
  { clue: "Experiencing or showing sorrow or unhappiness", answer: "SAD" },
  { clue: "Eat hastily", answer: "WOLF" },
  { clue: "Drive or propel with the foot", answer: "KICK" },
  { clue: "The food served and eaten at one time", answer: "MEAL" },
  { clue: "Insert inconspicuously or quickly or quietly", answer: "SLIP" },
  { clue: "Throw eggs at", answer: "EGG" },
  { clue: "Something that resembles a tablet of medicine in shape or size", answer: "PILL" },
  { clue: "Revolve quickly and repeatedly around one's own axis", answer: "SPIN" },
  { clue: "Clean with some chemical process", answer: "WASH" },
  { clue: "A man distinguished by exceptional courage and nobility and strength", answer: "HERO" },
  { clue: "Substance that smolders when ignited; used to light fuses", answer: "PUNK" },
  { clue: "The 16th letter of the Greek alphabet", answer: "PI" },
  { clue: "A British peer of the highest rank", answer: "DUKE" },
  { clue: "Walk with slow or fast paces", answer: "PACE" },
  { clue: "Something that remunerates", answer: "WAGE" },
  { clue: "A continuous portion of a circle", answer: "ARC" },
  { clue: "The first light of day", answer: "DAWN" },
  { clue: "A form of address for a married woman", answer: "MRS" },
  { clue: "A small replica of a person; used as a toy", answer: "DOLL" },
  { clue: "Winged goddess of victory; identified with Roman Victoria", answer: "NIKE" },
  { clue: "Prohibit especially by legal means or social pressure", answer: "BAN" },
  { clue: "A worker hired on a temporary basis", answer: "TEMP" },
  { clue: "Not divisible by two", answer: "ODD" },
  { clue: "Arrange or fold as a cover or protection", answer: "WRAP" },
  { clue: "Express with a beaming face or smile", answer: "BEAM" },
  { clue: "Not open", answer: "SHUT" },
  { clue: "A covering to disguise or conceal the face", answer: "MASK" },
  { clue: "Fossil fuel consisting of carbonized vegetable matter", answer: "COAL" },
  { clue: "A celebrity who is lionized", answer: "LION" },
  { clue: "Cattle that are reared for their meat", answer: "BEEF" },
  { clue: "Someone who is morally reprehensible", answer: "CAD" },
  { clue: "Waves breaking on the shore", answer: "SURF" },
  { clue: "Stack in cords", answer: "CORD" },
  { clue: "Cut short", answer: "CROP" },
  { clue: "Deliver by singing", answer: "SING" },
  { clue: "A large number or amount", answer: "TONS" },
  { clue: "Cause to be suspended physically", answer: "HANG" },
  { clue: "The 22nd letter of the Greek alphabet", answer: "CHI" },
  { clue: "Adjust for functioning", answer: "TUNE" },
  { clue: "Journey on foot in the mountains", answer: "TREK" },
  { clue: "Catch vermin, especially with dogs", answer: "RAT" },
  { clue: "A committee appointed to judge", answer: "JURY" },
  { clue: "An operating system that is on a disk", answer: "DOS" },
  { clue: "Remove the stalk of fruits or berries", answer: "TAIL" },
  { clue: "A field of cultivated and mowed grass", answer: "LAWN" },
  { clue: "Major food fish of Arctic", answer: "COD" },
  { clue: "A state of arrangement or appearance", answer: "TRIM" },
  { clue: "Informal term for information", answer: "GEN" },
  { clue: "Large vault for the dead", answer: "TOMB" },
  { clue: "Make up", answer: "COIN" },
  { clue: "Something that is a counterfeit; not what it seems to be", answer: "FAKE" },
  { clue: "Prepare by drying, salting, or chemical processing in order to preserve", answer: "CURE" },
  { clue: "Expert in skulduggery", answer: "ARCH" },
  { clue: "An explosive device fused to explode under specific conditions", answer: "BOMB" },
  { clue: "Distinguished from Bovidae by the male's having solid deciduous antlers", answer: "DEER" },
  { clue: "Used to cover the head", answer: "HAT" },
  { clue: "Kitchen appliance used for baking or roasting", answer: "OVEN" },
  { clue: "The middle of the day", answer: "NOON" },
  { clue: "A Hebrew minor prophet", answer: "JOEL" },
  { clue: "Of a light yellowish-brown color", answer: "TAN" },
  { clue: "The officer below the master on a commercial ship", answer: "MATE" },
  { clue: "Dish baked in pastry-lined pan often with a pastry top", answer: "PIE" },
  { clue: "Bend one's knee or body, or lower one's head", answer: "BOW" },
  { clue: "Englishman and Quaker who founded the colony of Pennsylvania", answer: "PENN" },
  { clue: "Used of women's clothing having a hemline at mid-calf", answer: "MIDI" },
  { clue: "Fastened with strings or cords", answer: "TIED" },
  { clue: "An open river valley", answer: "DALE" },
  { clue: "A man who is virile and sexually active", answer: "STUD" },
  { clue: "Bend or lay so that one part covers the other", answer: "FOLD" },
  { clue: "A long rod of wood or metal or plastic", answer: "POLE" },
  { clue: "Form a curve", answer: "BEND" },
  { clue: "A narrow secluded valley", answer: "GLEN" },
  { clue: "Small two-wheeled horse-drawn carriage; with two seats and a folding hood", answer: "CAB" },
  { clue: "Lose interest or become bored with something or somebody", answer: "TIRE" },
  { clue: "Pull, as against a resistance", answer: "DRAG" },
  { clue: "Fully developed or matured and ready to be eaten or used", answer: "RIPE" },
  { clue: "Hit the _ on the head", answer: "NAIL" },
  { clue: "The complete duration of something", answer: "SPAN" },
  { clue: "A large open vessel for holding or storing liquids", answer: "TUB" },
  { clue: "Convert into ashes", answer: "ASH" },
  { clue: "Become bubbly or frothy or foaming", answer: "FOAM" },
  { clue: "A composition written in metrical feet forming rhythmical lines", answer: "POEM" },
  { clue: "Hit on the head, especially with a pitched baseball", answer: "BEAN" },
  { clue: "Slanting diagonally across the grain of a fabric", answer: "BIAS" },
  { clue: "A tool for cutting female screw threads", answer: "TAP" },
  { clue: "Travel through water", answer: "SWIM" },
  { clue: "Any of numerous hairy-bodied insects including social and solitary species", answer: "BEE" },
  { clue: "Characterized by or producing sound of great volume or intensity", answer: "LOUD" },
  { clue: "United States professional baseball player famous for hitting home runs", answer: "RUTH" },
  { clue: "The head of the Roman Catholic Church", answer: "POPE" },
  { clue: "A car suitable for traveling over rough terrain", answer: "JEEP" },
  { clue: "Completely unclothed", answer: "BARE" },
  { clue: "Set into opposition or rivalry", answer: "PIT" },
  { clue: "Designating sound transmission or recording over a single channel", answer: "MONO" },
  { clue: "Cover with tiles", answer: "TILE" },
  { clue: "Insincere talk about religion or morals", answer: "CANT" },
  { clue: "To move quickly downwards or away", answer: "DUCK" },
  { clue: "The 21st letter of the Greek alphabet", answer: "PHI" },
  { clue: "Plunge into water", answer: "DIVE" },
  { clue: "An attempt by speculators to defraud investors", answer: "RAID" },
  { clue: "A carnival performer who does disgusting acts", answer: "GEEK" },
  { clue: "Fall or descend to a lower place or level", answer: "SINK" },
  { clue: "An intellectual hold or understanding", answer: "GRIP" },
  { clue: "Hunt frogs for food", answer: "FROG" },
  { clue: "A spell of cold weather", answer: "SNAP" },
  { clue: "Female counterpart of buck", answer: "DOE" },
  { clue: "Move into memory", answer: "LOAD" },
  { clue: "Hot or cold alcoholic mixed drink containing a beaten egg", answer: "FLIP" },
  { clue: "Strike at with firepower or bombs", answer: "NUKE" },
  { clue: "Relieve from", answer: "RID" },
  { clue: "Make a resonant sound, like artillery", answer: "BOOM" },
  { clue: "Not agitated; without losing self-possession", answer: "CALM" },
  { clue: "Cutlery used for serving and eating food", answer: "FORK" },
  { clue: "Move precipitously or violently", answer: "RIP" },
  { clue: "An open receptacle for holding or displaying or serving articles or food", answer: "TRAY" },
  { clue: "Having wisdom that comes with age and experience", answer: "SAGE" },
  { clue: "Either of the two parts of a bilabiate corolla or calyx", answer: "LIP" },
  { clue: "Excavate the earth beneath", answer: "SAP" },
  { clue: "A fabric made from the hair of sheep", answer: "WOOL" },
  { clue: "The 13th letter of the Greek alphabet", answer: "NU" },
  { clue: "A mechanical device for gripping an object", answer: "GRAB" },
  { clue: "The 14th letter of the Greek alphabet", answer: "XI" },
  { clue: "Place in a confining or embarrassing position", answer: "TRAP" },
  { clue: "A delicate decorative fabric woven in an open web of symmetrical patterns", answer: "LACE" },
  { clue: "Displeasing to the senses", answer: "UGLY" },
  { clue: "A hand with the fingers clenched in the palm", answer: "FIST" },
  { clue: "Being nothing more than specified", answer: "MERE" },
  { clue: "Turn up, loosen, or remove earth", answer: "DIG" },
  { clue: "Travel slowly", answer: "TAXI" },
  { clue: "Affected by wear; damaged by long use", answer: "WORN" },
  { clue: "Declare untrue; contradict", answer: "DENY" },
  { clue: "A Buddhist doctrine that enlightenment can be attained through direct intuitive insight", answer: "ZEN" },
  { clue: "God of the underworld; counterpart of Greek Pluto", answer: "DIS" },
  { clue: "Personification of a sacred intoxicating drink used in Vedic ritual", answer: "SOMA" },
  { clue: "Any one of two or more competitors who tie one another", answer: "TIER" },
  { clue: "A British peer ranking below a marquess and above a viscount", answer: "EARL" },
  { clue: "A strong line", answer: "ROPE" },
  { clue: "Sever all ties with, usually unceremoniously or irresponsibly", answer: "DUMP" },
  { clue: "A flexible pipe for conveying a liquid or gas", answer: "HOSE" },
  { clue: "Droplets of water vapor suspended in the air near the ground", answer: "FOG" },
  { clue: "Moderate in type or degree or effect or force; far from extreme", answer: "MILD" },
  { clue: "The dressed hairy coat of a mammal", answer: "FUR" },
  { clue: "Flat tableland with steep edges", answer: "MESA" },
  { clue: "Remove the hulls from", answer: "HULL" },
  { clue: "Get rid of", answer: "SHED" },
  { clue: "A written proposal or reminder", answer: "MEMO" },
  { clue: "Meat cut from the thigh of a hog", answer: "HAM" },
  { clue: "A state of nervous depression", answer: "FUNK" },
  { clue: "Something that hinders as if with bonds", answer: "BIND" },
  { clue: "The basic unit of money in South Africa; equal to 100 cents", answer: "RAND" },
  { clue: "Mature male of various mammals", answer: "BUCK" },
  { clue: "A unit of area used in English-speaking countries", answer: "ACRE" },
  { clue: "A persistently annoying person", answer: "PEST" },
  { clue: "Lower and bring partially inboard", answer: "REEF" },
  { clue: "An upholstered seat for more than one person", answer: "SOFA" },
  { clue: "A vessel with a wide mouth and without handles", answer: "JAR" },
  { clue: "One who works hard at boring tasks", answer: "HACK" },
  { clue: "A challenge to do something dangerous or foolhardy", answer: "DARE" },
  { clue: "Hunt with hawks", answer: "HAWK" },
  { clue: "Lettuce with long dark-green leaves in a loosely packed elongated head", answer: "COS" },
  { clue: "Any of various Chinese boats with a high poop and lugsails", answer: "JUNK" },
  { clue: "Incomplete skeleton of female found in eastern Ethiopia in 1974", answer: "LUCY" },
  { clue: "Very imposing or impressive; surpassing the ordinary", answer: "EPIC" },
  { clue: "Gather nuts", answer: "NUT" },
  { clue: "A reason for wanting something done", answer: "SAKE" },
  { clue: "To incline or bend from a vertical position", answer: "LEAN" },
  { clue: "Of or being the lowest female voice", answer: "ALTO" },
  { clue: "Wound by piercing with a sharp or penetrating object or instrument", answer: "GORE" },
  { clue: "Followers of an exclusive system of religious beliefs and practices", answer: "CULT" },
  { clue: "Distinctive and stylish elegance", answer: "DASH" },
  { clue: "Hit with a pinging noise", answer: "PING" },
  { clue: "The rate of flow of energy or particles across a given surface", answer: "FLUX" },
  { clue: "Be violent; as of fires and storms", answer: "RAGE" },
  { clue: "A county in southwestern England", answer: "AVON" },
  { clue: "Cancel, annul, or reverse an action or its effect", answer: "UNDO" },
  { clue: "A circle of light around the sun or moon", answer: "HALO" },
  { clue: "Naturally disposed toward", answer: "APT" },
  { clue: "Art highly prized for its beauty or perfection", answer: "GEM" },
  { clue: "The second largest of the Hawaiian Islands", answer: "MAUI" },
  { clue: "The 23rd letter of the Greek alphabet", answer: "PSI" },
  { clue: "A step in dancing", answer: "PAS" },
  { clue: "An unpleasant or disastrous destiny", answer: "DOOM" },
  { clue: "A light informal meal", answer: "BITE" },
  { clue: "Long and light rowing boat; especially for racing", answer: "GIG" },
  { clue: "Clear of weeds", answer: "WEED" },
  { clue: "A rectangular area surrounded on all sides by buildings", answer: "QUAD" },
  { clue: "Meat from a domestic hog or pig", answer: "PORK" },
  { clue: "Eat well", answer: "FARE" },
  { clue: "With no effort to conceal", answer: "BALD" },
  { clue: "Shrubby Japanese cherry tree having pale pink blossoms", answer: "FUJI" },
  { clue: "A historical area and former kingdom in northwestern Spain", answer: "LEON" },
  { clue: "Spoil due to humidity", answer: "MOLD" },
  { clue: "Informal term for a woman", answer: "DAME" },
  { clue: "Aromatic potherb used in cookery for its savory qualities", answer: "HERB" },
  { clue: "Not in action or at work", answer: "IDLE" },
  { clue: "The closest of Jupiter's moons; has active volcanoes", answer: "IO" },
  { clue: "Water soaked soil; soft wet earth", answer: "MUD" },
  { clue: "A small inlet", answer: "COVE" },
  { clue: "The 12th letter of the Greek alphabet", answer: "MU" },
  { clue: "Any place of complete bliss and delight and peace", answer: "EDEN" },
  { clue: "A flat wing-shaped process or winglike part of an organism", answer: "ALA" },
  { clue: "A depression in an otherwise level surface", answer: "DIP" },
  { clue: "Chop up", answer: "HASH" },
  { clue: "Moving slowly and gently", answer: "LAZY" },
  { clue: "The basic unit of money in Japan; equal to 100 sen", answer: "YEN" },
  { clue: "A person who has a nasty or unethical character undeserving of respect", answer: "WORM" },
  { clue: "Lacking or deprived of the sense of hearing wholly or in part", answer: "DEAF" },
  { clue: "An actor who communicates entirely by gesture and facial expression", answer: "MIME" },
  { clue: "A funeral lament sung with loud wailing", answer: "KEEN" },
  { clue: "A Hindu or Buddhist religious leader and spiritual teacher", answer: "GURU" },
  { clue: "Impose and collect", answer: "LEVY" },
  { clue: "Very light colored; highly diluted with white", answer: "PALE" },
  { clue: "Separate or cause to separate abruptly", answer: "TEAR" },
  { clue: "Lacking in light; not bright or harsh", answer: "DIM" },
  { clue: "A material effigy that is worshipped", answer: "IDOL" },
  { clue: "A concave shape with concavity that faces downward", answer: "DOME" },
  { clue: "The bright, positive principle in Chinese dualistic cosmology", answer: "YANG" },
  { clue: "Lacking the power of human speech", answer: "DUMB" },
  { clue: "A notable achievement", answer: "FEAT" },
  { clue: "Used to show that a word is quoted exactly", answer: "SIC" },
  { clue: "Be high-spirited", answer: "GLOW" },
  { clue: "A standard regarded as typical", answer: "NORM" },
  { clue: "Pale, giving the impression of illness", answer: "WAN" },
  { clue: "A posture assumed by models for photographic purposes", answer: "POSE" },
  { clue: "Traverse the sea", answer: "SAIL" },
  { clue: "A dialect of Chinese spoken in the Yangtze delta", answer: "WU" },
  { clue: "Impel in an indicated direction", answer: "URGE" },
  { clue: "Characterized by solitude", answer: "LONE" },
  { clue: "A long cloak; worn by a priest or bishop on ceremonial occasions", answer: "COPE" },
  { clue: "A Scottish church", answer: "KIRK" },
  { clue: "Highly valued northern freshwater fish", answer: "PIKE" },
  { clue: "Vacuum tube technology used in older monitors", answer: "CRT" },
];

const GRID_SIZE = 5;

function _shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generatePuzzle() {
  let grid        = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
  let placedWords = [];

  const cluePool = _shuffle(
    crosswordClues
      .map(c => ({ clue: c.clue, answer: c.answer.toUpperCase() }))
      .filter(c => c.answer.length >= 2 && c.answer.length <= GRID_SIZE)
      .filter((c, i, arr) => arr.findIndex(x => x.answer === c.answer) === i)
  );

  function placeFirstWord(clueObj) {
    const word = clueObj.answer;
    const row  = Math.floor(GRID_SIZE / 2);
    const col  = Math.floor((GRID_SIZE - word.length) / 2);
    for (let i = 0; i < word.length; i++) grid[row][col + i] = word[i];
    placedWords.push({ answer: word, clue: clueObj.clue, row, col, dir: 'across' });
  }

  function canPlace(word, row, col, dir) {
    if (dir === 'across') {
      if (row < 0 || row >= GRID_SIZE || col < 0 || col + word.length > GRID_SIZE) return false;
      if (col > 0 && grid[row][col - 1] !== '') return false;
      if (col + word.length < GRID_SIZE && grid[row][col + word.length] !== '') return false;
    } else {
      if (col < 0 || col >= GRID_SIZE || row < 0 || row + word.length > GRID_SIZE) return false;
      if (row > 0 && grid[row - 1][col] !== '') return false;
      if (row + word.length < GRID_SIZE && grid[row + word.length][col] !== '') return false;
    }
    let intersects = false;
    for (let i = 0; i < word.length; i++) {
      const r = dir === 'across' ? row     : row + i;
      const c = dir === 'across' ? col + i : col;
      if (grid[r][c] !== '') {
        if (grid[r][c] !== word[i]) return false;
        intersects = true;
      } else {
        if (dir === 'across') {
          if (r > 0 && grid[r - 1][c] !== '') return false;
          if (r < GRID_SIZE - 1 && grid[r + 1][c] !== '') return false;
        } else {
          if (c > 0 && grid[r][c - 1] !== '') return false;
          if (c < GRID_SIZE - 1 && grid[r][c + 1] !== '') return false;
        }
      }
    }
    return intersects;
  }

  function placeWord(clueObj) {
    const word = clueObj.answer;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        for (let i = 0; i < word.length; i++) {
          if (grid[r][c] === word[i]) {
            const startRow = r - i;
            if (canPlace(word, startRow, c, 'down')) {
              for (let j = 0; j < word.length; j++) grid[startRow + j][c] = word[j];
              placedWords.push({ answer: word, clue: clueObj.clue, row: startRow, col: c, dir: 'down' });
              return true;
            }
            const startCol = c - i;
            if (canPlace(word, r, startCol, 'across')) {
              for (let j = 0; j < word.length; j++) grid[r][startCol + j] = word[j];
              placedWords.push({ answer: word, clue: clueObj.clue, row: r, col: startCol, dir: 'across' });
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function buildGrid() {
    grid        = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
    placedWords = [];
    _shuffle(cluePool);
    placeFirstWord(cluePool[0]);
    let placed = 1;
    for (let i = 1; i < cluePool.length; i++) {
      if (placeWord(cluePool[i])) placed++;
    }
    return placed;
  }

  while (buildGrid() < 8) { /* retry */ }

  return { size: GRID_SIZE, grid, placedWords };
}

// ── GET /api/puzzle ───────────────────────────────────────────────────────────
app.get('/api/puzzle', (req, res) => {
  try {
    return res.json(generatePuzzle());
  } catch (err) {
    console.error('Puzzle generation error:', err.message);
    return res.status(500).json({ message: 'Failed to generate puzzle' });
  }
});
app.get('/api/players', (req, res) => {
  try {
    return res.json(Array.from(clients.keys()));
  } catch (err) {
    console.error('Player retrieval error:', err.message);
    return res.status(500).json({ message: 'Failed to retrieve list of connected players' });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// EXPORT — must be app.listen(), not just app, so chai-http can bind to it
// ═════════════════════════════════════════════════════════════════════════════
module.exports = server.listen(PORT);
console.log(`Gridly running on port ${PORT}`);