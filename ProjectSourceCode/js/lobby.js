let refreshButton;
let challengeList;
const ws = new WebSocket('ws://localhost:3000/ws');
const user = JSON.parse(document.getElementById("user-data").textContent)

ws.onopen = () => {
  console.log('Connected to server');
  ws.send('Hello from client');
};
ws.onmessage = (event) => {
  console.log("message recieve")
  const data = JSON.parse(event.data)
  console.log(data);

  if (data.type == "challenge"){
    if (data.status == "sending"){ // challenge being sent from one user to another
      const newChallenge = document.createElement("form");
      newChallenge.innerHTML = `
        Challenge from <span>${data.user.username}</span>
        <button type="submit" name="action" value="accept">Accept</button>
        <button type="submit" name="action" value="reject">Reject</button>
        <input type="hidden" name="username" value="${data.user.username}">
      `;
      newChallenge.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

       const username = formData.get('username');
       const action = e.submitter.value;

        if (action === 'accept') {
           const response = {
            "type": "challenge",
            "status": "accepting",
            "recipient": username
          }
          ws.send(JSON.stringify(response));
        } else if (action === 'reject') {
          // TODO
        }
       
      });
      challengeList.appendChild(newChallenge);
    } else if (data.status == "rejecting"){ // rejection being sent back from recipient TODO display message or smth  
    } else if (data.status == "redirect"){
      window.location.href = `/game?session_id=${data.session_id}`;
    }
  }
};
ws.onclose = () => {
  console.log('Connection closed');
};
ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

async function getPlayers () {
    const res = await fetch('/api/players');
    if (!res.ok) {
      throw new Error("Bad response from server");
    }

    const json = await res.json();

    if (!json) {
      throw new Error("No players");
    }
    return json
}
const refreshPlayerList = async () => {
    const dropdown = document.getElementById("playerDropdown");
    dropdown.innerHTML = "";
    const players = await getPlayers();
    console.log(players)
    for (let i = 0; i < players.length; i++){
        let newOption = document.createElement("option");
        newOption.text = players[i];
        newOption.value = players[i];
        dropdown.appendChild(newOption);
    }
}
document.addEventListener("DOMContentLoaded", (e) =>{
    refreshPlayerList();
    challengeList = document.getElementById("challengeList");

    refreshButton = document.getElementById("refresh");
    refreshButton.addEventListener("click", (e) =>{
        e.preventDefault()
        refreshPlayerList();
    })

    challengeButton = document.getElementById("challengeForm");
    challengeButton.addEventListener("submit", (e) =>{
        e.preventDefault();
        let formData = new FormData(e.target);
        const message = {
            "type": "challenge",
            "status": "sending",
            "user": user,
            "recipient": formData.get("player")
        };
        ws.send(JSON.stringify(message));
    })
    
})

