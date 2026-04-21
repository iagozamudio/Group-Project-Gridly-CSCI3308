
const ws = new WebSocket('ws://localhost:3000/ws');
const user = JSON.parse(document.getElementById("user-data").textContent)
let messageForm;
let chatBox;
let errorContainer;

console.log(user);

document.addEventListener("DOMContentLoaded", () => {
  messageForm = document.getElementById("sendMessageForm");
  chatBox = document.getElementById("chatbox");
  errorContainer = document.getElementById("errorContainer")
  
  messageForm.addEventListener("submit", function (e) {
    e.preventDefault();
    let formData = new FormData(e.target);
    let message = {
      "type": "chat",
      "user": user,
      "recipient": "*", // should be swapped out with actual username/id once multiplayer is working
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
  if (data.type == "chat"){
    if (data.status != "failure"){
      addMessage(data.text, data.sender)
    } else {
      addError(data.text);
    }
  }
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