# Gridly — Competitive Crossword Puzzle Platform

Gridly is a web-based crossword puzzle game where players can solve procedurally generated crossword puzzles in single-player mode or compete head-to-head against friends in real-time multiplayer matches. Players earn points based on speed and hints used, track their rankings on the leaderboard, and manage their profiles over time.

---

## Contributors

| Name | GitHub Username |
|------|----------------|
| Iago Zamudio | @iagozamudio |
| James O'Connor | @jamesoconnr |
| Juan Castillero | @JuanDCB05 |
| Samra Redzic | @Sare9356 |
| Thabo Kelebeng | @JoyfulTom |
| Xander Chisholm | @leBronzo1 |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Handlebars (HBS), Bootstrap 5, JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Real-Time Communication** | WebSockets (`ws` library) |
| **Templating Engine** | Express-Handlebars |
| **Authentication** | `bcryptjs`, `express-session` |
| **File Uploads** | Multer |
| **Testing** | Mocha, Chai, Chai-HTTP |
| **Containerization** | Docker, Docker Compose |
| **Process Management** | Nodemon |

---

## Prerequisites

Before running the application, make sure you have the following installed:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (v20.10+) — used to run the app and database in containers
- **[Node.js](https://nodejs.org/)** (v18+) — for local development outside Docker
- **[npm](https://www.npmjs.com/)** (v9+) — comes bundled with Node.js
- **[Git](https://git-scm.com/)** — to clone the repository

---

## Environment Setup

Before running the app, create a `.env` file inside the `ProjectSourceCode/` directory with the following variables:

```env
POSTGRES_DB=gridly_db
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
SESSION_SECRET=your_session_secret
NODE_ENV=development
```

>  Never commit your `.env` file — it is already listed in `.gitignore`.

---

##  How to Run the Application Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/iagozamudio/Group-Project-Gridly-CSCI3308.git
   cd Group-Project-Gridly-CSCI3308/ProjectSourceCode
   ```

2. **Create your `.env` file** (see Environment Setup above).

3. **Start the application with Docker Compose:**
   ```bash
   docker compose up
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

5. **To stop the application:**
   ```bash
   docker compose down
   ```

##  How to Run the Tests

Tests are written using **Mocha** and **Chai** and run automatically when the Docker container starts (`npm run testandrun`).

### To run tests manually:

**With Docker running:**
```bash
docker compose exec web npm test
```

Test files are located in `ProjectSourceCode/test/server.spec.js` and cover:
- Server health check (`GET /welcome`)
- User registration (`POST /register`) — positive and negative cases
- User login (`POST /login`) — positive and negative cases

---

## Deployed Application

> 🔗 **https://group-project-gridly-csci3308.onrender.com**

The application is deployed on [Render](https://render.com). Visit the link above to use Gridly without any local setup.

---

## Project Structure

```
Group-Project-Gridly-CSCI3308/
├── ProjectSourceCode/
│   ├── css/                   # Stylesheets
│   ├── img/                   # Static images and uploads
│   ├── init_data/             # SQL schema (create.sql)
│   ├── js/                    # Client-side JavaScript
│   ├── pages/                 # Static HTML pages (legacy)
│   ├── test/                  # Mocha/Chai test files
│   ├── views/                 # Handlebars templates
│   │   ├── layouts/           # Main layout
│   │   ├── pages/             # Page-level HBS templates
│   │   └── partials/          # Reusable components (navbar, footer, etc.)
│   ├── docker-compose.yaml    # Docker configuration
│   ├── index.js               # Express app entry point (legacy)
│   ├── tmp.js                 # Main server file
│   ├── package.json           # Node dependencies and scripts
│   └── .env                   # Environment variables (not committed)
├── MilestoneSubmissions/      # Weekly release notes
└── README.md                  # This file
```

---

## Features

- **Single Player Mode** — Solve a procedurally generated 5×5 crossword puzzle with a live timer and scoring
- **Two-Player Mode** — Challenge another online player to a real-time crossword race via WebSockets
- **Live Chat** — In-game chat during multiplayer sessions
- **Opponent Progress Tracking** — See how many cells your opponent has filled in real time
- **Leaderboard** — View the top fastest times and scores across single-player and two-player modes
- **User Profiles** — View game history, stats, and rankings
- **Account Settings** — Update username, display name, and profile picture
- **Forgot Password** — Security question-based password recovery
- **Rating System** — ELO-style rating updates after multiplayer games
