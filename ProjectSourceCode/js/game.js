const checkButton = document.getElementById('checkButton');
const checkMenu = document.getElementById('checkMenu');

checkButton.addEventListener('click', function (e) {
    e.stopPropagation();
    checkMenu.classList.toggle('show');
});

document.addEventListener('click', function (e) {
    if (!checkMenu.contains(e.target) && e.target !== checkButton && !checkButton.contains(e.target)) {
        checkMenu.classList.remove('show');
    }
});

const timerElement = document.getElementById('timer');
let seconds = 0;

function formatTime(sec) {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

setInterval(function () {
    seconds++;
    timerElement.textContent = formatTime(seconds);
}, 1000);