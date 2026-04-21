//fix for the websocket on render
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
const ws = new WebSocket(wsUrl);
//old code
const user = JSON.parse(document.getElementById("user-data").textContent)
let messageForm;
let chatBox;
let errorContainer;

// ADDED for multiplayer progress
// opponentProgressEl — reference to the status panel div added in chat.hbs
let opponentProgressEl;
// END ADDED for multiplayer progress

console.log(user);

document.addEventListener("DOMContentLoaded", () => {
  messageForm = document.getElementById("sendMessageForm");
  chatBox = document.getElementById("chatbox");
  errorContainer = document.getElementById("errorContainer");

  // ADDED for multiplayer progress — grab the status panel
  opponentProgressEl = document.getElementById("opponentProgress");
  // END ADDED for multiplayer progress
  
  messageForm.addEventListener("submit", function (e) {
    e.preventDefault();
    let formData = new FormData(e.target);
    let message = {
      "type": "chat",
      "user": user,
      "recipient": opponent,
      "text": formData.get("message")
    }
    ws.send(JSON.stringify(message))
  })

  errorContainer.addEventListener("click", function(e) {
    e.target.parentElement.remove();
  })
});


ws.onopen = () => {
  console.log('Connected to server');
  ws.send('Hello from client');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data);

  if (data.type == "chat") {
    if (data.status != "failure") {
      addMessage(data.text, data.sender)
    } else {
      addError(data.text);
    }

  // ADDED for multiplayer progress — handle incoming progress updates
  } else if (data.type === "progress") {
    updateOpponentProgress(data.filled, data.total);

  // ADDED for multiplayer progress — handle incoming win notification
  } else if (data.type === "win") {
    showOpponentWon();
  }
  // END ADDED for multiplayer progress
};

ws.onclose = () => {
  console.log('Connection closed');
};
ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

const addMessage = (text, username) => {
  let whichUser = 2;
  console.log(username, user.username)
  if (username == user.username){
    document.getElementById("textbox")
    whichUser = 1;
  }
  let newMessage = document.createElement("li");
  newMessage.classList.add(`user${whichUser}`);
  newMessage.innerHTML = `<span>${username}:</span> ${text}`;
  chatBox.appendChild(newMessage);
}

const addError = (errorMsg) => {
  let newError = document.createElement("div")
  newError.innerHTML = `Error: ${errorMsg} <button>x</button>`
  errorContainer.appendChild(newError);
}

// ADDED for multiplayer progress
/**
 * updateOpponentProgress(filled, total)
 * Renders "Opponent has filled X/Y cells" in the status panel.
 * If the panel element isn't in the DOM yet (non-2P page), silently returns.
 */
function updateOpponentProgress(filled, total) {
  if (!opponentProgressEl) return;
  opponentProgressEl.classList.remove("progress-win"); // clear any win state
  opponentProgressEl.textContent = `Opponent has filled ${filled}/${total} cells`;
  opponentProgressEl.style.display = "block";
}

/**
 * showOpponentWon()
 * Replaces the progress text with a bold loss notice when the opponent
 * completes the puzzle.
 */
function showOpponentWon() {
  if (!opponentProgressEl) return;
  opponentProgressEl.classList.add("progress-win");
  opponentProgressEl.textContent = "Your opponent finished the puzzle – you lose";
  opponentProgressEl.style.display = "block";
}
// END ADDED for multiplayer progress

const chatContainer = document.getElementById("chatContainer");
const toggleBtn = document.getElementById("chatToggleBtn");
const closeBtn = document.getElementById("closeChatBtn");

toggleBtn.style.display = "none";

closeBtn.addEventListener("click", () => {
    chatContainer.style.display = "none";
    toggleBtn.style.display = "block";
});

toggleBtn.addEventListener("click", () => {
    chatContainer.style.display = "flex";
    toggleBtn.style.display = "none";
});
