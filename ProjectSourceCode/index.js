const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// ── Handlebars ──
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// ── DB (mirrors lab-7 exactly) ──
const db = pgp({
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

db.connect()
  .then(obj => { console.log('DB connected!'); obj.done(); })
  .catch(err => console.log('DB ERROR:', err.message));

// ── Middleware ──
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
}));

// ── Auth middleware ──
const auth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// ── Routes ──
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('pages/login'));
app.get('/register', (req, res) => res.render('pages/register'));

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  try {
    await db.none(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [req.body.username, hash]
    );
    await db.none(
      'INSERT INTO security_questions (username, question, answer) VALUES ($1, $2, $3)',
      [req.body.username, req.body.securityQuestion, req.body.securityAnswer]
    );
    res.redirect('/login');
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await db.one(
      'SELECT * FROM users WHERE username = $1',
      [req.body.username]
    );
    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.render('pages/home', {
        message: 'Incorrect username or password.',
        error: true
      });
    }
    req.session.user = user;
    req.session.save();
    res.redirect('/home');
  } catch (err) {
    res.redirect('/register');
  }
});

app.get('/home', auth, (req, res) => {
  res.render('pages/home', { user: req.session.user });
});

// ── Forgot Password Routes ──

// Question key → human-readable text (matches register.hbs options)
const questionMap = {
  q1: "What was the name of your first pet?",
  q2: "What city were you born in?",
  q3: "What is your mother's maiden name?",
  q4: "What was the make of your first car?",
};

// STEP 1 GET: render the blank forgot-password form
app.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password');
});

// STEP 1 POST: look up the username, return their security question
app.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  try {
    const row = await db.one(
      'SELECT question FROM security_questions WHERE username = $1',
      [username]
    );
    // Username found — render Step 2 with the question
    res.render('pages/forgot-password', {
      username,
      question: row.question,
      questionText: questionMap[row.question],
    });
  } catch (err) {
    // Username not found in security_questions table
    res.render('pages/forgot-password', {
      message: 'No account found with that username.',
      error: true,
    });
  }
});

// STEP 2 POST: check the security answer
app.post('/verify-answer', async (req, res) => {
  const { username, question, securityAnswer } = req.body;
  try {
    const row = await db.one(
      'SELECT answer FROM security_questions WHERE username = $1',
      [username]
    );
    if (securityAnswer.trim().toLowerCase() !== row.answer.trim().toLowerCase()) {
      // Wrong answer — re-render Step 2 with an error
      return res.render('pages/forgot-password', {
        username,
        question,
        questionText: questionMap[question],
        message: 'Incorrect answer. Please try again.',
        error: true,
      });
    }
    // Correct answer — render Step 3
    res.render('pages/forgot-password', {
      username,
      resetReady: true,
    });
  } catch (err) {
    res.render('pages/forgot-password', {
      message: 'Something went wrong. Please start over.',
      error: true,
    });
  }
});

// STEP 3 POST: hash and save the new password
app.post('/reset-password', async (req, res) => {
  const { username, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('pages/forgot-password', {
      username,
      resetReady: true,
      message: 'Passwords do not match. Please try again.',
      error: true,
    });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.none(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hash, username]
    );
    res.redirect('/login');
  } catch (err) {
    res.render('pages/forgot-password', {
      username,
      resetReady: true,
      message: 'Error resetting password. Please try again.',
      error: true,
    });
  }
});

app.get('/logout', auth, (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(3000);
console.log('Gridly running on port 3000');
