const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/pages/home.html');
});

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

app.post('/register', async (req, res) => {
  try {
    await db.none('INSERT INTO users(username, password) VALUES ($1, $2)', [
      req.body.username,
      req.body.password,
    ]);
    res.status(200).json({ message: 'Success' }); // ← was missing entirely
  } catch (error) {
    console.log('Registration error:', error.message || error);
    res.redirect('/register');
  }
});

module.exports = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});