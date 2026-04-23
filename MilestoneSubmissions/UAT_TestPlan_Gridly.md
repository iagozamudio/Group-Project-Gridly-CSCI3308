# Gridly – User Acceptance Test Plan
**Lab 10 | CSCI 3308 | Team Submission**

**Test Execution Date:** April 22, 2026
**Tester Name(s):** Alex Chen (classmate, non-team member)
**Tester Role/Relationship to Domain:** Casual crossword solver, plays NYT crosswords occasionally

---

## Overview

This document describes the User Acceptance Test (UAT) plan for the Gridly crossword web application. It covers at least 4 features, with each scenario including test data, test environment, expected results, and tester information.

Test results and observations were recorded during execution in Week 4.

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
- **Tester Role:** User outside the development team (classmate unfamiliar with the app)
- **Technical Level:** Non-developer; first-time user of the application

### Actual Test Results / Observations

**TC-1.1 Results:**
- Pass
- **What did the user do?** The user completed their registration. Afterwards, they were redirected to the login page.
- **What was the user's reasoning for their actions?** They were able to read the prompts for each input field and so complete each correctly.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-1.2 Results:**
- Pass
- **What did the user do?** The user entered an existing username. They were kept on the registration page and an error message appeared saying "Username already taken."
- **What was the user's reasoning for their actions?** They wanted to see if the system would let them create a duplicate account. The user understood that the registration was unsuccessful because the error message clearly explained why.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

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

**TC-2.1 Results:**
- Pass
- **What did the user do?** The user entered their username and password, then clicked Log In. They were redirected to the home page and saw their username displayed.
- **What was the user's reasoning for their actions?** They understood that correct credentials should grant access to the main application.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-2.2 Results:**
- Pass
- **What did the user do?** The user entered the correct username but typed a wrong password. They remained on the login page and saw an error message saying "Incorrect username or password."
- **What was the user's reasoning for their actions?** They wanted to test what happens with incorrect credentials. The user understood the login failed because of the error message.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-2.3 Results:**
- Pass
- **What did the user do?** Without logging in, the user typed the home page URL directly into the browser. They were immediately redirected to the login page.
- **What was the user's reasoning for their actions?** They wanted to see if they could bypass the login screen by typing the URL directly.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

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
- **Tester Role:** Crossword enthusiast outside the development team, someone who plays NYT crosswords
- **Technical Level:** General user; comfortable playing browser-based games

### Actual Test Results / Observations

**TC-3.1 Results:**
- Pass
- **What did the user do?** The user logged in and navigated to the single-player game page. They observed the 5x5 grid, numbered cells, clue panels, and timer.
- **What was the user's reasoning for their actions?** They wanted to verify that the game interface loads completely before playing.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-3.2 Results:**
- Pass
- **What did the user do?** The user clicked on a white cell, typed letters, and watched the cursor advance. They also used the backspace key to clear letters.
- **What was the user's reasoning for their actions?** They expected the cursor to move automatically to the next cell, similar to other crossword games they have played.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-3.3 Results:**
- Pass
- **What did the user do?** The user filled in one word correctly and one word incorrectly, then clicked the "Check Word" button. Correct cells turned green and incorrect cells turned red.
- **What was the user's reasoning for their actions?** They wanted to confirm that the check tool correctly identifies right and wrong answers.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-3.4 Results:**
- Pass
- **What did the user do?** The user clicked on an empty cell, then clicked the Hint button. The correct letter appeared and the cell turned green.
- **What was the user's reasoning for their actions?** They were stuck on a clue and wanted to see if the hint tool would reveal the correct letter.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

---

## Feature 4: User Logout and Session Termination

### Description
A logged-in user should be able to log out, ending their session. After logout, protected routes should be inaccessible and the browser back button should not restore an authenticated session.

### Test Cases

**TC-4.1 – Successful Logout**
- **Steps:** While logged in, click the Logout button. Then try to use the browser's back button.
- **Expected Result:** User is redirected to the login page. Browser back button does not restore access to protected pages.
- **Test Data:** N/A

**TC-4.2 – Access Protected Routes After Logout**
- **Steps:** After logging out, attempt to navigate directly to protected routes (e.g., `/home`, `/single-player`).
- **Expected Result:** User is redirected to the login page for all protected routes.
- **Test Data:** N/A

### Test Environment
- **Environment:** Localhost (`http://localhost:3000`)
- **Browser:** Chrome (latest)
- **Database:** PostgreSQL via Docker

### Tester Information
- **Tester Role:** User outside the development team
- **Technical Level:** Casual internet user

### Actual Test Results / Observations

**TC-4.1 Results:**
- Pass
- **What did the user do?** The user clicked the Logout button while logged in. They were redirected to the login page. When they pressed the browser's back button, they remained on the login page.
- **What was the user's reasoning for their actions?** They wanted to end their session and verify that the back button would not restore access to the home page.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

**TC-4.2 Results:**
- Pass
- **What did the user do?** After logging out, the user typed protected URLs (like `/home` and `/single-player`) directly into the browser. They were redirected to the login page each time.
- **What was the user's reasoning for their actions?** They wanted to see if they could still access game pages after logging out by typing the URLs directly.
- **Was behavior consistent with the use case?** Yes
- **If deviation occurred, what was the reason?** No deviation.
- **Did you make changes to the application based on this observation?** No

---

## Summary Table

| Test Case | Feature | Expected Outcome | Pass/Fail | Notes |
|-----------|---------|------------------|-----------|-------|
| TC-1.1 | Registration | Redirect to login | Pass | |
| TC-1.2 | Registration | Error on duplicate user | Pass | |
| TC-2.1 | Login / Session | Redirect to home | Pass | |
| TC-2.2 | Login / Session | Error message shown | Pass | |
| TC-2.3 | Login / Session | Redirect to login for protected route | Pass | |
| TC-3.1 | Single Player Game | Grid and clues load | Pass | |
| TC-3.2 | Single Player Game | Letter input works | Pass | |
| TC-3.3 | Single Player Game | Check tool highlights | Pass | |
| TC-3.4 | Single Player Game | Hint reveals letter | Pass | |
| TC-4.1 | Logout | Redirect to login after logout | Pass | Back button does not restore session |
| TC-4.2 | Logout | Protected routes inaccessible after logout | Pass | |

---

## Summary of Changes Made Based on UAT Observations

| Observation (What did users do?) | User's Reasoning | Change Implemented |
|----------------------------------|------------------|---------------------|
| N/A – all tests passed with no deviations | N/A | No changes needed; application met all acceptance criteria |

---

*This test plan was executed in Week 4 with a real user outside the development team. Observations and feedback were recorded and included in the final project report.*