// FUNCIONES UTILITARIAS
const hexToRgb = (hex) => {
  const cleanHex = hex.replace("#", "");
  const bigint = parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
};

// PARAMETROS DE STREAMERBOT
const querystring = window.location.search;
const urlParameters = new URLSearchParams(querystring);
const StreamerbotPort = urlParameters.get("port") || "8080";
const StreamerbotAddress = urlParameters.get("address") || "127.0.0.1";

// CONSTANTES
const comboMode = obtenerBooleanos("comboMode", false);
const startingTime = GetIntParam("startingTime", 3600);
const maxTime = GetIntParam("maxTime", 18000);

//TWITCH
const tier0 = GetIntParam("tier0", 17);
const tier1 = GetIntParam("tier1", 15);
const tier2 = GetIntParam("tier2", 20);
const tier3 = GetIntParam("tier3", 25);
const minBits = GetIntParam("minBits", 100);
const bitsTime = GetIntParam("bitsTime", 13);

//KOFI
const dono1 = GetIntParam("dono1", 3);
const dono2 = GetIntParam("dono2", 6);
const dono3 = GetIntParam("dono3", 9);
const dono1Time = GetIntParam("dono1Time", 20);
const dono2Time = GetIntParam("dono2Time", 30);
const dono3Time = GetIntParam("dono3Time", 40);

const donationTiers = [
    {cantidad: dono1, tiempo: dono1Time * 60},
    {cantidad: dono2, tiempo: dono2Time * 60},
    {cantidad: dono3, tiempo: dono3Time * 60}
]

//VISUAL
const colorFondo = urlParameters.get("fondoColor") || "#000000";
const opacity = urlParameters.get("opacidad") || 0.6;
const colorFuente = urlParameters.get("colorFuente") || "#ffffff";
const fuenteLetra = urlParameters.get("fuenteLetra") || "Consolas";

//MISC
const maxIncrementTime = 5;
const minToActivateComboBits = 3;
const processedGiftBombIds = new Set(); 

let timer = startingTime; 

let totalTime = startingTime;

// VARIABLES DE ESTADO
let countdownDisplay;
let intervalId = null;
let cuentaRegresivaIntervalo = null;
let comboModeIntervalo = null;
let cooldownIntervalo = null;
let combo = false;
let contadorBits = 0;
let contadorSubs = 0;
let cuentaRegresiva = 0;
let cuentaRegresivaComboMode = 0;
let cooldownComboMode = 0;
let isCombocooldown = false;
let incrementTime = 0;
let marathonOver = false;
let isPaused = true;
let temp = 0;
let maxTimeReached = false;

// APLICAR ESTILOS
const mainContainer = document.getElementById("main-container");
const timerDiv = document.getElementById("timer");

timerDiv.style.fontFamily = fuenteLetra;
mainContainer.style.color = colorFuente;

const { r, g, b } = hexToRgb(colorFondo);
mainContainer.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;

if(opacity > 0){
    mainContainer.style.boxShadow = "4px 4px 4px black";
}else{
    mainContainer.style.boxShadow = "0 0 0 black";
}

// CONEXIÓN A STREAMERBOT
const client = new StreamerbotClient({
  host: StreamerbotAddress,
  port: StreamerbotPort,
  onConnect: (data) => {
    console.log(data);
    setConnectionStatus(true);
  },
  onDisconnect: () => {
    setConnectionStatus(false);
  }
});


//COMMAND EVENTS//
client.on("Command.Triggered", (response) => {
    handleCommand(response.data);
});

//TWITCH EVENTS//
client.on("Twitch.RewardRedemption", (response)=> {
    if(!marathonOver)
        RewardRedemption(response.data);
    else
        return;
});

client.on("Twitch.Cheer", (response) => {
    if(!marathonOver)
        AddTimeWithCheers(response.data);
    else
        return;
});

client.on("Twitch.Sub", (response) => {
    if(!marathonOver)
        AddTimeWithSub(response.data);
    else
        return;
});

client.on("Twitch.ReSub", (response) => {
    if(!marathonOver)
        AddTimeWithReSub(response.data);
    else
        return;
});

client.on("Twitch.GiftSub", (response) => {
    if(!marathonOver)
        AddTimeWithGiftSub(response.data);
    else
        return;
});

client.on("Twitch.GiftBomb", (response) => {
    if(!marathonOver)
        AddTimeWithGiftBomb(response.data);
    else
        return;
});

// //KOFI EVENTS
client.on("Kofi.Donation", (response) => {
    if(!marathonOver)
        addTimeKofiDonation(response.data);
    else
        return;
});

// client.on("Kofi.Subscription", (response) => {
//     if(!marathonOver)
//         addTimeKofiSubscription(response.data);
//     else
//         return;
// });

