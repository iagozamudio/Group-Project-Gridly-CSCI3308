
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

function determineWinner(playerOneScore, playerTwoScore, playerOneTime, playerTwoTime) {
  if (playerOneScore > playerTwoScore) return 1;
  if (playerTwoScore > playerOneScore) return 2;
  if (playerOneTime < playerTwoTime) return 1;
  if (playerTwoTime < playerOneTime) return 2;
  return 0;
}

function calculateRating(playerRating, opponentRating, playerScore, opponentScore, didWin) {
  const scoreDiff = Math.abs(playerScore - opponentScore);
  let delta = Math.max(10, Math.round(scoreDiff * 0.1));

  if (didWin && playerRating < opponentRating) {
    delta += Math.round((opponentRating - playerRating) * 0.05);
  }

  if (!didWin && playerRating > opponentRating) {
    delta += Math.round((playerRating - opponentRating) * 0.05);
  }

  return delta;
}

function updateRatings(playerOneRating, playerTwoRating, playerOneScore, playerTwoScore, playerOneTime, playerTwoTime) {
  const winner = determineWinner(playerOneScore, playerTwoScore, playerOneTime, playerTwoTime);

  let p1New = playerOneRating;
  let p2New = playerTwoRating;

  if (winner === 1) {
    const delta = calculateRating(playerOneRating, playerTwoRating, playerOneScore, playerTwoScore, true);
    p1New = playerOneRating + delta;
    p2New = playerTwoRating - delta;
  } else if (winner === 2) {
    const delta = calculateRating(playerTwoRating, playerOneRating, playerTwoScore, playerOneScore, true);
    p2New = playerTwoRating + delta;
    p1New = playerOneRating - delta;
  }

  return {
    winner,
    playerOne: { before: playerOneRating, after: p1New },
    playerTwo: { before: playerTwoRating, after: p2New }
  };
}

