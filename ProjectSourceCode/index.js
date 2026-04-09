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
  defaultLayout: 'main'
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
      return res.render('pages/login', {
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

app.get('/leaderboard', auth, (req, res) => {
  res.render('pages/leaderboard');
});

app.get('/leaderboard', auth, (req, res) => {
  res.render('pages/leaderboard');
});

app.get('/leaderboard', auth, (req, res) => {
  res.render('pages/leaderboard');
}); 

app.get('/Profile', (req, res) => {
  res.render('pages/Profile');
});

app.get('/logout', auth, (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(3000);
console.log('Gridly running on port 3000');