// client.on("Kofi.Resubscription", (response) => {
//     if(!marathonOver)
//         addTimeKofiResubscription(response.data);
//     else
//         return;
// });

// client.on("Kofi.ShopOrder", (response) => {
//     if(!marathonOver)
//         addTimeKofiShopOrder(response.data);
//     else
//         return;
// });

// HELPER PARA MANEJAR TIEMPO PAUSADO
function getAdjustedTime(calculatedTime) {
    if (isPaused) {
        const pausedTime = getPausedTime();
        localStorage.clear();
        const newTime = calculatedTime + pausedTime;
        localStorage.setItem('pause', newTime);
        return newTime;
    }
    return calculatedTime;
}

// ADD TIME FUNCTIONS - REFACTORIZADAS
function RewardRedemption(data) {
    console.log(data);
    const title = data.reward.title;
    let valorCalculado = 0;
    if(title === "Add 5 min"){
        valorCalculado = 300;
    }
    AddTime(getAdjustedTime(valorCalculado));
}

function AddTimeWithCheers(data) {
    console.log("Cheers: ", data);
    const bits = data.message.bits;
    let valorCalculado = (bits / minBits) * bitsTime;
    valorCalculado = Math.round(valorCalculado * 60);
    AddTime(getAdjustedTime(valorCalculado));
}

function AddTimeWithGiftSub(data){
    console.log("Gift Sub: ", data);
    const giftId = data.communityGiftId;
    if(giftId && processedGiftBombIds.has(giftId)){
        return;
    }
    const tierSub = data.subTier;
    const tiempo =  obtenerTiers(tierSub);
    let valorCalculado = Math.round(tiempo * 60);
    AddTime(getAdjustedTime(valorCalculado));
}

function AddTimeWithSub(data) {
    console.log("Sub: ", data);
    const tierSub = data.sub_tier;
    const tiempo = obtenerTiers(tierSub, data.isPrime);
    let valorCalculado = Math.round(tiempo * 60);
    AddTime(getAdjustedTime(valorCalculado));
}

function AddTimeWithReSub(data) {
    console.log("ReSub: ", data);
    const tierSub = data.subTier;
    const tiempo = obtenerTiers(tierSub, data.isPrime);
    let valorCalculado = Math.round(tiempo * 60);
    AddTime(getAdjustedTime(valorCalculado));
}

function AddTimeWithGiftBomb(data){
    console.log("GiftBomb: ", data);
    const giftBombId = data.id;
    if(processedGiftBombIds.has(giftBombId)){
        return;
    }
    processedGiftBombIds.add(giftBombId);
    const totalGiftedSubs = data.recipients.length;
    const tiempo = obtenerGiftBombTiers(data.recipients.sub_tier);
    let valorCalculado = totalGiftedSubs * tiempo;
    valorCalculado = Math.round(valorCalculado * 60);
    AddTime(getAdjustedTime(valorCalculado));
}

function addTimeKofiDonation(data){
    console.log(data);
    const cantidad = parseFloat(data.amount);
    let valorCalculado = 0;

    const tiersOrdenados = donationTiers.sort((a, b) => b.cantidad - a.cantidad);

    for(const tier of tiersOrdenados){
        if(cantidad >= tier.cantidad){
            valorCalculado = tier.tiempo;
            break;
        }
    }

    if(valorCalculado > 0){
        AddTime(getAdjustedTime(valorCalculado));
    }else{
        return;
    }
}

// function addTimeKofiSubscription(data){
//     console.log(data);
// }

// function addTimeKofiResubscription(data){
//     console.log(data);
// }

// function addTimeKofiShopOrder(data){
//     console.log(data);
// }


//AGREGAR TIEMPO//
function AddTime(secondsToAdd) {
    secondsToAdd = Math.round(secondsToAdd);

    if (maxTimeReached || marathonOver) return;

    let tiempoRestante = maxTime - totalTime;

    if (tiempoRestante <= 0) {
        maxTimeReached = true;
        return;
    }

    if (secondsToAdd > tiempoRestante) {
        secondsToAdd = tiempoRestante;
        maxTimeReached = true;
    }

    totalTime += secondsToAdd;
    timer += secondsToAdd;

    animateTimeAddition(secondsToAdd);

    console.log(`⏱️ Tiempo añadido: ${secondsToAdd}s | ⌛ Total acumulado: ${totalTime}s / ${maxTime}s | 🕒 Timer visual: ${timer}s`);
}

