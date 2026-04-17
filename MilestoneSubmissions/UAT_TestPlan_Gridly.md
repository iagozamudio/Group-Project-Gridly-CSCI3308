# Gridly – User Acceptance Test Plan
**Lab 10 | CSCI 3308 | Team Submission**

---

## Overview

This document describes the User Acceptance Test (UAT) plan for the Gridly crossword web application. It covers at least 3 features, with each scenario including test data, test environment, expected results, and tester information.

Test results and observations will be recorded in this document after execution during Week 4.

---

## Feature 1: User Registration

### Description
A new user should be able to create an account by providing a username, password, and security question/answer. The system must store the user and redirect them to the login page.

### Test Cases

**TC-1.1 – Successful Registration**
- **Steps:** Navigate to `/register`. Enter a unique username (e.g., `crossword_fan`), a password (e.g., `Puzzle2026!`), choose a security question, and enter an answer. Click Sign Up.
- **Expected Result:** User is redirected to the login page. No error message is shown.
- **Test Data:** username=`crossword_fan`, password=`Puzzle2026!`, question=`What city were you born in?`, answer=`Denver`

**TC-1.2 – Duplicate Username**
- **Steps:** Attempt to register with a username that already exists in the database.
- **Expected Result:** User stays on the register page. An appropriate error message is shown (e.g., "Username already taken").
- **Test Data:** username=`crossword_fan` (already registered from TC-1.1)

### Test Environment
- **Environment:** Localhost (`http://localhost:3000`)
- **Browser:** Chrome or Firefox (latest)
- **Database:** PostgreSQL via Docker (fresh state before each test run)

### Tester Information
- **Tester Role:** User outside the development team (classmate or friend unfamiliar with the app)
- **Technical Level:** Non-developer; first-time user of the application

### Actual Test Results / Observations
*(To be filled in during Week 4 testing)*

---

## Feature 2: User Login and Session Management

### Description
A registered user should be able to log in with valid credentials and be redirected to the home page. Their session should persist across page navigation. An invalid login should show an error and not grant access.

### Test Cases

**TC-2.1 – Successful Login**
- **Steps:** Navigate to `/login`. Enter a valid username and password. Click Log In.
- **Expected Result:** User is redirected to `/home`. Their username is visible on the home page.
- **Test Data:** username=`crossword_fan`, password=`Puzzle2026!`

**TC-2.2 – Invalid Password**
- **Steps:** Navigate to `/login`. Enter the correct username but a wrong password. Click Log In.
- **Expected Result:** User remains on the login page. An error message appears (e.g., "Incorrect username or password.").
- **Test Data:** username=`crossword_fan`, password=`wrongpassword`

**TC-2.3 – Accessing Protected Route Without Login**
- **Steps:** Without logging in, navigate directly to `http://localhost:3000/home`.
- **Expected Result:** User is redirected to the login page.

### Test Environment
- **Environment:** Localhost (`http://localhost:3000`)
- **Browser:** Chrome (latest)
- **Database:** PostgreSQL via Docker with the `crossword_fan` user pre-inserted

### Tester Information
- **Tester Role:** User outside the development team
- **Technical Level:** Casual internet user; comfortable with web forms

### Actual Test Results / Observations
*(To be filled in during Week 4 testing)*

---

## Feature 3: Single-Player Crossword Game

### Description
A logged-in user should be able to start a single-player crossword game, fill in answers, use the check/hint/erase tools, and have the timer run correctly throughout the session.

### Test Cases

**TC-3.1 – Game Loads Correctly**
- **Steps:** Log in, navigate to the single-player game page. Observe that the 5x5 crossword grid renders with numbered cells, and that the Across and Down clue panels are populated.
- **Expected Result:** Grid is visible with correct black/white cell layout. At least 5 clues appear in each direction. Timer starts at 00:00:00.
- **Test Data:** No input required; uses auto-generated puzzle.

**TC-3.2 – Entering Answers**
- **Steps:** Click a white cell on the board, type a letter. Observe cursor movement. Type multiple letters to fill a word.
- **Expected Result:** Letters appear in cells. Cursor advances to the next cell in the selected direction. Backspace clears the current cell and moves cursor back.

**TC-3.3 – Check Answer Tool**
- **Steps:** Fill in at least one complete word correctly and one word incorrectly. Click the check button → "Check Word."
- **Expected Result:** Correctly answered cells highlight green. Incorrectly answered cells highlight red.
- **Test Data:** Correct word based on clue (e.g., clue "Frozen water" → `ICE`). Incorrect word intentionally misspelled.

**TC-3.4 – Hint Tool**
- **Steps:** Click an empty or incorrectly filled cell, then click the Hint (lightbulb) button.
- **Expected Result:** The correct letter is revealed in that cell and it is marked green.

### Test Environment
- **Environment:** Localhost (`http://localhost:3000`)
- **Browser:** Chrome (latest) — game uses browser DOM rendering
- **Database:** Not required for game logic (puzzle is client-side)

### Tester Information
- **Tester Role:** Crossword enthusiast outside the development team, ideally someone who plays NYT crosswords or similar
- **Technical Level:** General user; comfortable playing browser-based games

### Actual Test Results / Observations
*(To be filled in during Week 4 testing)*

---

## Summary Table

| Test Case | Feature               | Expected Outcome        | Pass/Fail | Notes |
|-----------|----------------------|-------------------------|-----------|-------|
| TC-1.1    | Registration          | Redirect to login       |           |       |
| TC-1.2    | Registration          | Error on duplicate user |           |       |
| TC-2.1    | Login / Session       | Redirect to home        |           |       |
| TC-2.2    | Login / Session       | Error message shown     |           |       |
| TC-2.3    | Login / Session       | Redirect to login       |           |       |
| TC-3.1    | Single Player Game    | Grid and clues load     |           |       |
| TC-3.2    | Single Player Game    | Letter input works      |           |       |
| TC-3.3    | Single Player Game    | Check tool highlights   |           |       |
| TC-3.4    | Single Player Game    | Hint reveals letter     |           |       |

---

*This test plan will be executed in Week 4 with real users. Observations and feedback will be recorded and included in the final project report.*