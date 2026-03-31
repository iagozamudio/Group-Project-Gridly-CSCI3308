const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname, { index: false }));

app.get('/', (req, res) => {
  res.redirect('/pages/home.html');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});