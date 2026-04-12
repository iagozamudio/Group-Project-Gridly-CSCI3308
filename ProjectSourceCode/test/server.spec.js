// ********************** Initialize server **********************************

const server = require('../tmp'); // imports the exported app.listen() from tmp.js

// ********************** Import Libraries ***********************************

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

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

describe('Testing Register API', () => {

  // Unique username every run — can never collide with a previous run
  const uniqueUser = `testuser_${Date.now()}`;

  it('Positive: /register with valid credentials returns 200 Success', done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: uniqueUser, password: 'securepass123' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equals('Success');
        done();
      });
  });

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

describe('Testing Login API (Extra Credit)', () => {

  before(done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: 'logintest_user', password: 'correct_password' })
      .end(() => done());
  });

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