function animateTimeAddition(seconds) {
    const tiempoAgregado = document.createElement('span');
    tiempoAgregado.className = "tiempoAgregado";
    tiempoAgregado.style.color = "#00F700";
    tiempoAgregado.style.fontSize = "15px";
    tiempoAgregado.style.fontFamily = "Cal Sans";
    tiempoAgregado.opacity = "0";
    tiempoAgregado.innerHTML = `+${seconds}`;
    tiempoAgregado.style.position = "absolute";
    tiempoAgregado.style.transform = "translate(-40%, -140%)";
    tiempoAgregado.style.transition = "opacity 1s ease-in";
    tiempoAgregado.style.right = "10px";
    const timeWrapper = document.getElementById('time-wrapper');
    timeWrapper.appendChild(tiempoAgregado);

    gsap.to(tiempoAgregado, {
        opacity: 1,
        duration:0.6,
        ease: "power2.out",  
        y: -55 
    });

    gsap.to(tiempoAgregado, {
        opacity: 0,
        duration:0.6,
        ease: "power2.in",  
    });

    setTimeout(() => {
        timeWrapper.removeChild(tiempoAgregado);
    }, 2000);
}

//COUNTDOWN TIMER//
function startCountdown() {
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(function () {
        if (timer <= 0) {
            marathonOver = true;
            clearInterval(intervalId);
            countdownDisplay.textContent = "¡Se acabó!";
            return;
        }

        let displayTime = timer;

        if (maxTime > 0 && timer >= maxTime) {
            maxTimeReached = true;
            displayTime = maxTime;
        }

        updateCountdownDisplay(displayTime);
        timer--;
    }, 1000);
}

function updateCountdownDisplay(timeInSeconds) {
    let horas = Math.floor(timeInSeconds / 3600);
    let minutos = Math.floor((timeInSeconds % 3600) / 60);
    let segundos = Math.floor(timeInSeconds % 60);

    horas = horas < 10 ? "0" + horas : horas;
    minutos = minutos < 10 ? "0" + minutos : minutos;
    segundos = segundos < 10 ? "0" + segundos : segundos;

    countdownDisplay.textContent = `${horas}:${minutos}:${segundos}`;
    temp = countdownDisplay.textContent;
    console.log(temp);
}


window.addEventListener("load", function () {
    countdownDisplay = document.getElementById("timer");
});
  
//STREAMERBOT STATUS FUNCTION//
function setConnectionStatus(connected){
    let statusContainer = document.getElementById("status-container");
    if(connected){
        statusContainer.style.background = "#2FB774";
        statusContainer.innerText = "CONECTADO!";
        statusContainer.style.opacity = 0;
        setTimeout(() => {
            statusContainer.style.transition = "all 2s ease";
            statusContainer.style.opacity = 0;
        }, 10);
    }else{
        statusContainer.style.background = "FF0000";
        statusContainer.innerText = "CONECTANDO...";
        statusContainer.style.transition = "";
        statusContainer.style.opacity = 0;
    }
}

function handleBitCounting() {
    contadorBits++;
    console.log("Contador: ", contadorBits);

    if (cuentaRegresivaIntervalo) {
        clearInterval(cuentaRegresivaIntervalo);
    }

    cuentaRegresiva = 60;

    if (contadorBits >= minToActivateComboBits) {
        activateComboMode();
        return;
    }

    startCountdownInterval();
}

function activateComboMode() {
    clearInterval(cuentaRegresivaIntervalo);
    combo = true;
    contadorBits = 0;
    cuentaRegresivaIntervalo = null;
    iniciarComboMode();
    comboTimeAnimation();
}

function startCountdownInterval() {
    cuentaRegresivaIntervalo = setInterval(() => {
        cuentaRegresiva--;
        if (cuentaRegresiva <= 0) {
            resetBitCounter();
        }
    }, 1000);
}

function resetBitCounter() {
    clearInterval(cuentaRegresivaIntervalo);
    cuentaRegresivaIntervalo = null;
    contadorBits = 0;
    console.log(contadorBits);
}

function iniciarContadorCheers(){
    handleBitCounting();
}

function iniciarComboMode(){
    cuentaRegresivaComboMode = 60;
    comboAnimation();

    if(comboModeIntervalo){
        clearInterval(comboModeIntervalo);
    }

    comboModeIntervalo = setInterval(() => {
        cuentaRegresivaComboMode--;
        if(cuentaRegresivaComboMode <= 0){
            clearInterval(comboModeIntervalo);
            comboModeIntervalo = null;
            comboModeCooldown();
        }
    }, 1000)
}

function comboModeCooldown(){
    cooldownComboMode = 600;
    const comboAlgo = document.getElementsByClassName("comboAlgo")[0];
    const comboWrapper = document.getElementById("combo-wrapper");
    gsap.to(comboAlgo, {
        opacity: 0,
        duration:0.6,
        ease: "power2.in",  
    });

    setTimeout(() => {
        comboWrapper.removeChild(comboAlgo);
    }, 2000);

    isCombocooldown = true;
    combo = false;
    console.log(combo);

    if(cooldownIntervalo){
        clearInterval(cooldownIntervalo);
    }

    cooldownIntervalo = setInterval(() =>{
        cooldownComboMode--;
        console.log(cooldownComboMode);
        if(cooldownComboMode <= 0){
            clearInterval(cooldownIntervalo);
            cooldownIntervalo = null;
            isCombocooldown = false;
        } 
    }, 1000)
}