function generateMatchId() {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
      const recipient = clients.get(messageJSON.recipient);
      if (messageJSON.type === "chat") { 
       // pull recipient socket instance from map

        if (!recipient) { // if recipient socket not found in clients map (e.g. they have disconnected or dont exist)
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
      } else if (messageJSON.type == "challenge"){ // challenge/inviting other player to a game and all requests related to it
        console.log("challenge recieved")
        const status = messageJSON.status;
        if (status == "sending"){ // challenge being sent from one user to another
          recipient.send(JSON.stringify(messageJSON));
          console.log("sending challenge")
        } else if (status == "accepting"){ // acceptance being sent back from recipient
          insertSessions(messageJSON.recipient, username).then(sessionIDs =>{
            let response = {
              "type": "challenge",
              "status": "redirect"
            }
            let response1 = {
              ...response,
              session_id: sessionIDs[0]
            } 
            let response2 = {
              ...response,
              session_id: sessionIDs[1]
            }
            ws.send(JSON.stringify(response2))
            recipient.send(JSON.stringify(response1))
          }).catch(console.error);
          
        } else if (status == "rejecting"){ // rejection being sent back from recipient

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


async function insertSessions(user1, user2) {
  try {
    const puzzleData = generatePuzzle();
    const isTwoPlayer = !!(user1 && user2);
    const match_id = isTwoPlayer ? generateMatchId() : null;
    const result1 = await db.query(
      `INSERT INTO game_sessions (match_id, username, puzzle_data, twoplayer, opponent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING session_id`,
      [match_id, user1, puzzleData, isTwoPlayer, user2]
    );

    let result2 = [{session_id: null}];  // just so I can reuse this function in 1p and 2p scenarios
    if (user2 != null){
      result2 = await db.query(
        `INSERT INTO game_sessions (match_id, username, puzzle_data, twoplayer, opponent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING session_id`,
        [match_id, user2, puzzleData, isTwoPlayer, user1]
      );
    }


    return [result1[0].session_id, result2[0].session_id];

  } catch (err) {
    console.error("DB ERROR:", err);
    throw err;
  }
}
// ── Database ──────────────────────────────────────────────────────────────────
const db = pgp({
  host:     process.env.POSTGRES_HOST || 'db',  // Changed this line
  port:     5432,
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }) // Add SSL for Render
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

async function getPlayerRating(username) {
  const row = await db.one(
    'SELECT rating FROM users WHERE username = $1',
    [username]
  );
  return row.rating;
}
// ── Get user game history (last 10 sessions) ─────────────────────────────────
// This function retrieves the last 10 game sessions for a given user, combining both single-player and multiplayer sessions. It returns an array of session objects with details such as game type, score, time taken, completion status, and result (win/loss for multiplayer).

async function finalizeMatchRatings(session_id) {
  const currentSession = await db.oneOrNone(
    `SELECT session_id, username, score, time_seconds, match_id, twoplayer
     FROM game_sessions
     WHERE session_id = $1`,
    [session_id]
  );

  if (!currentSession || !currentSession.twoplayer || !currentSession.match_id) {
    return;
  }

  const sessions = await db.any(
    `SELECT session_id, username, score, time_seconds, completed_at
     FROM game_sessions
     WHERE match_id = $1`,
    [currentSession.match_id]
  );

  if (sessions.length !== 2) return;

  const playerOne = sessions[0];
  const playerTwo = sessions[1];

  if (!playerOne.completed_at || !playerTwo.completed_at) {
    return;
  }

  const playerOneRating = await getPlayerRating(playerOne.username);
  const playerTwoRating = await getPlayerRating(playerTwo.username);

  const result = updateRatings(
    playerOneRating,
    playerTwoRating,
    Number(playerOne.score),
    Number(playerTwo.score),
    Number(playerOne.time_seconds),
    Number(playerTwo.time_seconds)
  );

  await db.none(
    `UPDATE users
     SET rating = $1
     WHERE username = $2`,
    [result.playerOne.after, playerOne.username]
  );

  await db.none(
    `UPDATE users
     SET rating = $1
     WHERE username = $2`,
    [result.playerTwo.after, playerTwo.username]
  );
}

async function getUserGameHistory(username){
  const query = `SELECT 
  CASE WHEN twoplayer THEN 'multi' ELSE 'single' END AS game_type,
  'single' AS game_type,
  session_id AS game_id,
  score,
  time_seconds,
  completed_at,
  NULL AS result
FROM game_sessions
WHERE username = $1
ORDER BY completed_at DESC
LIMIT 10`;
  
//The try and catch block is used for nay error handling. Is it passes, we create a variable called history and assign it the value of the query result. 
//Teh funciton shoud return a  
    try {
      const history = await db.any(query, [username]);
      for (const game of history){
        if (game.game_type === 'multi'){
      const opponentGame = await db.oneOrNone(
          `SELECT score, time_seconds
           FROM game_sessions
           WHERE match_id = (
             SELECT match_id
             FROM game_sessions
             WHERE session_id = $1
           )
           AND session_id <> $1
           LIMIT 1`,
          [game.game_id]
        );

        if (opponentGame) {
          if (Number(game.score) > Number(opponentGame.score)) {
            game.result = 'Win';
          } else if (Number(game.score) < Number(opponentGame.score)) {
            game.result = 'Loss';
          } else if (Number(game.time_seconds) < Number(opponentGame.time_seconds)) {
            game.result = 'Win';
          } else if (Number(game.time_seconds) > Number(opponentGame.time_seconds)) {
            game.result = 'Loss';
          } else {
            game.result = 'Draw';
          }
        }
      }
    }

    return history;
  } catch (err) {
    console.error('Error fetching game history:', err.message);
    throw err;
  }

}; 


//COALESCE is a SQL function that returns the first non-NULL value.
// ── Get user stats ─────────────────────────────────
async function getUserStats(username) {
  const singlePlayerQuery = `
    SELECT
      COUNT(*) AS num_of_single_games,
      COALESCE(MAX(score), 0) AS best_single_score,
      COALESCE(SUM(score), 0) AS total_points
    FROM game_sessions
    WHERE username = $1
  `;

  const multiPlayerQuery = `
    SELECT
      session_id,
      score,
      time_seconds,
      match_id
    FROM game_sessions
    WHERE username = $1
        AND completed_at IS NOT NULL
        AND twoplayer = TRUE
  `;

  const ratingQuery = `
    SELECT rating
    FROM users
    WHERE username = $1
  `;

  try {
    const singlePlayerStats = await db.one(singlePlayerQuery, [username]);
    const multiPlayerStats = await db.any(multiPlayerQuery, [username]);
    const ratingRow = await db.one(ratingQuery, [username]);

    const totalGames =
      Number(singlePlayerStats.num_of_single_games) +
      Number(multiPlayerStats.num_of_multi_games);

    const wins = Number(multiPlayerStats.num_wins);
    const multiGames = Number(multiPlayerStats.num_of_multi_games);
    const winRate = multiGames > 0 ? ((wins / multiGames) * 100).toFixed(1) : "0.0";
    const totalScore = Number(singlePlayerStats.total_points).toFixed(0);

    return {
      totalGames,
      bestSingleScore: Number(singlePlayerStats.best_single_score).toFixed(0),
      wins,
      winRate,
      totalScore,
      rating: Number(ratingRow.rating)
    };
  } catch (err) {
    console.error('Error fetching user stats:', err.message);
    throw err;
  }
}

// ── Get user player rankings ─────────────────────────────────
async function getUserRankings(username) {
  const SingleScoreRankQuery = `
  SELECT rank FROM (
    SELECT
      username, 
      DENSE_RANK() OVER (ORDER BY MAX(score) DESC) AS rank
      FROM game_sessions
      WHERE username IS NOT NULL
      GROUP BY username
      )ranked 
      WHERE username = $1 `; 

    const fastestTimeQuery = `
    SELECT rank FROM (
      SELECT
        username, 
        DENSE_RANK() OVER (ORDER BY MIN(time_seconds) ASC) AS rank
        FROM game_sessions
        WHERE username IS NOT NULL
        GROUP BY username
        )ranked 
        WHERE username = $1
    `; 

    const twoPlayerRankQuery = `
    SELECT rank
    FROM (
      SELECT
        username,
        DENSE_RANK() OVER (ORDER BY rating DESC) AS rank
      FROM users
      WHERE username IS NOT NULL
    ) ranked
    WHERE username = $1
  `;

  try{
    const singleScoreRank = await db.oneOrNone(SingleScoreRankQuery, [username]);
    const fastestTimeRank = await db.oneOrNone(fastestTimeQuery, [username]);
    const twoPlayerRank = await db.oneOrNone(twoPlayerRankQuery, [username]);

    return {
      singleScoreRank: singleScoreRank ? singleScoreRank.rank : null,
      fastestTimeRank: fastestTimeRank ? fastestTimeRank.rank : null,
      twoPlayerRank: twoPlayerRank ? twoPlayerRank.rank : null
    }; 
  }
  catch (err){
    console.error('Error fetching user rankings:', err.message);
    throw err;
  }
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
app.get('/play', auth, (req, res) =>
  res.render('pages/game', { layout: false, user: req.session.user  })
);

const pullActiveSession = async (username, isTwoPlayer)=>{
  const query = `SELECT * FROM game_sessions WHERE username = '${username}' AND twoplayer = ${isTwoPlayer} AND completed_at IS NULL`;
  const sessions = await db.oneOrNone(query);
  return sessions;
}

app.get('/singleplayer', auth, async (req, res) => {
  if (req.session.session_id){
    return res.render('pages/game', {
        user: req.session.user,
        session_id: req.session.session_id,
        isTwoPlayer: false
      });
  }
  try {
    const session = await pullActiveSession(req.session.user.username, false);

    if (session) {
      console.log("resuming session, id=", session.session_id)
      return res.render('pages/game', {
        user: req.session.user,
        session_id: session.session_id,
        isTwoPlayer: false
      });
    } else {
      const sessionIDs = await insertSessions(req.session.user.username, null);
      console.log("created session, id=", sessionIDs[0])
      return res.render('pages/game', {
        user: req.session.user,
        session_id: sessionIDs[0],
        isTwoPlayer: false
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
app.get('/twoplayer', auth, async (req, res) => {
  try {
    const session = await pullActiveSession(req.session.user.username, true);
    if (session){
      return res.render('pages/game', {
        user: req.session.user,
        session_id: session.session_id,
        isTwoPlayer: true,
        opponent: session.opponent
      });
    } else {
      return res.render('pages/lobby', { user: req.session.user})
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});
app.get('/multiplayerredirect', auth, (req, res) =>{ // done so that the json in the dom always stores session id, not url param. Ask James
  req.session.session_id = req.query.id;
  res.redirect('/twoplayer');
})
app.get('/leaderboard', auth, (req, res) =>
  res.render('pages/leaderboard', {
    user: req.session.user,
    isLeaderboard: true
  })
);
app.get('/faq', (req, res) =>
  res.render('pages/FAQ', {
    isFAQ: true
  })
);


app.get('/logout', auth, (req, res) =>
  req.session.destroy(() => res.redirect('/login'))
);


// ── POST /register ────────────────────────────────────────────────────────────
//
//  Positive case  → 200  { message: 'Success' }
//  Negative cases → 400  { message: 'Invalid input' }
//     • missing username or password (catches empty-string '')
//     • duplicate username already in DB
app.post('/register', async (req, res) => {
  const { displayName, username, password, securityQuestion, securityAnswer } = req.body;

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
    const finalDisplayName = displayName?.trim() || username;

    await db.none(
      'INSERT INTO users (username, password, display_name) VALUES ($1, $2, $3)',
      [username, hash, finalDisplayName]
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
  res.render('pages/home', { user: req.session.user,
    isHome: true})
);

//Updated the profile route to pull the user's game history and pass it to the template for rendering. The getUserGameHistory function is called with the current user's username, and the resulting game history is included in the data passed to the Profile template. 
//If there's an error fetching the game history, it logs the error and renders the profile page with an empty game history array to prevent the page from breaking.
app.get('/profile', auth, async (req, res) => {
  try {
    const username = req.session.user.username;
    const gameHistory = await getUserGameHistory(username);
    const stats = await getUserStats(username);
    const ranks = await getUserRankings(username);

    res.render('pages/Profile', {
      user: req.session.user,
      isProfile: true,
      gameHistory,
      stats,
      ranks
    });
  } catch (err) {
    console.error('Profile route error:', err.message);

    res.render('pages/Profile', {
      user: req.session.user,
      isProfile: true,
      gameHistory: [],
      stats: {
        totalGames: 0,
        bestSingleScore: 0,
        wins: 0,
        winRate: "0.0", 
        totalScore: 0
      }, 
      ranks: {
        singleScoreRank: 'N/A',
        fastestTimeRank: 'N/A',
        twoPlayerRank: 'N/A'
      }
    });
  }
});


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
  const { session_id, time_seconds, puzzle_data, score } = req.body;
  const username = req.session.user?.username ?? null; // null = guest

  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({ message: 'Invalid score' });
  }
  if (typeof session_id !== 'number' || session_id < 1) {
    return res.status(400).json({ message: 'Invalid session_id' });
  }

  try {
    const row = await db.one(
      `UPDATE game_sessions
       SET time_seconds = $1,
           puzzle_data = $2,
           score = $3,
           completed_at = NOW()
       WHERE session_id = $4
         AND username = $5
       RETURNING session_id, username, time_seconds, completed_at, puzzle_data, score`,
      [time_seconds, puzzle_data, score, session_id, username]
    );

    await finalizeMatchRatings(session_id);

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
              score,
              time_seconds,
              completed_at
       FROM game_sessions
       ORDER BY score DESC
       LIMIT 20`
    );

    return res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/leaderboard/twoplayer', async (req, res) => {
  try {
    const players = await db.any(
      `SELECT username, rating
       FROM users
       WHERE username IS NOT NULL
       ORDER BY rating DESC
       LIMIT 20`
    );

    const rows = [];

    for (const player of players) {
      const games = await db.any(
        `SELECT session_id, score, time_seconds, match_id
         FROM game_sessions
         WHERE username = $1
           AND twoplayer = TRUE
           AND completed_at IS NOT NULL`,
        [player.username]
      );

      let wins = 0;

      for (const game of games) {
        const opponentGame = await db.oneOrNone(
          `SELECT score, time_seconds
           FROM game_sessions
           WHERE match_id = $1
             AND session_id <> $2
           LIMIT 1`,
          [game.match_id, game.session_id]
        );

        if (!opponentGame) continue;

        if (Number(game.score) > Number(opponentGame.score)) {
          wins++;
        } else if (
          Number(game.score) === Number(opponentGame.score) &&
          Number(game.time_seconds) < Number(opponentGame.time_seconds)
        ) {
          wins++;
        }
      }

      rows.push({
        username: player.username,
        rating: player.rating,
        games_played: games.length,
        wins
      });
    }

    return res.json(rows);
  } catch (err) {
    console.error('Two-player leaderboard error:', err.message);
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
//── Update Username  ─────────────────────────────────────────────────────────────
app.post('/update-username', auth, async (req, res) => {
  const oldUsername = req.session.user.username;
  const newUsername = req.body.newUsername?.trim();

  if (!newUsername) {
    return res.redirect('/Settings');
  }

  if (newUsername === oldUsername) {
    return res.redirect('/Settings');
  }

  try {
    const existing = await db.oneOrNone(
      'SELECT username FROM users WHERE username = $1',
      [newUsername]
    );

    if (existing) {
      return res.redirect('/Settings');
    }

    await db.none(
      'UPDATE users SET username = $1 WHERE username = $2',
      [newUsername, oldUsername]
    );

    req.session.user.username = newUsername;

    return res.redirect('/Settings');
  } catch (err) {
    console.error('Update username error:', err.message);
    return res.redirect('/Settings');
  }
});

// ── Update Display Name ─────────────────────────────────────────────────────────────
app.post('/update-display-name', auth, async (req, res) => {
  const username = req.session.user.username;
  const newDisplayName = req.body.newDisplayName?.trim();

  if (!newDisplayName) {
    return res.redirect('/Settings');
  }

  try {
    await db.none(
      'UPDATE users SET display_name = $1 WHERE username = $2',
      [newDisplayName, username]
    );

    req.session.user.display_name = newDisplayName;

    return res.redirect('/Settings');
  } catch (err) {
    console.error('Update display name error:', err.message);
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
  { clue: "Heavy is the head that wears the:", answer: "CROWN" },
  { clue: "Opposite of yes", answer: "NO" },
  { clue: "Prefix meaning again", answer: "RE" },
  { clue: "Not off", answer: "ON" },
  { clue: "Another word for consumed", answer: "ATE" },
  { clue: "Frozen water", answer: "ICE" },
  { clue: "Direction of sunrise", answer: "EAST" },
  { clue: "A large body of water", answer: "SEA" },
  { clue: "Opposite of out", answer: "IN" },
  { clue: "Actor's role", answer: "PART" },
  { clue: "Casual greeting", answer: "HEY" },
  { clue: "Feline pet", answer: "CAT" },
  { clue: "Canine pet", answer: "DOG" },
  { clue: "Bird's home", answer: "NEST" },
  { clue: "Ocean movement", answer: "TIDE" },
  { clue: "Not old", answer: "NEW" },
  { clue: "Opposite of high", answer: "LOW" },
  { clue: "Musical pause", answer: "REST" },
  { clue: "Writing tool", answer: "PEN" },
  { clue: "Not fast", answer: "SLOW" },
  { clue: "Shiny metal", answer: "TIN" },
  { clue: "Baby's bed", answer: "CRIB" },
  { clue: "Sound of hesitation", answer: "UM" },
  { clue: "Opposite of wet", answer: "DRY" },
  { clue: "38th US president", answer: "FORD" },
  { clue: "Opposite of in", answer: "OUT" },
  { clue: "Another word for attempt", answer: "TRY" },
  { clue: "Above the rest", answer: "BEST" },
  { clue: "Friend", answer: "PAL" },
  { clue: "Enemy", answer: "FOE" },
  { clue: "Adult males", answer: "MEN" },
  { clue: "Opposite of begin", answer: "END" },
  { clue: "As soon as possible", answer: "ASAP" },
  { clue: "Amusing, entertaining, or enjoyable", answer: "FUN" },
  { clue: "Where do the chickens go to roost?", answer: "HOME" },
  { clue: "To conceal", answer: "HIDE" },
  { clue: "Obsessive fan", answer: "STAN" },
  { clue: "Oh my God", answer: "OMG" },
  { clue: "Opposite of many", answer: "FEW" },
  { clue: "C function with no return value", answer: "VOID" },
  { clue: "Wipe dry powder from a surface", answer: "DUST" },
  { clue: "Opposite of soft", answer: "HARD" },
  { clue: "Texter's approval", answer: "YEP" },
  { clue: "Sound a cow makes", answer: "MOO" },
  { clue: "Sound a cat makes", answer: "MEOW" },
  { clue: "Opposite of light", answer: "DARK" },
  { clue: "Opposite of new", answer: "OLD" },
  { clue: "Opposite of kind", answer: "MEAN" },
  { clue: "Sleep for a short time", answer: "NAP" },
  { clue: "Look at", answer: "SEE" },
  { clue: "To move quickly", answer: "RUN" },
  { clue: "To move on foot", answer: "WALK" },
  { clue: "To create", answer: "MAKE" },
  { clue: "Morning drink", answer: "TEA" },
  { clue: "Fruity bread spread", answer: "JAM" },
  { clue: "Soup container", answer: "BOWL" },
  { clue: "Opposite of win", answer: "LOSE" },
  { clue: "Opposite of love", answer: "HATE" },
  { clue: "Push or ___", answer: "PULL" },
  { clue: "Opposite of buy", answer: "SELL" },
  { clue: "Opposite of laugh", answer: "CRY" },
  { clue: "Water falling from the sky", answer: "RAIN" },
  { clue: "Frozen flakes from the sky", answer: "SNOW" },
  { clue: "Moving air", answer: "WIND" },
  { clue: "Bright light in the sky", answer: "SUN" },
  { clue: "Night sky object", answer: "MOON" },
  { clue: "A vehicle with two wheels", answer: "BIKE" },
  { clue: "A vehicle with four wheels", answer: "CAR" },
  { clue: "A water vehicle", answer: "BOAT" },
  { clue: "Tool for cutting wood", answer: "SAW" },
  { clue: "Body part for seeing", answer: "EYE" },
  { clue: "Body part for hearing", answer: "EAR" },
  { clue: "Body part for smelling", answer: "NOSE" },
  { clue: "Body part for touching", answer: "HAND" },
  { clue: "Body part for walking", answer: "FOOT" },
  { clue: "Opposite of east", answer: "WEST" },
  { clue: "2009 Pixar film", answer: "UP" },
  { clue: "Bottom direction", answer: "DOWN" },
  { clue: "2 steps forward, 1 step ___", answer: "BACK" },
  { clue: "Not right", answer: "LEFT" },
  { clue: "A round-shaped object", answer: "ORB" },
  { clue: "3D square", answer: "CUBE" },
  { clue: "An ice cream ___", answer: "CONE" },
  { clue: "Material derived from trees", answer: "WOOD" },
  { clue: "A dry sandy hill", answer: "DUNE" },
  { clue: "A small body of water", answer: "POND" },
  { clue: "A person who cooks", answer: "CHEF" },
  { clue: "Opposite of stop", answer: "GO" },
  { clue: "Board game cube", answer: "DIE" },
  { clue: "Card game where you call out your last card", answer: "UNO" },
  { clue: "Ref's call for too much physical contact", answer: "FOUL" },
  { clue: "Runner's unit", answer: "LAP" },
  { clue: "Soccer score", answer: "GOAL" },
  { clue: "Senior abbreviation", answer: "SR" },
  { clue: "Sleep sound", answer: "ZZZ" },
  { clue: "Clock sound", answer: "TICK" },
  { clue: "Impact sound", answer: "POW" },
  { clue: "Knock sound", answer: "RAP" },
  { clue: "Start of a sneeze", answer: "AH" },
  { clue: "Doctor's title", answer: "DR" },
  { clue: "Pain sound", answer: "OW" },
  { clue: "Mister, briefly", answer: "MR" },
  { clue: "Junior, briefly", answer: "JR" },
  { clue: "Street suffix", answer: "RD" },
  { clue: "Avenue abbreviation", answer: "AVE" },
  { clue: "Mount, briefly", answer: "MT" },
  { clue: "Saint, briefly", answer: "ST" },
  { clue: "2006 Pixar film", answer: "CARS" },
  { clue: "United Nations abbreviation", answer: "UN" },
  { clue: "When stranded, you send one out", answer: "SOS" },
  { clue: "Greatest of all time", answer: "GOAT" },
  { clue: "Sandwich cookie with a cream filling", answer: "OREO" },
  { clue: "2017 Pixar film", answer: "COCO" },
  { clue: "A colony of ants", answer: "ARMY" },
  { clue: "A group of musicians", answer: "BAND" },
  { clue: "Three performers", answer: "TRIO" },
  { clue: "A route", answer: "PATH" },
  { clue: "The Beatles' fifth studio album", answer: "HELP" },
  { clue: "Best made while the sun shines", answer: "HAY" },
  { clue: "A rolling stone gathers none of this", answer: "MOSS" },
  { clue: "Easy as ___", answer: "ABC" },
  { clue: "The European Organization for Nuclear Research", answer: "CERN" },
  { clue: "Dynamite, abbreviated", answer: "TNT" },
  { clue: "Australian rock band", answer: "ACDC" },
  { clue: "Capital of Italy", answer: "ROME" },
  { clue: "Capital of Norway", answer: "OSLO" },
  { clue: "Castle in the ___", answer: "SKY" },
  { clue: "Led Zeppelin's lead guitarist", answer: "PAGE" },
  { clue: "Let the cat out of the ___", answer: "BAG" },
  { clue: "A founding father and famous clock tower", answer: "BEN" },
  { clue: "Star of Benjamin Button and Fight Club", answer: "PITT" },
  { clue: "Fourth planet from the sun", answer: "MARS" },
  { clue: "Not mean", answer: "NICE" },
  { clue: "A fox's home", answer: "DEN" },
  { clue: "Definite article", answer: "THE" },
  { clue: "Used to find your way from A to B", answer: "MAP" },
  { clue: "To swear", answer: "CUSS" },
  { clue: "To iterate or repeat", answer: "LOOP" },
  { clue: "Appendage fish use to swim", answer: "FIN" },
  { clue: "Biggest MMA organization", answer: "UFC" },
  { clue: "1975 Spielberg thriller", answer: "JAWS" },
  { clue: "2004 biographical film about a soul musician", answer: "RAY" },
  { clue: "You swear it", answer: "OATH" },
  { clue: "Hobby where participants act out characters", answer: "LARP" },
  { clue: "35th US president", answer: "JFK" },
  { clue: "2025 Pixar film", answer: "ELIO" },
  { clue: "2021 Pixar film", answer: "LUCA" },
  { clue: "36th US president", answer: "LBJ" },
  { clue: "English rock band known for the song Song 2", answer: "BLUR" },
  { clue: "American basic cable sports broadcasting network", answer: "ESPN" },
  { clue: "American science fiction comedy involving aliens, the abbreviation", answer: "MIB" },
  { clue: "Superman's alter-ego", answer: "KENT" },
  { clue: "Third Monday of January each year is dedicated to him", answer: "MLK" },
  { clue: "They make honey", answer: "BEES" },
  { clue: "Blue fish voiced by Ellen DeGeneres", answer: "DORY" },
  { clue: "The Eternal City", answer: "ROME" },
  { clue: "Lost clown fish", answer: "NEMO" },
  { clue: "Used after a company's name to indicate it is a legal corporation", answer: "INC" },
  { clue: "You go to it to withdraw cash", answer: "ATM" },
  { clue: "Responsible for the United States' civil space program", answer: "NASA" },
  { clue: "Not in danger", answer: "SAFE" },
  { clue: "A person who repeatedly doesn't tell the truth", answer: "LIAR" },
  { clue: "A short or informal test", answer: "QUIZ" },
  { clue: "Co-founder of Apple", answer: "JOBS" },
  { clue: "Worry or concern regarding being left out", answer: "FOMO" },
  { clue: "Not present at one's computer", answer: "AFK" },
  { clue: "A group of people deciding a court case", answer: "JURY" },
  { clue: "Stealing a motor vehicle", answer: "GTA" },
  { clue: "US foreign intelligence agency", answer: "CIA" },
  { clue: "US domestic law enforcement and intelligence agency", answer: "FBI" },
  { clue: "Rhythm and blues", answer: "RNB" },
  { clue: "Band that made Losing My Religion", answer: "REM" },
  { clue: "Negation of a word or group of words", answer: "NOT" },
  { clue: "Determine by choice", answer: "WILL" },
  { clue: "Able to act at will; not hampered", answer: "FREE" },
  { clue: "Used of a single unit or thing; not two or more", answer: "ONE" },
  { clue: "Get done", answer: "DO" },
  { clue: "An instance or single occasion for some event", answer: "TIME" },
  { clue: "Physical position in relation to the surroundings", answer: "SITE" },
  { clue: "A dull persistent pain", answer: "ACHE" },
  { clue: "The month following April and preceding June", answer: "MAY" },
  { clue: "Information about recent and important events", answer: "NEWS" },
  { clue: "A rounded thickly curled hair style", answer: "AFRO" },
  { clue: "In or at this place; where the speaker or writer is", answer: "HERE" },
  { clue: "Look at carefully; study mentally", answer: "VIEW" },
  { clue: "Relatively much but unspecified in amount or extent", answer: "SOME" },
  { clue: "Equal in amount or value", answer: "LIKE" },
  { clue: "Come upon, as if by accident; meet with", answer: "FIND" },
  { clue: "Only a moment ago", answer: "JUST" },
  { clue: "A period of time containing 365 days", answer: "YEAR" },
  { clue: "Time for Earth to make a complete rotation on its axis", answer: "DAY" },
  { clue: "Being one more than one, less than three", answer: "TWO" },
  { clue: "At the time or occasion immediately following", answer: "NEXT" },
  { clue: "Another way to say pre-owned", answer: "USED" },
  { clue: "Mediocre band that made Bang", answer: "AJR" },
  { clue: "Every day I go to ---- from 9-5", answer: "WORK" },
  { clue: "The item at the end", answer: "LAST" },
  { clue: "A collection of facts from which conclusions may be drawn", answer: "DATA" },
  { clue: "Similar in quality or character", answer: "AKIN" },
  { clue: "Oppisite of telling the truth", answer: "LIED" },
  { clue: "Basic arithmitic function to combine two integers", answer: "ADD" },
  { clue: "Dark, flammable substance, known for being hard to get out of", answer: "TAR" },
  { clue: "In a most excellent way or manner", answer: "BEST" },
  { clue: "Subsequently or soon afterward", answer: "THEN" },
  { clue: "To move smoothly along", answer: "FLOW" },
  { clue: "An offense against religious or moral law", answer: "SIN" },
  { clue: "To or from every one of two or more", answer: "EACH" },
  { clue: "Greatest soccer player of all time", answer: "MESSI" },  
  { clue: "Reserve a table or show", answer: "BOOK" },                   
  { clue: "To look at written text", answer: "READ" },             
  { clue: "Something required", answer: "NEED" },      
  { clue: "A group of elements", answer: "SET" },      
  { clue: "Send via post", answer: "MAIL" },           
  { clue: "Very dry, like a desert", answer: "ARID" }, 
  { clue: "Completely full", answer: "FULL" },                                      
  { clue: "Genuine or authentic", answer: "REAL" },    
  { clue: "Something required or essential", answer: "MUST" },                        
  { clue: "Manufactured or created", answer: "MADE" }, 
  { clue: "Not switched on", answer: "OFF" },          
  { clue: "Dispatch to a destination", answer: "SEND" },                
  { clue: "Very enthusiastic", answer: "AVID" },       
  { clue: "Slightly wet", answer: "DAMP" },                          
  { clue: "Enter text with a keyboard", answer: "TYPE" },                     
  { clue: "To desire or wish for", answer: "WANT" },                 
  { clue: "A cut of meat near the hip", answer: "LOIN" },               
  { clue: "Extended in duration", answer: "LONG" },    
  { clue: "Put on display", answer: "SHOW" },          
  { clue: "Flat or level", answer: "EVEN" },           
  { clue: "A gentle tap", answer: "PAT" },                           
  { clue: "A great deal", answer: "MUCH" },            
  { clue: "Write your name on a", answer: "SIGN" },      
  { clue: "Submit a document officially", answer: "FILE" },             
  { clue: "A chopping tool", answer: "AXE" },          
  { clue: "A connection between two things", answer: "LINK" },          
  { clue: "Not shut or closed", answer: "OPEN" },      
  { clue: "2011 animated film set in Brazil", answer: "RIO" },          
  { clue: "Scout out a location", answer: "CASE" },    
  { clue: "A wheel's central rod", answer: "AXLE" },   
  { clue: "The pair of them", answer: "BOTH" },        
  { clue: "A contest with rules", answer: "GAME" },    
  { clue: "To look after or worry about", answer: "CARE" },             
  { clue: "Sound a sheep makes", answer: "BAA" },      
  { clue: "Rules imposed by authority", answer: "LAW" },                
  { clue: "Go to the mall", answer: "SHOP" },          
  { clue: "Written words", answer: "TEXT" },           
  { clue: "Release on payment", answer: "BAIL" },      
  { clue: "Give a score or ranking", answer: "RATE" }, 
  { clue: "To deeply adore", answer: "LOVE" },         
  { clue: "Fourth gospel apostle", answer: "JOHN" },   
  { clue: "Something used to lure", answer: "BAIT" },  
  { clue: "The open ocean", answer: "MAIN" },          
  { clue: "Phone connection", answer: "CALL" },        
  { clue: "Texter's laugh", answer: "LOL" },                         
  { clue: "A goalkeeper's stop", answer: "SAVE" },     
  { clue: "A source of misery", answer: "BANE" },      
  { clue: "Compass direction between E and NE", answer: "ENE" },        
  { clue: "To be in charge of", answer: "MAN" },       
  { clue: "A playing card", answer: "CARD" },          
  { clue: "Sound a bee makes", answer: "BUZZ" },       
  { clue: "Brain food", answer: "FOOD" },              
  { clue: "A sharp point on wire", answer: "BARB" },   
  { clue: "A discounted event", answer: "SALE" },      
  { clue: "Work for pay", answer: "JOB" },             
  { clue: "A space inside a building", answer: "ROOM" },                
  { clue: "What a dog does to warn you", answer: "BARK" },              
  { clue: "Become a member", answer: "JOIN" },         
  { clue: "Direct your gaze", answer: "LOOK" },        
  { clue: "Joyful or merry", answer: "GAY" },          
  { clue: "A rowdy party", answer: "BASH" },           
  { clue: "Completely empty", answer: "VOID" }, 
  { clue: "Seven days", answer: "WEEK" },              
  { clue: "Point out or mention", answer: "NOTE" },    
  { clue: "A live wire", answer: "LIVE" },             
  { clue: "Soak up the sun", answer: "BASK" },         
  { clue: "To broadcast on radio or TV", answer: "AIR" },               
  { clue: "Intend to do something", answer: "PLAN" },  
  { clue: "Cry loudly", answer: "BAWL" },              
  { clue: "The price of something", answer: "COST" },  
  { clue: "A bird's bill", answer: "BEAK" },           
  { clue: "An exam or trial", answer: "TEST" },        
  { clue: "A dark red root vegetable", answer: "BEET" },                
  { clue: "Travel toward something", answer: "COME" }, 
  { clue: "Take part in sport or games", answer: "PLAY" },              
  { clue: "Allow or permit", answer: "LET" },          
  { clue: "To plead or implore", answer: "BEG" },      
  { clue: "Leave a car somewhere", answer: "PARK" },   
  { clue: "Perform or behave", answer: "ACT" },        
  { clue: "Hand something over", answer: "GIVE" },     
  { clue: "A bib covers this", answer: "BIB" },      
  { clue: "To get older", answer: "AGE" },             
  { clue: "A social members group", answer: "CLUB" },  
  { clue: "A path for vehicles", answer: "ROAD" },     
  { clue: "A brief disruption", answer: "BLIP" },      
  { clue: "A present or donation", answer: "GIFT" },   
  { clue: "Hand over money", answer: "PAY" },          
  { clue: "One more than three", answer: "FOUR" },     
  { clue: "A shapeless mass", answer: "BLOB" },        
  { clue: "Not difficult", answer: "EASY" },           
  { clue: "Send documents by phone line", answer: "FAX" },              
  { clue: "A political alliance of countries", answer: "BLOC" },        
  { clue: "Identification card", answer: "ID" },       
  { clue: "A medieval castle's main tower", answer: "KEEP" },           
  { clue: "The youngest in the group", answer: "BABY" },                
  { clue: "An uncastrated male pig", answer: "BOAR" }, 
  { clue: "Move toward a destination", answer: "HEAD" },                
  { clue: "The smallest unit of life", answer: "CELL" },                
  { clue: "One's own identity", answer: "SELF" },      
  { clue: "To signal or foretell", answer: "BODE" },   
  { clue: "You ring it at the door", answer: "BELL" }, 
  { clue: "In the opposite direction", answer: "AWAY" },                
  { clue: "A single time", answer: "ONCE" },           
  { clue: "Certain or confident", answer: "SURE" },    
  { clue: "A deep ringing sound", answer: "BONG" },    
  { clue: "Inform someone of something", answer: "TELL" },              
  { clue: "Capable and skilled", answer: "ABLE" },     
  { clue: "Activities that are enjoyable", answer: "FUN" },   
  { clue: "A disapproving crowd noise", answer: "BOO" },                
  { clue: "A plot of land", answer: "LOT" },           
  { clue: "Request information", answer: "ASK" },      
  { clue: "Time that has gone by", answer: "PAST" },   
  { clue: "An early style of jazz", answer: "BOP" },   
  { clue: "Exactly or precisely", answer: "DUE" },     
  { clue: "To blemish or spoil", answer: "MAR" },      
  { clue: "Make someone uninterested", answer: "BORE" },                
  { clue: "The leader or head", answer: "DON" },       
  { clue: "Arrive at or touch down", answer: "LAND" }, 
  { clue: "Completed or finished", answer: "DONE" },   
  { clue: "An argument in favor", answer: "PRO" },     
  { clue: "A short period of illness", answer: "BOUT" },                
  { clue: "At any point in time", answer: "EVER" },    
  { clue: "A unit of language", answer: "WORD" },      
  { clue: "A proposed law", answer: "BILL" },          
  { clue: "To boast or show off", answer: "BRAG" },    
  { clue: "A group of cattle", answer: "HERD" },       
  { clue: "A grade or rating symbol", answer: "MARK" },
  { clue: "Move back and forth", answer: "ROCK" },     
  { clue: "Not good", answer: "BAD" },                 
  { clue: "Sound a donkey makes", answer: "BRAY" },    
  { clue: "A positive addition", answer: "PLUS" },     
  { clue: "Revise for publication", answer: "EDIT" },  
  { clue: "Moving quickly", answer: "FAST" },          
  { clue: "Outer husks of cereal grain", answer: "BRAN" },              
  { clue: "A known truth or piece of data", answer: "FACT" },           
  { clue: "A subdivision of an organization", answer: "UNIT" },         
  { clue: "Come together at a place", answer: "MEET" },
  { clue: "Make beer", answer: "BREW" },               
  { clue: "Half an em in typography", answer: "EN" },  
  { clue: "Experience an emotion", answer: "FEEL" },   
  { clue: "A soft French cheese", answer: "BRIE" },    
  { clue: "Tilt to the side", answer: "BANK" },        
  { clue: "A chance of loss or danger", answer: "RISK" },               
  { clue: "A small city or village", answer: "TOWN" }, 
  { clue: "Full to the very top", answer: "BRIM" },    
  { clue: "A young female", answer: "GIRL" },          
  { clue: "Money borrowed", answer: "LOAN" },          
  { clue: "Energy and enthusiasm", answer: "PEP" },    
  { clue: "Broad or spacious", answer: "WIDE" },       
  { clue: "A young plant shoot", answer: "BUD" },      
  { clue: "A type or category", answer: "SORT" },      
  { clue: "A single move in a process", answer: "STEP" },               
  { clue: "Women's rights pioneer Alice ___", answer: "PAUL" },         
  { clue: "Polish to a shine", answer: "BUFF" },       
  { clue: "A large body of fresh water", answer: "LAKE" },              
  { clue: "Flames burning out of control", answer: "FIRE" },            
  { clue: "Sharpen a skill", answer: "HONE" },         
  { clue: "A casual conversation", answer: "CHAT" },   
  { clue: "A light-bulb's glass part", answer: "BULB" },                
  { clue: "A defeat or forfeit", answer: "LOSS" },     
  { clue: "Your face", answer: "FACE" },               
  { clue: "Bed and breakfast, briefly", answer: "BNB" },                
  { clue: "A tiny piece or fragment", answer: "BIT" }, 
  { clue: "Collide with force", answer: "BUMP" },      
  { clue: "A military starting point", answer: "BASE" },                
  { clue: "A change of direction", answer: "TURN" },   
  { clue: "An exact duplicate", answer: "COPY" },      
  { clue: "A small round bread roll", answer: "BUN" }, 
  { clue: "A reddish-brown color", answer: "BAY" },    
  { clue: "The left side of a ship", answer: "PORT" }, 
  { clue: "A place to get a drink", answer: "BAR" },   
  { clue: "A floating marker in water", answer: "BUOY" },               
  { clue: "In the near future", answer: "SOON" },                    
  { clue: "Kept or retained", answer: "HELD" },        
  { clue: "Spread and dry grass", answer: "TED" },     
  { clue: "To object or take issue", answer: "MIND" }, 
  { clue: "Put underground", answer: "BURY" },         
  { clue: "A restaurant's list of dishes", answer: "MENU" },            
  { clue: "To wish for a positive outcome", answer: "HOPE" },           
  { clue: "A person's function or character", answer: "ROLE" },         
  { clue: "Release gas from the stomach", answer: "BURP" },             
  { clue: "A financial penalty", answer: "FINE" },     
  { clue: "Sixty minutes", answer: "HOUR" },           
  { clue: "Dense wild vegetation", answer: "BUSH" },   
  { clue: "A baby cow", answer: "CALF" },              
  { clue: "An offer or attempt", answer: "BID" },      
  { clue: "Generous and caring", answer: "KIND" },     
  { clue: "A decision or action taken", answer: "MOVE" },               
  { clue: "A guaranteed outcome", answer: "CERT" },    
  { clue: "A brand's symbol or emblem", answer: "LOGO" },               
  { clue: "Title for a woman, briefly", answer: "MS" },
  { clue: "Skin becomes dry and cracked", answer: "CHAP" },             
  { clue: "Guide someone somewhere", answer: "LEAD" }, 
  { clue: "A setting or method of operation", answer: "MODE" },         
  { clue: "Got married", answer: "WED" },              
  { clue: "Fashionably stylish", answer: "CHIC" },     
  { clue: "Relating to men", answer: "MALE" },         
  { clue: "A musical composition with lyrics", answer: "SONG" },        
  { clue: "Not on time; delayed", answer: "LATE" },    
  { clue: "Cut into pieces", answer: "CHOP" },                       
  { clue: "A thought or concept", answer: "IDEA" },    
  { clue: "Come out victorious", answer: "WIN" },      
  { clue: "A business transaction", answer: "DEAL" },  
  { clue: "A meal or food, informally", answer: "CHOW" },               
  { clue: "Give food to", answer: "FEED" },            
  { clue: "Trimmed or sliced", answer: "CUT" },        
  { clue: "A large room for gatherings", answer: "HALL" },              
  { clue: "The sound of a steam engine", answer: "CHUG" },              
  { clue: "Opposed to or against", answer: "ANTI" },   
  { clue: "A large ocean-going vessel", answer: "SHIP" },               
  { clue: "Compensated for work", answer: "PAID" },    
  { clue: "Strike the hands together", answer: "CLAP" },                
  { clue: "Grows on your head", answer: "HAIR" },      
  { clue: "A set of tools or equipment", answer: "KIT" },               
  { clue: "It has roots, branches and leaves", answer: "TREE" },        
  { clue: "Block up a pipe or drain", answer: "CLOG" },
  { clue: "In this way or manner", answer: "THUS" },   
  { clue: "A young male, informally", answer: "BOY" }, 
  { clue: "A male child", answer: "SON" },             
  { clue: "Informal word for nose", answer: "CONK" },  
  { clue: "A governing principle", answer: "RULE" },   
  { clue: "Store away in a container", answer: "BIN" },
  { clue: "An entry point to a room", answer: "DOOR" },
  { clue: "A soft loving sound", answer: "COO" },      
  { clue: "Pleasantly cold", answer: "COOL" },         
  { clue: "The world's largest continent", answer: "ASIA" },            
  { clue: "Birthplace of Albert Einstein", answer: "ULM" },             
  { clue: "A popular programming language named after an island", answer: "JAVA" },
  { clue: "A water bird related to the rail", answer: "COOT" },         
  { clue: "A document permitting entry", answer: "PASS" },              
  { clue: "A large covered vehicle", answer: "VAN" },  
  { clue: "A clear alcoholic spirit", answer: "GIN" }, 
  { clue: "A brilliant or daring success", answer: "COUP" },            
  { clue: "Strike with force", answer: "HIT" },        
  { clue: "Merge resources together", answer: "POOL" },
  { clue: "A very short skirt or dress", answer: "MINI" },              
  { clue: "A monk's hooded robe", answer: "COWL" },    
  { clue: "Search for information indirectly", answer: "FISH" },        
  { clue: "Came into existence", answer: "BORN" },     
  { clue: "A competition between opponents", answer: "RACE" },          
  { clue: "A jagged rocky cliff", answer: "CRAG" },    
  { clue: "Money owed", answer: "DEBT" },              
  { clue: "A charge for a service", answer: "FEE" },   
  { clue: "Money paid to use a property", answer: "RENT" },             
  { clue: "The central or most important point", answer: "CRUX" },      
  { clue: "Help or assistance", answer: "AID" },       
  { clue: "A poem addressed to a subject", answer: "ODE" },             
  { clue: "Reasonable and just", answer: "FAIR" },     
  { clue: "A young lion", answer: "CUB" },             
  { clue: "A magician's stick", answer: "WAND" },      
  { clue: "Overweight or plump", answer: "FAT" },      
  { clue: "No longer alive", answer: "DEAD" },         
  { clue: "A short journey", answer: "TRIP" },         
  { clue: "A blow from the back of a hand", answer: "CUFF" },           
  { clue: "Having very little money", answer: "POOR" },
  { clue: "Work the land", answer: "FARM" },           
  { clue: "Selectively reduce a population", answer: "CULL" },          
  { clue: "A male cat", answer: "TOM" },               
  { clue: "A nobleman of high rank", answer: "LORD" }, 
  { clue: "Detect with your ears", answer: "HEAR" },   
  { clue: "A mongrel or inferior dog", answer: "CUR" },
  { clue: "Strike out in baseball", answer: "FAN" },   
  { clue: "A man's spouse", answer: "WIFE" },          
  { clue: "Divide an area into districts", answer: "ZONE" },            
  { clue: "A Russian ruler or emperor", answer: "CZAR" },               
  { clue: "Use a car jack to lift", answer: "JACK" },  
  { clue: "Gently stroke an animal", answer: "PET" },  
  { clue: "Mend with a needle and thread", answer: "DARN" },            
  { clue: "An informal word for a man", answer: "GUY" },                
  { clue: "Move lightly with little jumps", answer: "SKIP" },           
  { clue: "Set up or adjust equipment", answer: "GEAR" },               
  { clue: "A confused or stunned state", answer: "DAZE" },              
  { clue: "Confederate general Robert E. ___", answer: "LEE" },         
  { clue: "A mouth or opening, in anatomy", answer: "OS" },             
  { clue: "Bill Clinton's Arkansas hometown", answer: "HOPE" },         
  { clue: "Steadfast and determined", answer: "FIRM" },
  { clue: "Leap into the air", answer: "JUMP" },       
  { clue: "Purchased and taken away", answer: "SOLD" },
  { clue: "A short haircut all around", answer: "BOB" },                
  { clue: "In good physical shape", answer: "FIT" },   
  { clue: "A feeling of physical hurt", answer: "PAIN" },               
  { clue: "Spoken rather than written", answer: "ORAL" },               
  { clue: "Creep slowly forward", answer: "EDGE" },    
  { clue: "A light rosy color", answer: "PINK" },      
  { clue: "A hint or signal", answer: "CUE" },         
  { clue: "A fired bullet or attempt on goal", answer: "SHOT" },        
  { clue: "Low in temperature", answer: "COLD" },      
  { clue: "A river in northern Italy", answer: "PO" }, 
  { clue: "The second Greek letter", answer: "BETA" }, 
  { clue: "Raise the temperature of", answer: "HEAT" },
  { clue: "Untamed or uncontrolled", answer: "WILD" }, 
  { clue: "Notice someone's absence", answer: "MISS" },
  { clue: "A creeping insect, informally", answer: "BUG" },             
  { clue: "The opposite of borrow", answer: "LEND" },  
  { clue: "In the middle, as a prefix", answer: "MID" },                
  { clue: "Not firm or hard", answer: "SOFT" },        
  { clue: "Supply energy to a vehicle", answer: "FUEL" },               
  { clue: "A pinkish-red flower color", answer: "ROSE" },               
  { clue: "Select carefully or pluck", answer: "PICK" },                
  { clue: "Let something fall", answer: "DROP" },      
  { clue: "Wealthy or affluent", answer: "RICH" },     
  { clue: "Give the impression of being", answer: "SEEM" },             
  { clue: "Place high in a hierarchy", answer: "RANK" },                
  { clue: "Twelve of these make a foot", answer: "INCH" },              
  { clue: "A scientific research room", answer: "LAB" },                
  { clue: "Fill to capacity", answer: "FILL" },        
  { clue: "No longer present", answer: "GONE" },       
  { clue: "The actors in a production", answer: "CAST" },                           
  { clue: "The smallest unit of matter", answer: "ATOM" },              
  { clue: "Combine dry ingredients", answer: "MIX" },  
  { clue: "A flat circular data storage device", answer: "DISK" },      
  { clue: "A tricky situation, informally", answer: "FIX" },            
  { clue: "A moral flaw or bad habit", answer: "VICE" },                
  { clue: "A moral or legal obligation", answer: "DUTY" },              
  { clue: "Acquire points or benefits", answer: "GAIN" },               
  { clue: "The absence of something needed", answer: "LACK" },          
  { clue: "A US state known for corn", answer: "IOWA" },                
  { clue: "An argument against", answer: "CON" },      
  { clue: "Move very fast, like a camera", answer: "ZOOM" },            
  { clue: "Expel air from your mouth", answer: "BLOW" },                
  { clue: "Run electrical cables through", answer: "WIRE" },            
  { clue: "Unwanted bulk email", answer: "SPAM" },     
  { clue: "One hundredth of a dollar", answer: "CENT" },                
  { clue: "Having no legal validity", answer: "NULL" },
  { clue: "The number nothing", answer: "ZERO" },      
  { clue: "A list of names, or bread shape", answer: "ROLL" },          
  { clue: "Wash your body in a tub", answer: "BATH" },              
  { clue: "A typeface style", answer: "FONT" },        
  { clue: "Came first in a competition", answer: "WON" },               
  { clue: "Have clothing on your body", answer: "WEAR" },               
  { clue: "Uncommon and hard to find", answer: "RARE" },                
  { clue: "Move a boat with oars", answer: "ROW" },    
  { clue: "Go upward", answer: "RISE" },               
  { clue: "Injure or mutilate severely", answer: "MAIM" },              
  { clue: "Watch birds in nature", answer: "BIRD" },   
  { clue: "A male sheep", answer: "RAM" },    
  { clue: "A polite word for a woman", answer: "LADY" },                
  { clue: "Consume food", answer: "EAT" },             
  { clue: "Fire someone from their job", answer: "SACK" },              
  { clue: "A small wooded hollow", answer: "DELL" },                    
  { clue: "To direct or intend toward a target", answer: "AIM" },       
  { clue: "Ring a bell slowly", answer: "TOLL" },      
  { clue: "A shade or tint of color", answer: "HUE" }, 
  { clue: "A pointed strip of land in water", answer: "CAPE" },         
  { clue: "South Africa, briefly", answer: "RSA" },    
  { clue: "Cause to tilt or lean", answer: "TIP" },    
  { clue: "Extract from the earth", answer: "MINE" },  
  { clue: "The body's largest organ", answer: "SKIN" },
  { clue: "Glide down a snowy slope", answer: "SKI" }, 
  { clue: "Hard to trick or fool", answer: "FLY" },    
  { clue: "Defeat in a competition", answer: "BEAT" }, 
  { clue: "Play with or fiddle with", answer: "TOY" }, 
  { clue: "The side of your waist", answer: "HIP" },   
  { clue: "Notice or detect", answer: "SPOT" },        
  { clue: "Get bigger or expand", answer: "GROW" },    
  { clue: "A virus transmitted by bodily fluids", answer: "HIV" },      
  { clue: "A deep low musical range", answer: "BASS" },
  { clue: "Travel in a vehicle", answer: "RIDE" },     
  { clue: "A Spanish title for a nobleman", answer: "DON" },       
  { clue: "Wicked or morally wrong", answer: "EVIL" }, 
  { clue: "Cover the top of something", answer: "CAP" },                
  { clue: "Sign with a pen", answer: "INK" },          
  { clue: "The very top or summit", answer: "PEAK" },  
  { clue: "A seasoning that makes things sting", answer: "SALT" },      
  { clue: "A small fastening badge", answer: "PIN" },  
  { clue: "In the nude, informally", answer: "RAW" },  
  { clue: "A narrow road or track", answer: "LANE" },  
  { clue: "Put an end to", answer: "KILL" },           
  { clue: "Prepare a hot meal", answer: "COOK" },                    
  { clue: "Search or look for", answer: "SEEK" },      
  { clue: "A rotating engine part", answer: "CAM" },   
  { clue: "Dirt that plants grow in", answer: "SOIL" },
  { clue: "Soaked with liquid", answer: "WET" },       
  { clue: "Leave or depart from", answer: "EXIT" },    
  { clue: "Equip with weapons", answer: "ARM" },       
  { clue: "A gesture of greeting at sea", answer: "WAVE" },             
  { clue: "Sacred or divine", answer: "HOLY" },        
  { clue: "Fit together like gears", answer: "MESH" }, 
  { clue: "Head of a university faculty", answer: "DEAN" },             
  { clue: "Survey public opinion", answer: "POLL" },   
  { clue: "A widely used computer operating system", answer: "UNIX" },  
  { clue: "James ___, secret agent 007", answer: "BOND" },              
  { clue: "A small jump", answer: "HOP" },             
  { clue: "Untainted or uncontaminated", answer: "PURE" },              
  { clue: "A glass used to focus light", answer: "LENS" },              
  { clue: "Sketch or pull toward you", answer: "DRAW" },                
  { clue: "Long-lasting endurance", answer: "LEGS" },  
  { clue: "A point where connections meet", answer: "NODE" },           
  { clue: "A unit of distance, 1760 yards", answer: "MILE" },           
  { clue: "Tease or joke around", answer: "KID" },     
  { clue: "Sweep a camera across a scene", answer: "PAN" },             
  { clue: "A color between black and white", answer: "GRAY" },          
  { clue: "The devil resides in ---- Indiana", answer: "GARY" },       
  { clue: "Change or fluctuate", answer: "VARY" },     
  { clue: "Apply force to move forward", answer: "PUSH" },              
  { clue: "A total amount of money", answer: "SUM" },  
  { clue: "A large tree that produces acorns", answer: "OAK" },         
  { clue: "A respectful title for a man", answer: "SIR" },              
  { clue: "Deserve or work for pay", answer: "EARN" }, 
  { clue: "An identical pair", answer: "TWIN" },       
  { clue: "Secretly observe or monitor", answer: "SPY" },               
  { clue: "Be appropriate or fitting", answer: "SUIT" },                
  { clue: "A small fragment or sliver", answer: "CHIP" },               
  { clue: "Impress or astonish someone", answer: "WOW" },               
  { clue: "Heavy metal singer Ronnie James ___", answer: "DIO" },                             
  { clue: "Blacken by burning", answer: "CHAR" },      
  { clue: "Author of 'The Raven'", answer: "POE" },    
  { clue: "A repeated sound bouncing back", answer: "ECHO" },           
  { clue: "A pattern of crossing lines", answer: "GRID" },              
  { clue: "A small sweet fruit from a tree", answer: "FIG" },           
  { clue: "Devise a secret scheme", answer: "PLOT" },  
  { clue: "A vinyl record album", answer: "LP" },      
  { clue: "Confident and daring", answer: "BOLD" },    
  { clue: "Examine carefully or sweep", answer: "SCAN" },               
  { clue: "Old or elderly", answer: "AGED" },          
  { clue: "A large mass or quantity", answer: "BULK" },
  { clue: "Attractive in a sweet way", answer: "CUTE" },                
  { clue: "Look closely at something", answer: "PEER" },                
  { clue: "A loud explosive noise", answer: "BANG" },  
  { clue: "A repeated musical sound", answer: "TONE" },
  { clue: "Occupied or fully engaged", answer: "BUSY" },                
  { clue: "A limb of a chair or table", answer: "LEG" },                
  { clue: "Kiss passionately", answer: "NECK" },       
  { clue: "A bird's limb used for flying", answer: "WING" },            
  { clue: "A fence or barrier on a train", answer: "RAIL" },            
  { clue: "A crested blue bird", answer: "JAY" },      
  { clue: "A strap worn around the waist", answer: "BELT" },            
  { clue: "Steal from someone", answer: "ROB" },                     
  { clue: "Good fortune or chance", answer: "LUCK" },  
  { clue: "Act together as a group", answer: "GANG" }, 
  { clue: "A block of soap or chocolate", answer: "CAKE" },             
  { clue: "A small casual coffee shop", answer: "CAFE" },               
  { clue: "Put on footwear", answer: "SHOE" },         
  { clue: "Fine grains found on beaches", answer: "SAND" },             
  { clue: "A feeling of great happiness", answer: "JOY" },              
  { clue: "Carry liquid through a tube", answer: "PIPE" },              
  { clue: "Sick or unwell", answer: "ILL" },           
  { clue: "Not professional or expert", answer: "LAY" },                
  { clue: "Decorate or adorn", answer: "DECK" },       
  { clue: "Slim or slender", answer: "THIN" },         
  { clue: "Administer a measured amount", answer: "DOSE" },             
  { clue: "Wager on an outcome", answer: "BET" },      
  { clue: "A Chinese unit of distance", answer: "LI" },
  { clue: "Ordinary people", answer: "FOLK" },         
  { clue: "A boost or helping hand", answer: "LIFT" }, 
  { clue: "Informal word for father", answer: "DAD" }, 
  { clue: "A flat floor covering", answer: "MAT" },    
  { clue: "Cut and fold a fabric edge", answer: "FELL" },               
  { clue: "The outdoor area around a house", answer: "YARD" },          
  { clue: "Flow out steadily", answer: "POUR" },       
  { clue: "Fasten or restrict", answer: "TIE" },       
  { clue: "Press lips to another", answer: "KISS" },   
  { clue: "Short for modern in style", answer: "MOD" },
  { clue: "Done in a hurry", answer: "RUSH" },         
  { clue: "A light fixture", answer: "LAMP" },         
  { clue: "Happy and relieved", answer: "GLAD" },      
  { clue: "A storage frame or shelf", answer: "RACK" },
  { clue: "A sales representative, briefly", answer: "REP" },           
  { clue: "The person in charge of you at work", answer: "BOSS" },                
  { clue: "A performance by one person", answer: "SOLO" },              
  { clue: "Very high in stature", answer: "TALL" },    
  { clue: "The ripple behind a moving boat", answer: "WAKE" },          
  { clue: "Beat a rhythm", answer: "DRUM" },           
  { clue: "Move gently and carefully", answer: "EASE" },                
  { clue: "An evergreen tree with needles", answer: "PINE" },              
  { clue: "Track and chase prey", answer: "HUNT" },    
  { clue: "Relating to Thailand", answer: "THAI" },    
  { clue: "Set fire to something", answer: "BURN" },   
  { clue: "Recline or tell an untruth", answer: "LIE" },                
  { clue: "Lacking physical strength", answer: "WEAK" },                
  { clue: "Having good judgment and knowledge", answer: "WISE" },       
  { clue: "The probability or chances", answer: "ODDS" },               
  { clue: "The night before a big event", answer: "EVE" },              
  { clue: "Part of a plant that captures sunlight", answer: "LEAF" },   
  { clue: "A block of paper for writing", answer: "PAD" },              
  { clue: "A long thin stick or pole", answer: "ROD" },
  { clue: "A smooth, luxurious fabric", answer: "SILK" },               
  { clue: "Unhappy or sorrowful", answer: "SAD" },     
  { clue: "Devour greedily", answer: "WOLF" },         
  { clue: "Strike with your foot", answer: "KICK" },   
  { clue: "A sitting down to eat", answer: "MEAL" },   
  { clue: "Slide quietly into place", answer: "SLIP" },
  { clue: "Throw eggs at", answer: "EGG" },                          
  { clue: "A tablet of medicine", answer: "PILL" },    
  { clue: "Rotate rapidly", answer: "SPIN" },          
  { clue: "Clean with water", answer: "WASH" },        
  { clue: "A brave and noble man", answer: "HERO" },   
  { clue: "A rebellious subculture style", answer: "PUNK" },            
  { clue: "The 16th Greek letter", answer: "PI" },     
  { clue: "A royal title below king", answer: "DUKE" },
  { clue: "Walk at a steady speed", answer: "PACE" },  
  { clue: "Money earned for work done", answer: "WAGE" },               
  { clue: "A curved line or path", answer: "ARC" },    
  { clue: "The very start of daylight", answer: "DAWN" },               
  { clue: "A married woman's title", answer: "MRS" },  
  { clue: "A child's toy replica of a person", answer: "DOLL" },        
  { clue: "Greek goddess of victory; a sportswear brand", answer: "NIKE" },
  { clue: "Officially prohibit or block", answer: "BAN" },              
  { clue: "A temporary worker", answer: "TEMP" },      
  { clue: "Not divisible by two", answer: "ODD" },                   
  { clue: "Cover or enclose in paper", answer: "WRAP" },                
  { clue: "Smile broadly", answer: "BEAM" },           
  { clue: "Not open or ajar", answer: "SHUT" },        
  { clue: "A disguise worn over the face", answer: "MASK" },            
  { clue: "A black rock burned for fuel", answer: "COAL" },             
  { clue: "A famous or celebrated person", answer: "LION" },            
  { clue: "Meat from a cow", answer: "BEEF" },         
  { clue: "A dishonorable or rude man", answer: "CAD" },                
  { clue: "Waves breaking at the shore", answer: "SURF" },              
  { clue: "A length of rope or cable", answer: "CORD" },                
  { clue: "Trim or cut short", answer: "CROP" },       
  { clue: "Perform a song with your voice", answer: "SING" },           
  { clue: "A very large quantity", answer: "TONS" },   
  { clue: "Suspend from above", answer: "HANG" },      
  { clue: "The 22nd Greek letter", answer: "CHI" },    
  { clue: "Adjust an instrument's pitch", answer: "TUNE" },             
  { clue: "A long mountain hike", answer: "TREK" },    
  { clue: "Catch or hunt for rodents", answer: "RAT" },
  { clue: "An early PC operating system", answer: "DOS" },              
  { clue: "Remove the stalk from fruit", answer: "TAIL" },              
  { clue: "A neatly cut stretch of grass", answer: "LAWN" },            
  { clue: "A popular Atlantic fish", answer: "COD" },  
  { clue: "Neat and tidy", answer: "TRIM" },           
  { clue: "General knowledge or information", answer: "GEN" },          
  { clue: "A burial vault or chamber", answer: "TOMB" },                
  { clue: "Invent a word or phrase", answer: "COIN" }, 
  { clue: "A counterfeit or fraud", answer: "FAKE" },  
  { clue: "Preserve or treat with salt or smoke", answer: "CURE" },     
  { clue: "A chief villain or master trickster", answer: "ARCH" },      
  { clue: "An explosive device", answer: "BOMB" },     
  { clue: "A large antlered woodland animal", answer: "DEER" },         
  { clue: "Worn on the head", answer: "HAT" },         
  { clue: "An appliance for baking food", answer: "OVEN" },             
  { clue: "Twelve o'clock in the day", answer: "NOON" },                
  { clue: "A minor prophet of the Hebrew Bible", answer: "JOEL" },      
  { clue: "A light brownish color", answer: "TAN" },   
  { clue: "A partner or fellow sailor", answer: "MATE" },               
  { clue: "A baked pastry dish with filling", answer: "PIE" },          
  { clue: "Bend at the waist in respect", answer: "BOW" },              
  { clue: "Founder of Pennsylvania colony", answer: "PENN" },            
  { clue: "Attached with string or rope", answer: "TIED" },                 
  { clue: "Double over or crease", answer: "FOLD" },   
  { clue: "A long upright stick or post", answer: "POLE" },             
  { clue: "---- it like Beckham", answer: "BEND" },                        
  { clue: "Another word for taxi", answer: "CAB" }, 
  { clue: "Grow bored or weary of", answer: "TIRE" },  
  { clue: "Pull something heavy along", answer: "DRAG" },               
  { clue: "Ready to eat or use", answer: "RIPE" },     
  { clue: "Hit the ---- on the head", answer: "NAIL" },               
  { clue: "The full length of something", answer: "SPAN" },             
  { clue: "A large bathing or soaking vessel", answer: "TUB" },         
  { clue: "The powdery remains after burning", answer: "ASH" },         
  { clue: "Produce bubbles or froth", answer: "FOAM" },
  { clue: "A piece of poetry", answer: "POEM" },       
  { clue: "Hit on the head", answer: "BEAN" },         
  { clue: "A slant or prejudice", answer: "BIAS" },    
  { clue: "A tool for cutting screw threads", answer: "TAP" },          
  { clue: "Move through water", answer: "SWIM" },      
  { clue: "A fuzzy flying insect that makes honey", answer: "BEE" },    
  { clue: "Very noisy or deafening", answer: "LOUD" }, 
  { clue: "Baseball legend Babe ___", answer: "RUTH" },
  { clue: "The leader of the Catholic Church", answer: "POPE" },        
  { clue: "A rugged military vehicle", answer: "JEEP" },                
  { clue: "Completely unclothed", answer: "BARE" },                  
  { clue: "Set against each other", answer: "PIT" },   
  { clue: "Single-channel audio", answer: "MONO" },    
  { clue: "Lay flat pieces of ceramic", answer: "TILE" },               
  { clue: "Empty or hypocritical talk", answer: "CANT" },               
  { clue: "Move quickly to avoid something", answer: "DUCK" },          
  { clue: "The 21st Greek letter", answer: "PHI" },    
  { clue: "Jump head-first into water", answer: "DIVE" },               
  { clue: "A sudden hostile takeover attempt", answer: "RAID" },        
  { clue: "A tech-savvy enthusiast, informally", answer: "GEEK" },      
  { clue: "Go below the water's surface", answer: "SINK" },             
  { clue: "A firm hold or grasp", answer: "GRIP" },    
  { clue: "A jumping green amphibian", answer: "FROG" },                
  { clue: "A sudden cold spell", answer: "SNAP" },     
  { clue: "A female deer", answer: "DOE" },            
  { clue: "Transfer data into memory", answer: "LOAD" },                
  { clue: "A cocktail made with beaten egg", answer: "FLIP" },          
  { clue: "Attack with nuclear weapons", answer: "NUKE" },              
  { clue: "Free from or clear out", answer: "RID" },   
  { clue: "A deep, rumbling sound", answer: "BOOM" },  
  { clue: "Relaxed and untroubled", answer: "CALM" },  
  { clue: "A pronged eating utensil", answer: "FORK" },
  { clue: "Tear through forcefully", answer: "RIP" },  
  { clue: "A flat container for carrying dishes", answer: "TRAY" },     
  { clue: "A wise and experienced advisor", answer: "SAGE" },           
  { clue: "The edge of your mouth", answer: "LIP" },   
  { clue: "Dig underneath to weaken", answer: "SAP" }, 
  { clue: "A fabric made from sheep's fleece", answer: "WOOL" },        
  { clue: "The 13th Greek letter", answer: "NU" },     
  { clue: "Seize or clutch something", answer: "GRAB" },                
  { clue: "The 14th Greek letter", answer: "XI" },     
  { clue: "Catch in a snare", answer: "TRAP" },        
  { clue: "A delicate openwork fabric", answer: "LACE" },               
  { clue: "Unpleasant to look at", answer: "UGLY" },   
  { clue: "A clenched hand", answer: "FIST" },         
  { clue: "Nothing more than; only", answer: "MERE" }, 
  { clue: "Excavate or turn over soil", answer: "DIG" },                
  { clue: "Move slowly along a runway", answer: "TAXI" },               
  { clue: "Damaged from heavy use", answer: "WORN" },  
  { clue: "State that something is false", answer: "DENY" },            
  { clue: "A Japanese school of meditation", answer: "ZEN" },                         
  { clue: "A sacred Vedic drink", answer: "SOMA" },    
  { clue: "One who ties with another in a race", answer: "TIER" },      
  { clue: "A thick twisted cord", answer: "ROPE" },    
  { clue: "Abruptly end a relationship", answer: "DUMP" },              
  { clue: "A flexible tube for water", answer: "HOSE" },                
  { clue: "Low visibility caused by water droplets", answer: "FOG" },   
  { clue: "Neither extreme; moderate", answer: "MILD" },                
  { clue: "Animal hair used as material", answer: "FUR" },              
  { clue: "A flat-topped hill", answer: "MESA" },      
  { clue: "Remove the outer casing", answer: "HULL" }, 
  { clue: "Discard or remove", answer: "SHED" },       
  { clue: "A brief written reminder", answer: "MEMO" },
  { clue: "Cured pork from a pig's leg", answer: "HAM" },               
  { clue: "A low mood or slump", answer: "FUNK" },     
  { clue: "Tie or restrict", answer: "BIND" },         
  { clue: "South Africa's currency", answer: "RAND" }, 
  { clue: "A mature male animal", answer: "BUCK" },    
  { clue: "A unit of land area", answer: "ACRE" },     
  { clue: "A nuisance or annoying creature", answer: "PEST" },          
  { clue: "Fold in part of a sail", answer: "REEF" },  
  { clue: "A long cushioned seat", answer: "SOFA" },   
  { clue: "A glass storage container", answer: "JAR" },
  { clue: "A ghostwriter or dull worker", answer: "HACK" },             
  { clue: "Challenge someone to do something risky", answer: "DARE" },  
  { clue: "A bird of prey; also to sell aggressively", answer: "HAWK" },
  { clue: "A type of romaine lettuce", answer: "COS" },
  { clue: "Old or disused material; a Chinese boat", answer: "JUNK" },  
  { clue: "Famous 1974 hominid fossil skeleton", answer: "LUCY" },      
  { clue: "Impressive and grand in scale", answer: "EPIC" },            
  { clue: "Collect or gather nuts", answer: "NUT" },   
  { clue: "For the ___ of argument", answer: "SAKE" }, 
  { clue: "Tilt or rest against something", answer: "LEAN" },                    
  { clue: "Stab or pierce to cause bleeding", answer: "GORE" },         
  { clue: "A devoted religious following", answer: "CULT" },            
  { clue: "Flair or style", answer: "DASH" },          
  { clue: "A small sharp hit or signal", answer: "PING" },              
  { clue: "The rate of change or flow", answer: "FLUX" },               
  { clue: "Show intense anger", answer: "RAGE" },      
  { clue: "A county in southwest England", answer: "AVON" },            
  { clue: "Reverse a previous action", answer: "UNDO" },                
  { clue: "A glowing ring above an angel", answer: "HALO" },            
  { clue: "Naturally suited or likely to", answer: "APT" },             
  { clue: "A precious stone of great beauty", answer: "GEM" },          
  { clue: "The second largest Hawaiian island", answer: "MAUI" },       
  { clue: "The 23rd Greek letter", answer: "PSI" },    
  { clue: "A step or move in ballet", answer: "PAS" }, 
  { clue: "A terrible or inescapable fate", answer: "DOOM" },           
  { clue: "A small snack or light meal", answer: "BITE" },              
  { clue: "A long rowing boat for racing", answer: "GIG" },             
  { clue: "Remove unwanted plants", answer: "WEED" },  
  { clue: "A square courtyard surrounded by buildings", answer: "QUAD" },
  { clue: "Meat from a pig", answer: "PORK" },         
  { clue: "How well your food tastes on a trip", answer: "FARE" },      
  { clue: "Completely obvious or blunt", answer: "BALD" },              
  { clue: "A Japanese mountain and cherry tree variety", answer: "FUJI" },  
  { clue: "Grow fungus from dampness", answer: "MOLD" },                           
  { clue: "A fragrant plant used in cooking", answer: "HERB" },         
  { clue: "Not active or working", answer: "IDLE" },   
  { clue: "Wet earth or dirt", answer: "MUD" },        
  { clue: "A sheltered inlet of the sea", answer: "COVE" },                
  { clue: "The biblical garden of paradise", answer: "EDEN" },          
  { clue: "A flat wing-like structure", answer: "ALA" },                
  { clue: "A slight hollow or low point", answer: "DIP" },              
  { clue: "Chop food into small pieces", answer: "HASH" },              
  { clue: "Moving at a slow relaxed pace", answer: "LAZY" },            
  { clue: "Japan's currency", answer: "YEN" },         
  { clue: "A despicable or untrustworthy person", answer: "WORM" },     
  { clue: "Unable to hear", answer: "DEAF" },          
  { clue: "A silent performer using gestures", answer: "MIME" },        
  { clue: "A sharp or intense cry of mourning", answer: "KEEN" },       
  { clue: "A spiritual teacher or master", answer: "GURU" },            
  { clue: "Impose a tax or charge", answer: "LEVY" },  
  { clue: "Very light in color", answer: "PALE" },     
  { clue: "Rip or pull apart", answer: "TEAR" },       
  { clue: "Low in light or brightness", answer: "DIM" },                
  { clue: "A worshipped statue or image", answer: "IDOL" },             
  { clue: "A curved roof or ceiling", answer: "DOME" },
  { clue: "The positive force in Chinese philosophy", answer: "YANG" }, 
  { clue: "Unable to speak", answer: "DUMB" },         
  { clue: "A song with another artist might have this word in the title", answer: "FEAT" },            
  { clue: "Radiate warmth or happiness", answer: "GLOW" },              
  { clue: "A standard or typical example", answer: "NORM" },            
  { clue: "Looking sickly or faint", answer: "WAN" },  
  { clue: "Strike a position for a photo", answer: "POSE" },            
  { clue: "Travel by boat using wind", answer: "SAIL" },                
  { clue: "A Chinese dialect of the Yangtze delta", answer: "WU" },     
  { clue: "Push or drive forward", answer: "URGE" },   
  { clue: "By oneself or solitary", answer: "LONE" },  
  { clue: "A ceremonial priest's robe", answer: "COPE" },                   
  { clue: "Old TV screen technology", answer: "CRT" }, 
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
