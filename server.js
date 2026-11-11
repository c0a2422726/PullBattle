const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

server.listen(PORT, () => {
    console.log("Server Started");
});

//========================
// Game Settings
//========================

const TICK = 1000 / 60;

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

const PLAYER_RADIUS = 30;
const PLAYER_HP = 100;

const RESPAWN_TIME = 3000;

const players = {};

//========================
// 障害物
//========================

const walls = [

    { x: 500, y: 500, w: 300, h: 50 },

    { x: 1000, y: 1200, w: 50, h: 300 },

    { x: 1400, y: 700, w: 250, h: 50 }

];

//========================

function randomSpawn() {

    return {

        x: 100 + Math.random() * (MAP_WIDTH - 200),

        y: 100 + Math.random() * (MAP_HEIGHT - 200)

    };

}

//========================

const COLORS = [
    "#ff4d4d", // 赤
    "#4d7cff", // 青
    "#4dff88", // 緑
    "#ffd54d", // 黄
    "#ff66ff", // 紫
    "#66ffff", // 水色
    "#ff884d", // オレンジ
    "#ffffff"  // 白
];

let playerCount = 0;

function createPlayer(id) {

    const pos = randomSpawn();

    const player = {

        id,

        name: "Player " + (playerCount + 1),

        color: COLORS[playerCount % COLORS.length],

        x: pos.x,
        y: pos.y,

        vx: 0,
        vy: 0,

        hp: PLAYER_HP,

        alive: true,

        respawn: 0

    };

    playerCount++;

    return player;

}

//========================
// Socket
//========================

io.on("connection", socket => {

    players[socket.id] = createPlayer(socket.id);

    socket.emit("init", {

        id: socket.id,

        width: MAP_WIDTH,

        height: MAP_HEIGHT,

        walls,

        players: Object.values(players)

    });

    socket.broadcast.emit(
        "join",
        players[socket.id]
    );

    socket.on("pull", data => {

        const p = players[socket.id];

        if (!p) return;

        if (!p.alive) return;

        p.vx += data.x;

        p.vy += data.y;

    });

    socket.on("disconnect", () => {

        delete players[socket.id];

        io.emit("leave", socket.id);

    });

});
//========================
// Physics
//========================

const FRICTION = 0.985;
const MAX_SPEED = 30;
const WALL_BOUNCE = 0.2;

//========================

function limitSpeed(p) {

    const speed = Math.hypot(p.vx, p.vy);

    if (speed <= MAX_SPEED) return;

    p.vx = p.vx / speed * MAX_SPEED;
    p.vy = p.vy / speed * MAX_SPEED;

}

//========================

function updatePlayer(p) {

    if (!p.alive) return;

    limitSpeed(p);

    p.x += p.vx;
    p.y += p.vy;

    p.vx *= FRICTION;
    p.vy *= FRICTION;

    //------------------------
    // 外壁
    //------------------------

    if (p.x < PLAYER_RADIUS) {

        p.x = PLAYER_RADIUS;
        p.vx *= -WALL_BOUNCE;

    }

    if (p.x > MAP_WIDTH - PLAYER_RADIUS) {

        p.x = MAP_WIDTH - PLAYER_RADIUS;
        p.vx *= -WALL_BOUNCE;

    }

    if (p.y < PLAYER_RADIUS) {

        p.y = PLAYER_RADIUS;
        p.vy *= -WALL_BOUNCE;

    }

    if (p.y > MAP_HEIGHT - PLAYER_RADIUS) {

        p.y = MAP_HEIGHT - PLAYER_RADIUS;
        p.vy *= -WALL_BOUNCE;

    }

    //------------------------
    // 障害物
    //------------------------

    for (const wall of walls) {

        const nearestX = Math.max(
            wall.x,
            Math.min(p.x, wall.x + wall.w)
        );

        const nearestY = Math.max(
            wall.y,
            Math.min(p.y, wall.y + wall.h)
        );

        const dx = p.x - nearestX;
        const dy = p.y - nearestY;

        if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {

            // 横から当たった場合
            if (Math.abs(dx) > Math.abs(dy)) {

                if (dx > 0) {

                    p.x = wall.x + wall.w + PLAYER_RADIUS;

                } else {

                    p.x = wall.x - PLAYER_RADIUS;

                }

                p.vx *= -WALL_BOUNCE;

            }
            // 縦から当たった場合
            else {

                if (dy > 0) {

                    p.y = wall.y + wall.h + PLAYER_RADIUS;

                } else {

                    p.y = wall.y - PLAYER_RADIUS;

                }

                p.vy *= -WALL_BOUNCE;

            }

        }

    }

}
//========================
// Battle
//========================

const DAMAGE_SPEED = 8;
const DAMAGE_RATE = 2;

//========================

function damage(player, amount) {

    if (!player.alive) return;

    player.hp -= amount;

    if (player.hp <= 0) {

        player.hp = 0;
        player.alive = false;
        player.respawn = Date.now() + RESPAWN_TIME;

        player.vx = 0;
        player.vy = 0;

    }

}

//========================

function respawn(player) {

    const pos = randomSpawn();

    player.x = pos.x;
    player.y = pos.y;

    player.vx = 0;
    player.vy = 0;

    player.hp = PLAYER_HP;

    player.alive = true;

}

//========================

function updatePlayers() {

    const list = Object.values(players);

    //--------------------
    // 移動
    //--------------------

    for (const p of list) {

        updatePlayer(p);

    }

    //--------------------
    // 衝突
    //--------------------

    for (let i = 0; i < list.length; i++) {

        for (let j = i + 1; j < list.length; j++) {

            const a = list[i];
            const b = list[j];

            if (!a.alive || !b.alive) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;

            const dist = Math.hypot(dx, dy);

            const min = PLAYER_RADIUS * 2;

            if (dist === 0 || dist >= min) continue;
            
            const nx = dx / dist;
            const ny = dy / dist;
            
            // めり込み補正
            const overlap = min - dist;
            
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            //----------------
            // ダメージ
            //----------------
            const speedA = Math.hypot(a.vx, a.vy);
            const speedB = Math.hypot(b.vx, b.vy);
            
            if (speedA > speedB && speedA > DAMAGE_SPEED) {
                const dmg = Math.floor((speedA - DAMAGE_SPEED) * DAMAGE_RATE);
                damage(b, dmg);
            } else if (speedB > speedA && speedB > DAMAGE_SPEED) {
                
                const dmg = Math.floor((speedB - DAMAGE_SPEED) * DAMAGE_RATE);
                damage(a, dmg);
            
            }

        }

    }

    //--------------------
    // リスポーン
    //--------------------

    const now = Date.now();

    for (const p of list) {

        if (!p.alive && now >= p.respawn) {

            respawn(p);

        }

    }

}

//========================
// Game Loop
//========================

setInterval(() => {

    updatePlayers();

    io.emit("state", {

        players: Object.values(players)

    });

}, TICK);