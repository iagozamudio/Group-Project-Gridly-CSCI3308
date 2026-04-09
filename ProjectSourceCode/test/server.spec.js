// ********************** Initialize server **********************************

const server = require('../tmp'); // imports the exported app.listen() from tmp.js

// ********************** Import Libraries ***********************************

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************
//
// Tests the /welcome GET endpoint that is required by the lab starter code.
// Expected: HTTP 200 with body { status: 'success', message: 'Welcome!' }

describe('Server!', () => {
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** REGISTER API TESTCASES *****************************
//
// Tests the POST /register endpoint.
// chai-http .send(object) automatically sets Content-Type: application/json,
// which triggers the wantsJson() branch in tmp.js and returns JSON responses.
//
// Positive case: valid username + password → 200 { message: 'Success' }
// Negative case: empty password            → 400 { message: 'Invalid input' }

describe('Testing Register API', () => {

  // ── Positive: valid credentials should be accepted and stored ──────────────
  it('Positive: /register with valid credentials returns 200 Success', done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: 'testuser_gridly', password: 'securepass123' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equals('Success');
        done();
      });
  });

  // ── Negative: missing password should be rejected ──────────────────────────
  it('Negative: /register with missing password returns 400 Invalid input', done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: 'testuser_nogridly', password: '' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.message).to.equals('Invalid input');
        done();
      });
  });

});

// *********************** EXTRA CREDIT: LOGIN API TESTCASES ******************
//
// Tests the POST /login endpoint.
//
// A before() hook registers a fresh user ('logintest_user') into the real
// PostgreSQL database so the login tests have a known user to work with.
//
// Positive case: correct credentials  → 200 { message: 'Login successful', username }
// Negative case: wrong password       → 400 { message: 'Invalid credentials' }

describe('Testing Login API (Extra Credit)', () => {

  // Register the test user once before these login tests run.
  // If this insert fails (e.g., user already exists from a previous run),
  // the test still proceeds — the user is already in the DB.
  before(done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: 'logintest_user', password: 'correct_password' })
      .end(() => done()); // always call done() regardless of result
  });

  // ── Positive: correct username + password ──────────────────────────────────
  it('Positive: /login with correct credentials returns 200 Login successful', done => {
    chai
      .request(server)
      .post('/login')
      .send({ username: 'logintest_user', password: 'correct_password' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equals('Login successful');
        expect(res.body.username).to.equals('logintest_user');
        done();
      });
  });

  // ── Negative: wrong password should be rejected ────────────────────────────
  it('Negative: /login with wrong password returns 400 Invalid credentials', done => {
    chai
      .request(server)
      .post('/login')
      .send({ username: 'logintest_user', password: 'wrong_password' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.message).to.equals('Invalid credentials');
        done();
      });
  });

});
