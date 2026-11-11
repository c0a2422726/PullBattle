//==============================
// Pull Battle Client
//==============================

const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

//==============================
// Canvas
//==============================

function resize(){

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

}

window.addEventListener("resize",resize);

resize();

//==============================
// World
//==============================

let worldWidth = 2000;
let worldHeight = 2000;

let walls = [];

//==============================
// Player
//==============================

const players = {};

let myId = null;

//==============================
// Camera
//==============================

const camera = {

    x:0,
    y:0

};

//==============================
// Drag
//==============================

let dragging = false;

let dragStart = {

    x:0,
    y:0

};

let dragEnd = {

    x:0,
    y:0

};

//==============================
// Socket
//==============================

socket.on("init",data=>{

    myId = data.id;

    worldWidth = data.width;
    worldHeight = data.height;

    walls = data.walls;

    for(const p of data.players){

        players[p.id] = p;

    }

});

socket.on("join",player=>{

    players[player.id] = player;

});

socket.on("leave",id=>{

    delete players[id];

});

socket.on("state",state=>{

    const exists = {};

    for(const p of state.players){

        players[p.id] = p;

        exists[p.id] = true;

    }

    for(const id in players){

        if(!exists[id]){

            delete players[id];

        }

    }

});

//==============================

function me(){

    return players[myId];

}
//==============================
// Pointer
//==============================

function pointerPosition(clientX, clientY){

    const rect = canvas.getBoundingClientRect();

    return {

        x:clientX - rect.left,
        y:clientY - rect.top

    };

}

//==============================
// Drag
//==============================

function startDrag(x,y){

    dragging = true;

    dragStart.x = x;
    dragStart.y = y;

    dragEnd.x = x;
    dragEnd.y = y;

}

function moveDrag(x,y){

    if(!dragging) return;

    dragEnd.x = x;
    dragEnd.y = y;

}

function endDrag(){

    if(!dragging) return;

    dragging = false;

    const dx = dragStart.x - dragEnd.x;
    const dy = dragStart.y - dragEnd.y;

    // 最大距離制限
    const length = Math.hypot(dx,dy);

    let powerX = dx;
    let powerY = dy;

    const MAX_PULL = 150;

    if(length > MAX_PULL){

        powerX = dx / length * MAX_PULL;
        powerY = dy / length * MAX_PULL;

    }

    socket.emit("pull",{

        x:powerX * 0.10,
        y:powerY * 0.10

    });

}

//==============================
// Mouse
//==============================

canvas.addEventListener("mousedown",e=>{

    const p = pointerPosition(
        e.clientX,
        e.clientY
    );

    startDrag(p.x,p.y);

});

window.addEventListener("mousemove",e=>{

    const p = pointerPosition(
        e.clientX,
        e.clientY
    );

    moveDrag(p.x,p.y);

});

window.addEventListener("mouseup",()=>{

    endDrag();

});

//==============================
// Touch
//==============================

canvas.addEventListener("touchstart",e=>{

    e.preventDefault();

    const t = e.touches[0];

    const p = pointerPosition(
        t.clientX,
        t.clientY
    );

    startDrag(p.x,p.y);

},{passive:false});

canvas.addEventListener("touchmove",e=>{

    e.preventDefault();

    const t = e.touches[0];

    const p = pointerPosition(
        t.clientX,
        t.clientY
    );

    moveDrag(p.x,p.y);

},{passive:false});

canvas.addEventListener("touchend",e=>{

    e.preventDefault();

    endDrag();

},{passive:false});

//==============================
// Drag Line
//==============================

function drawDragLine(){

    if(!dragging) return;

    ctx.beginPath();

    ctx.moveTo(
        dragStart.x,
        dragStart.y
    );

    ctx.lineTo(
        dragEnd.x,
        dragEnd.y
    );

    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;

    ctx.stroke();

}
//==============================
// Camera
//==============================

function updateCamera(){

    const p = me();

    if(!p) return;

    camera.x = p.x - canvas.width / 2;
    camera.y = p.y - canvas.height / 2;

    camera.x = Math.max(
        0,
        Math.min(
            camera.x,
            worldWidth - canvas.width
        )
    );

    camera.y = Math.max(
        0,
        Math.min(
            camera.y,
            worldHeight - canvas.height
        )
    );

}

//==============================
// Background
//==============================

function drawBackground(){

    ctx.fillStyle = "#2d2d2d";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

}

//==============================
// Walls
//==============================

function drawWalls(){

    ctx.save();

    ctx.translate(
        -camera.x,
        -camera.y
    );

    ctx.fillStyle = "#666";

    for(const wall of walls){

        ctx.fillRect(
            wall.x,
            wall.y,
            wall.w,
            wall.h
        );

    }

    ctx.restore();

}

//==============================
// Border
//==============================

function drawBorder(){

    ctx.save();

    ctx.translate(
        -camera.x,
        -camera.y
    );

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;

    ctx.strokeRect(
        0,
        0,
        worldWidth,
        worldHeight
    );

    ctx.restore();

}

//==============================
// Players
//==============================

function drawPlayers(){

    ctx.save();

    ctx.translate(
        -camera.x,
        -camera.y
    );

    for(const id in players){

        const p = players[id];

        if(!p.alive){

            ctx.globalAlpha = 0.3;

        }

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            20,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#3b82f6";
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // HP
        ctx.fillStyle = "#ff0000";

        ctx.fillRect(
            p.x - 20,
            p.y - 34,
            40,
            5
        );

        ctx.fillStyle = "#00ff00";

        ctx.fillRect(
            p.x - 20,
            p.y - 34,
            40 * (p.hp / 100),
            5
        );

        ctx.globalAlpha = 1;

    }

    ctx.restore();

}
//==============================
// Draw
//==============================

function draw() {

    drawBackground();

    updateCamera();

    drawBorder();

    drawWalls();

    drawPlayers();

    drawDragLine();

}

//==============================
// Game Loop
//==============================

function gameLoop() {

    draw();

    requestAnimationFrame(gameLoop);

}

gameLoop();