// tmp.js — Gridly application server
// ─────────────────────────────────────────────────────────────────────────────
// This file is both the web-app entry point (started by nodemon via npm start)
// AND the module imported by test/server.spec.js (via require('../tmp')).
//
// Design rule: if the incoming request carries Content-Type: application/json
// (which chai-http sets automatically when you call .send(object)), the route
// returns a JSON response with the correct HTTP status code.
// Browser form submissions (Content-Type: application/x-www-form-urlencoded)
// get redirects / rendered pages as normal.
// ─────────────────────────────────────────────────────────────────────────────

const express       = require('express');
const path          = require('path');
const pgp           = require('pg-promise')();
const bodyParser    = require('body-parser');
const session       = require('express-session');
const bcrypt        = require('bcryptjs');
const handlebars    = require('express-handlebars');
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

// ── Helper ────────────────────────────────────────────────────────────────────
// chai-http .send(object) automatically sets Content-Type: application/json,
// so this check correctly detects API / test calls vs. browser form POSTs.
const wantsJson = (req) =>
  !!req.is('application/json') ||
  !!(req.headers.accept && req.headers.accept.includes('application/json'));

// ── Auth guard (web pages only) ───────────────────────────────────────────────
const auth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── Default probe — required by the starter test case in server.spec.js ──────
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.get('/', (req, res) => res.redirect('/login'));

// ── Page renders ─────────────────────────────────────────────────────────────
app.get('/login',    (req, res) => res.render('pages/login'));
app.get('/register', (req, res) => res.render('pages/register'));
app.get('/leaderboard', (req, res) => {res.render('pages/leaderboard');});

//single player page route
app.get('/singleplayer', auth, (req, res) => res.render('pages/SinglePlayer', { layout: false, user: req.session.user }));


// ── POST /register ────────────────────────────────────────────────────────────
//
//  Positive case  → 200  { message: 'Success' }
//  Negative cases → 400  { message: 'Invalid input' }
//     • missing username or password (catches empty-string '')
//     • duplicate username already in DB
app.post('/register', async (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body;

  // ── 1. Field validation ────────────────────────────────────────────────────
  if (!username || !password) {
    if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
    return res.redirect('/register');
  }

  try {
    // ── 2. Duplicate check ───────────────────────────────────────────────────
    const existing = await db.oneOrNone(
      'SELECT username FROM users WHERE username = $1',
      [username]
    );
    if (existing) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid input' });
      return res.redirect('/register');
    }

    // ── 3. Hash & insert ─────────────────────────────────────────────────────
    const hash = await bcrypt.hash(password, 10);
    await db.none(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hash]
    );

    // ── 4. Security question (web form only — API tests don't send it) ───────
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

// ── POST /login ───────────────────────────────────────────────────────────────
//
//  Positive case  → 200  { message: 'Login successful', username }
//  Negative cases → 400  { message: 'Invalid credentials' }
//     • username not found in DB
//     • password does not match stored hash
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
    return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
  }

  try {
    const user = await db.oneOrNone(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (!user) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
      return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      if (wantsJson(req)) return res.status(400).json({ message: 'Invalid credentials' });
      return res.render('pages/login', { message: 'Incorrect username or password.', error: true });
    }

    // Success
    req.session.user = user;
    req.session.save();

    if (wantsJson(req)) return res.status(200).json({ message: 'Login successful', username: user.username });
    return res.redirect('/home');

  } catch (err) {
    console.error('Login error:', err.message);
    if (wantsJson(req)) return res.status(500).json({ message: 'Server error' });
    return res.redirect('/login');
  }
});

// ── Authenticated pages ───────────────────────────────────────────────────────
app.get('/home',   auth, (req, res) => res.render('pages/home', { user: req.session.user }));
app.get('/logout', auth, (req, res) => { req.session.destroy(); res.redirect('/login'); });
app.get('/profile', auth, (req, res) => {res.render('pages/Profile', { user: req.session.user});});
app.get('/Settings', auth, (req, res) => {res.render('pages/Settings', { user: req.session.user});});
// ── Forgot-password flow ──────────────────────────────────────────────────────
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
      return res.render('pages/forgot-password', { message: 'Username not found.', error: true });
    }
    res.render('pages/forgot-password', {
      question:     row.question,
      questionText: questionMap[row.question] || row.question,
      username:     req.body.username,
    });
  } catch (err) {
    res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
  }
});

app.post('/verify-answer', async (req, res) => {
  try {
    const row = await db.oneOrNone(
      'SELECT answer FROM security_questions WHERE username = $1 AND question = $2',
      [req.body.username, req.body.question]
    );
    if (!row || row.answer.toLowerCase() !== req.body.securityAnswer.toLowerCase()) {
      return res.render('pages/forgot-password', { message: 'Incorrect answer.', error: true });
    }
    res.render('pages/forgot-password', { resetReady: true, username: req.body.username });
  } catch (err) {
    res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
  }
});

app.post('/reset-password', async (req, res) => {
  const { username, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) {
    return res.render('pages/forgot-password', {
      message: 'Passwords do not match.', error: true, resetReady: true, username,
    });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.none('UPDATE users SET password = $1 WHERE username = $2', [hash, username]);
    res.render('pages/login', { message: 'Password reset successful. Please log in.', error: false });
  } catch (err) {
    res.render('pages/forgot-password', { message: 'An error occurred.', error: true });
  }
});

// ── Test-only cleanup route (DELETE a user by username) ───────────────────────
// Only active when NODE_ENV is not 'production' so it can never run in prod
app.post('/test-cleanup', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  try {
    await db.none('DELETE FROM users WHERE username = $1', [req.body.username]);
    return res.status(200).json({ message: 'Cleaned' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /game-session  (save a completed puzzle) ─────────────────────────────
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

// ── GET /api/leaderboard  (top 20 fastest completions) ───────────────────────
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

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT — must be app.listen(), not just app, so chai-http can bind to it
// ═════════════════════════════════════════════════════════════════════════════
module.exports = app.listen(PORT);
console.log(`Gridly running on port ${PORT}`);
