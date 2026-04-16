let refreshButton;

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
    
    refreshButton = document.getElementById("refresh");
    refreshButton.addEventListener("click", (e) =>{
        e.preventDefault()
        refreshPlayerList();
    })

    challengeButton = document.getElementById("challengeForm");
    refreshButton.addEventListener("submit", (e) =>{
        e.preventDefault();
        let formData = new FormData(e.target);
        const message = {
            "type": "challenge",
            "user": user,
            "recipient": formData.get("player")
        }
        ws.send()
    })
})

