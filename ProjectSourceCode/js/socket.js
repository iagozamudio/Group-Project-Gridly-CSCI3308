
const ws = new WebSocket('ws://localhost:3000/ws');
const user = JSON.parse(document.getElementById("user-data").textContent)
let messageForm;
let chatBox;

console.log(user);

document.addEventListener("DOMContentLoaded", () => {
  messageForm = document.getElementById("sendMessageForm");
  chatBox = document.getElementById("chatbox");
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
    }
    // TODO handle failure to send
  }
};
ws.onclose = () => {
  console.log('Connection closed');
};
ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

const addMessage = (text, username) => {
  console.log("adding message");
  let whichUser = 2;
  console.log(username, user.username)
  if (username == user.username){
    document.getElementById("textbox")
    whichUser = 1;
  }
  let newMessage = document.createElement("li");
  newMessage.classList.add(`user${whichUser}`);
  newMessage.innerHTML = `<span>${username}: </span>${text}`;
  chatBox.appendChild(newMessage);
}