function comboAnimation(){
    const comboAlgo = document.createElement("span");
    comboAlgo.className = "comboAlgo";
    comboAlgo.style.color = "#FFFFFF";
    comboAlgo.style.fontSize = "28px";
    comboAlgo.style.fontFamily = "'Press Start 2P', monospace";
    comboAlgo.style.fontWeight = "bold";
    comboAlgo.style.textShadow = "2px 2px 2px #000"
    comboAlgo.opacity = "0";
    comboAlgo.innerHTML = 'Combo';
    comboAlgo.style.position = "absolute";
    comboAlgo.style.transform = 'translate(-140px,-70px) rotate(-45deg)';
    comboAlgo.style.padding = '10px';

    const comboWrapper = document.getElementById("combo-wrapper");
    comboWrapper.appendChild(comboAlgo);

    gsap.to(comboAlgo, {
        rotation: -20,
        scale: 1.3,
        duration: 0.5,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1
    });    
}

function comboTimeAnimation() {
    const comboTimer = document.getElementById("combo-timer-square");

    //CON ESTA WEA ELIMINAMOS CUALQUIER ANIMACION PREVIA ACTIVA
    gsap.killTweensOf(comboTimer);

    //MOSTRAMOS LOS ELEMENTOS CON ESTOS VALORES
    comboTimer.style.opacity = '1';
    comboTimer.style.transformOrigin = 'left center';
    
    //REINICIAMOS LA PINCHE ESCALA DEL DIV PORQUE SI NO, NO SE VERA LA MADRE
    gsap.set(comboTimer, { scaleX: 1 });

    requestAnimationFrame(() => {
        gsap.to(comboTimer, {
            duration: 60, //ESTE VALOR SE OBTIENE DEL URI (no lo integre lol)
            scaleX: 0,
            ease: 'linear'
        });
    });
}

//MANIPULACION DE TIMER//
function PauseTimer(){
    if(isPaused)
        return;
    localStorage.setItem('pause', timer);
    clearInterval(intervalId)
    isPaused = true;
}

function ResumeTimer(){
    if(!isPaused)
        return;
    isPaused = false;
    timer = getPausedTime();
    localStorage.removeItem('pause');
    startCountdown();
}

function StartTimer(){
    if(!isPaused)
        return;
    isPaused = false;
    startCountdown();
}

function ResetTimer(){
    isPaused = false;
    timer = startingTime;
    startCountdown();
}

function addToTimer(message) {
    if (isPaused) return;
    const agregarSegundos = parseInt(message);
    if (isNaN(agregarSegundos)) {
        console.warn("addToTimer: No es un número válido:", message);
        return;
    }
    AddTime(agregarSegundos);
}



//HELPERS//
function handleCommand(data){
    console.log(data);
    const comando = data.name;
    const message = data.message;
    switch(comando){
        case 'pause':
            PauseTimer();
            break;
        case 'start':
            StartTimer();
            break;
        case 'reset':
            ResetTimer();
            break;
        case 'resume':
            ResumeTimer();
            break;
        case 'addTime': 
            addToTimer(message);
            break;
        default:
            console.warn('Comando no reconocido');
            break;
    }
}

function obtenerTiers(subTier, isPrime = false) {
    const tier = isPrime ? 0 : parseInt(subTier, 10);

    switch (tier) {
        case 0:
            return tier0;
        case 1000:
            return tier1;
        case 2000:
            return tier2;
        case 3000:
            return tier3;
        default:
            console.warn(`subTier desconocido (${subTier}), se usará tier0 como valor por defecto.`);
            return tier0;
    }
}

function obtenerGiftBombTiers(sub_tier) {
    const tier = parseInt(sub_tier);
    switch (tier) {
        case 1000:
            return tier1;
        case 2000:
            return tier2;
        case 3000:
            return tier3;
        default:
            console.warn(`subTier desconocido (${sub_tier}), se usará tier1 como valor por defecto.`);
            return tier1;
    }
}

function obtenerBooleanos(paramName, defaultValue) {
    const param = urlParameters.get(paramName);
    if (param === null) {
        return defaultValue;
    }
    return param.toLowerCase() === 'true';
}

function GetIntParam(paramName, defaultValue) {
    const param = urlParameters.get(paramName);
    if (param === null) {
        return defaultValue;
    }
    const parsed = parseInt(param, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getPausedTime() {
    const pausedTime = localStorage.getItem('pause');
    return pausedTime ? parseInt(pausedTime, 10) : 0;
}
