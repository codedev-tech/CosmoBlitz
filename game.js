const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const homeScreen = document.getElementById('home-screen');
const startBtn = document.getElementById('start-btn');
const hud = document.getElementById('hud');
const hiScoreElement = document.getElementById('hi-score-val');

// HTML Game Over Elements
const gameOverScreen = document.getElementById('game-over-screen');
const tryAgainBtn = document.getElementById('try-again-btn');
const backMenuBtn = document.getElementById('back-to-menu-btn');
const finalScoreVal = document.getElementById('final-score-val');

// Sound toggle button
const soundToggleBtn = document.getElementById('sound-toggle-btn');
let soundMuted = false; // Start unmuted; actual playback is unlocked on first user gesture

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gameStars = [];
const GAME_STAR_COUNT = 160;

function seedGameStar() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.2,
        // Menu uses normalized speed * canvas.height ≈ 0.03–0.10 px/frame
        speed: (Math.random() * 0.0001 + 0.00004) * canvas.height,
        drift: 0,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.018 + 0.004,
        alpha: Math.random() * 0.7 + 0.3
    };
}

function initGameStars() {
    gameStars.length = 0;
    for (let i = 0; i < GAME_STAR_COUNT; i++) {
        gameStars.push(seedGameStar());
    }
}

function drawGameBackground(deltaTime) {
    // Same dark base as menu screen
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Twinkling stars — same logic as index.html starfield canvas
    ctx.save();
    for (const star of gameStars) {
        star.y += star.speed;
        star.x += star.drift;
        star.twinkle += star.twinkleSpeed;

        if (star.y > canvas.height + 4) {
            star.y = -4;
            star.x = Math.random() * canvas.width;
        }
        if (star.x < -4) star.x = canvas.width + 4;
        if (star.x > canvas.width + 4) star.x = -4;

        // Twinkle alpha — matches menu starfield feel
        const alpha = Math.max(0.1, Math.min(1.0,
            star.alpha * (0.6 + 0.4 * Math.sin(star.twinkle))
        ));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fill();
    }
    ctx.restore();
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initGameStars();
});

initGameStars();

// --- IMAGE PRELOAD ---
const images = {};
const imageUrls = {
    playerShip1: 'assets/images/destroyer/shipforphase1-3.png',
    playerShip2: 'assets/images/destroyer/shipforphase4.png',
    playerShip3: 'assets/images/destroyer/shipforphase5.png',
    playerShipFinal: 'assets/images/destroyer/shipforboss.png',
    alienPhase1: 'assets/images/alien/alieanminphase1.png',
    alienPhase2: 'assets/images/alien/alienminiphase2.png',
    alienPhase3: 'assets/images/alien/alienminiphase3.png',
    alienPhase4: 'assets/images/alien/alienminiphase4.png',
    alienPhase5: 'assets/images/alien/alienminiphase5.png',
    bossPhase5: 'assets/images/alien/Phase5FinalBoss.png',
    bossAlien: 'assets/images/alien/finalboss.png',
    bullet: 'assets/images/destroyerbullet/bullet.png',
    laser: 'assets/images/destroyerbullet/lacer (1).png',
    bg: 'assets/images/galaxi-bg.png'
};

function preloadImages() {
    for (let key in imageUrls) {
        const img = new Image();
        img.src = imageUrls[key];
        images[key] = img;
    }
}
preloadImages();

// --- AUDIO PRELOAD ---
const sounds = {};
const soundUrls = {
    bgMusic: 'assets/sounds/bg-music.wav',
    bulletShoot: [
        'assets/sounds/bullet-soundeffect/SHOOT013.wav',
        'assets/sounds/bullet-soundeffect/SHOOT014.wav',
        'assets/sounds/bullet-soundeffect/SHOOT015.wav',
        'assets/sounds/bullet-soundeffect/SHOOT016.wav',
        'assets/sounds/bullet-soundeffect/SHOOT017.wav',
        'assets/sounds/bullet-soundeffect/SHOOT018.wav'
    ],
    laserShoot: 'assets/sounds/bullet-soundeffect/lacer-soundeffect.wav',
    bossSound: 'assets/sounds/FinalBoss-Sound.wav'
};

let bgMusic = null;
let bossMusic = null;
let laserMusic = null;
let deathSound = null;
let phase5EntranceSound = null;
let finalBossEntranceSound = null;
let finalBossKilledSound = null;
let activeBossTrack = null;
let bulletSoundPool = [];
let bulletSoundIndex = 0;
let audioInitialized = false;
let endGameTimeoutId = null;
let pendingFinalVictorySound = false;
let currentTimeScale = 1;

function primeAudio(audio) {
    if (!audio) return Promise.resolve();
    audio.muted = false;
    audio.currentTime = 0;
    return audio.play()
        .then(() => {
            audio.pause();
            audio.currentTime = 0;
        })
        .catch(() => {});
}

function preloadAudio() {
    bgMusic = new Audio(soundUrls.bgMusic);
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    bgMusic.preload = 'auto';
    bgMusic.muted = true;

    bossMusic = new Audio(soundUrls.bossSound);
    bossMusic.loop = true;
    bossMusic.volume = 0.65;
    bossMusic.preload = 'auto';

    laserMusic = new Audio(soundUrls.laserShoot);
    laserMusic.preload = 'auto';
    laserMusic.volume = 0.6;

    // Additional boss/death sounds
    deathSound = new Audio('assets/sounds/deathb.wav');
    deathSound.preload = 'auto';
    deathSound.volume = 0.9;

    // Use one boss track for both Phase 5 and Final Boss
    phase5EntranceSound = new Audio('assets/sounds/FinalBoss-Sound.wav');
    phase5EntranceSound.preload = 'auto';
    phase5EntranceSound.volume = 0.9;
    phase5EntranceSound.loop = true;

    finalBossEntranceSound = new Audio('assets/sounds/FinalBoss-Sound.wav');
    finalBossEntranceSound.preload = 'auto';
    finalBossEntranceSound.volume = 0.9;
    finalBossEntranceSound.loop = true;

    finalBossKilledSound = new Audio('assets/sounds/soundafterkillingthefinalboss.wav');
    finalBossKilledSound.preload = 'auto';
    finalBossKilledSound.volume = 1.0;

    bulletSoundPool = soundUrls.bulletShoot.map((src) => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 0.4;
        return audio;
    });
}
preloadAudio();

function initAudio() {
    if (audioInitialized) return;
    audioInitialized = true;
    primeAudio(bgMusic);
    primeAudio(bossMusic);
    primeAudio(laserMusic);
    primeAudio(deathSound);
    primeAudio(phase5EntranceSound);
    primeAudio(finalBossEntranceSound);
    primeAudio(finalBossKilledSound);
    // prime all bullet sounds to avoid first-play delay
    bulletSoundPool.forEach(a => {
        try { primeAudio(a); a.load(); } catch(e) {}
    });
}

function startBackgroundMusic() {
    if (!bgMusic) return;
    if (!audioInitialized) initAudio();
    try {
        // Respect the soundMuted flag
        if (soundMuted) {
            bgMusic.muted = true;
            bgMusic.pause();
            return;
        }
        
        bgMusic.muted = false;
        bgMusic.volume = 0.5;
        if (bgMusic.readyState === 0) bgMusic.load();
        bgMusic.currentTime = 0;
        const p = bgMusic.play();
        if (p && typeof p.catch === 'function') {
            p.catch(e => { 
                console.log('Background music play failed:', e);
                // Only show overlay if NotAllowedError (autoplay policy)
                if (e.name === 'NotAllowedError') {
                    showEnableSoundOverlay();
                }
            });
        }
    } catch (e) { console.log('startBackgroundMusic error', e); }
}

// If autoplay is blocked, show a user gesture overlay to enable sound
function showEnableSoundOverlay() {
    if (document.getElementById('enable-sound-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'enable-sound-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = 9999;
    overlay.innerHTML = '<div style="text-align:center;color:#fff;font-family:Arial,sans-serif;"><h2 style="margin:0 0 12px 0">Enable Sound</h2><p style="margin:0 0 18px 0">Tap anywhere to enable audio for the game.</p><button id="enable-sound-btn" style="padding:10px 18px;font-size:16px;border-radius:6px;border:none;background:#0ff;color:#000;cursor:pointer">Enable Sound</button></div>';
    overlay.addEventListener('click', () => {
        try { initAudio(); startBackgroundMusic(); } catch(e) { console.log('enable sound error', e); }
        overlay.remove();
    });
    document.body.appendChild(overlay);
}

// Sound toggle function - called directly from user gesture
function toggleSound() {
    soundMuted = !soundMuted;
    
    // Update button UI
    if (soundToggleBtn) {
        soundToggleBtn.textContent = soundMuted ? '🔇' : '🔊';
        if (soundMuted) {
            soundToggleBtn.classList.add('muted');
        } else {
            soundToggleBtn.classList.remove('muted');
        }
    }
    
    // Pause all audio when muting
    if (soundMuted) {
        if (bgMusic) { bgMusic.muted = true; bgMusic.pause(); }
        if (bossMusic) { bossMusic.muted = true; bossMusic.pause(); }
        if (laserMusic) { laserMusic.muted = true; laserMusic.pause(); }
        if (deathSound) { deathSound.muted = true; deathSound.pause(); }
        if (phase5EntranceSound) { phase5EntranceSound.muted = true; phase5EntranceSound.pause(); }
        if (finalBossEntranceSound) { finalBossEntranceSound.muted = true; finalBossEntranceSound.pause(); }
        if (finalBossKilledSound) { finalBossKilledSound.muted = true; finalBossKilledSound.pause(); }
        bulletSoundPool.forEach(a => { a.muted = true; a.pause(); });
    } else {
        // Unmuting: prepare audio objects and try to play BG music
        if (!audioInitialized) {
            initAudio();
        }
        
        // Unmute all audio objects
        if (bgMusic) bgMusic.muted = false;
        if (bossMusic) bossMusic.muted = false;
        if (laserMusic) laserMusic.muted = false;
        if (deathSound) deathSound.muted = false;
        // Only unmute boss sounds if actively in a boss phase — not when returning to menu
        if (typeof gameState !== 'undefined' && gameState !== "MENU") {
            if (phase5EntranceSound) phase5EntranceSound.muted = false;
            if (finalBossEntranceSound) finalBossEntranceSound.muted = false;
            if (finalBossKilledSound) finalBossKilledSound.muted = false;
        }
        bulletSoundPool.forEach(a => a.muted = false);
        
        // Try to play background music if in menu (check if gameState is defined)
        if (typeof gameState !== 'undefined' && gameState === "MENU" && bgMusic) {
            bgMusic.volume = 0.5;
            bgMusic.currentTime = 0;
            const p = bgMusic.play();
            if (p && p.catch) p.catch(e => console.log('BG music play on unmute:', e.message));
        }
    }
}

// Initialize sound toggle button - will be done after game variables are declared
// (moved to bottom of file to avoid ReferenceError)

// --- GAME VARIABLES ---
let gameState = "MENU";
let score = 0;
let phase = 1;
let playerHP = 5;
let player = { x: canvas.width / 2 - 50, y: canvas.height - 170, w: 72, h: 108 };
let enemies = [];
let bullets = [];
let alienBullets = [];
let bossBullets = [];
let lastShot = 0;
let lastFrameTime = 0;
let boss = null;
let boss2 = null;
let bossThemePlaying = false;
let messageText = "";
let messageTimer = 0;
let laserKills = 0;
let upgradeKills = 0;
let laserMode = false;
let laserDuration = 0;
let upgradeActive = false;
let upgradeUsed = false;
let upgradeFlashTimer = 0; // drives ship shadow burst animation on upgrade click
let formationWaveIndex = 0;
let bossPending = false;
let waveActive = false;
let finalBossDefeated = false;
let phase5BossDefeated = false;
let finalBossPhase = false;
let bossLastShot = 0;

let highScore = localStorage.getItem('galaxiHighScore') || 0;
if(hiScoreElement) hiScoreElement.innerText = highScore;

// --- UTILS ---
function showMessage(text, duration = 120) {
    messageText = text;
    messageTimer = duration; 
}

function resetGame() {
    phase = 1;
    score = 0;
    playerHP = 5;
    enemies = [];
    bullets = [];
    alienBullets = [];
    bossBullets = [];
    boss = null;
    boss2 = null;
    bossThemePlaying = false;
    laserKills = 0;
    upgradeKills = 0;
    laserMode = false;
    laserDuration = 0;
    upgradeActive = false;
    upgradeUsed = false;
    upgradeFlashTimer = 0;
    window.companionSlideY = undefined;
    lastFrameTime = 0;
    formationWaveIndex = 0;
    bossPending = false;
    waveActive = false;
    finalBossDefeated = false;
    phase5BossDefeated = false;
    finalBossPhase = false;
    pendingFinalVictorySound = false;
    stopBossAudio();
    if (endGameTimeoutId) { clearTimeout(endGameTimeoutId); endGameTimeoutId = null; }
    gameState = "PLAYING";
    
    // Start background music for a fresh run
    startBackgroundMusic();
    
    // UI Updates
    gameOverScreen.style.display = 'none';
    const titleEl = document.querySelector('.game-over-title');
    if (titleEl) titleEl.textContent = 'GAME OVER';
    homeScreen.style.display = 'none';
    hud.style.display = 'flex';
    
    if(document.getElementById('phase')) document.getElementById('phase').innerText = phase;
    if(document.getElementById('score')) document.getElementById('score').innerText = score;
    showMessage("PHASE 1");
}

function endGame() {
    gameState = "GAMEOVER";
    if (endGameTimeoutId) { clearTimeout(endGameTimeoutId); endGameTimeoutId = null; }
    stopBossAudio();
    pendingFinalVictorySound = false;
    if (document.querySelector('.game-over-title')?.textContent !== 'VICTORY!') {
        const titleEl = document.querySelector('.game-over-title');
        if (titleEl) titleEl.textContent = 'GAME OVER';
    }
    
    //  HTML Game Over Overlay
    gameOverScreen.style.display = 'flex';
    finalScoreVal.innerText = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('galaxiHighScore', highScore);
        if(hiScoreElement) hiScoreElement.innerText = highScore;
    }
}

// --- DRAWING FUNCTIONS ---

function drawPlayer(x, y, w, h) {
    let img;
    let rotateToVertical = false;
    if (phase < 4) {
        img = images.playerShip1;
        rotateToVertical = true;
    } else if (phase === 4) {
        img = images.playerShip2;
        rotateToVertical = true;
    } else if (phase === 5) {
        img = images.playerShip3;
    } else {
        img = images.playerShipFinal;
    }
    if (img && img.complete) {
        ctx.save();

        // Upgrade flash: pulsing cyan/white shadow burst fading over time
        if (upgradeFlashTimer > 0) {
            upgradeFlashTimer--;
            const progress = upgradeFlashTimer / 120; // 1→0
            // Fast pulse on top of the fade
            const pulse = 0.5 + 0.5 * Math.sin(upgradeFlashTimer * 0.45);
            const blurSize = 18 + 30 * progress * pulse;
            const alpha = progress * pulse;

            // Layered glow: cyan outer, white inner
            ctx.shadowColor = `rgba(0, 247, 255, ${alpha})`;
            ctx.shadowBlur  = blurSize;
            // Draw extra ghost layers for intensity
            for (let i = 0; i < 3; i++) {
                if (rotateToVertical) {
                    ctx.translate(x + w / 2, y + h / 2);
                    ctx.rotate(Math.PI / 2);
                    ctx.drawImage(img, -h / 2, -w / 2, h, w);
                    ctx.rotate(-Math.PI / 2);
                    ctx.translate(-(x + w / 2), -(y + h / 2));
                } else {
                    ctx.drawImage(img, x, y, w, h);
                }
            }

            // White hot core flash on first 30 frames
            if (upgradeFlashTimer > 90) {
                ctx.shadowColor = `rgba(255, 255, 255, ${alpha * 1.5})`;
                ctx.shadowBlur  = blurSize * 0.5;
            }
        }

        // Draw actual ship
        if (rotateToVertical) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -h / 2, -w / 2, h, w);
        } else {
            ctx.drawImage(img, x, y, w, h);
        }

        ctx.restore();
    }
}

function drawUpgradeCompanions() {
    if (!upgradeActive) return;
    // Phase 5 companions = phase4 ship (needs rotation), final boss phase = phase5 ship (no rotation)
    const img = finalBossPhase ? images.playerShip3 : images.playerShip2;
    if (!img || !img.complete) return;

    const companionW = 42;
    const companionH = 64;

    // Slide-in animation: companions enter from bottom of screen
    if (typeof window.companionSlideY === 'undefined') {
        window.companionSlideY = canvas.height + 80; // start below screen
    }
    const targetY = player.y + 16;
    // Smoothly ease toward target position
    if (window.companionSlideY > targetY) {
        window.companionSlideY += (targetY - window.companionSlideY) * 0.1 * currentTimeScale;
        if (window.companionSlideY < targetY) window.companionSlideY = targetY;
    } else {
        window.companionSlideY = targetY;
    }
    const y = window.companionSlideY;

    const leftX  = player.x - companionW - 8;
    const rightX = player.x + player.w + 8;

    // Store companion positions globally for bullet spawning
    window.companionLeft  = { x: leftX,  y: y, w: companionW, h: companionH };
    window.companionRight = { x: rightX, y: y, w: companionW, h: companionH };

    if (finalBossPhase) {
        // playerShip3 sprite is already upright — draw normally
        ctx.drawImage(img, leftX,  y, companionW, companionH);
        ctx.drawImage(img, rightX, y, companionW, companionH);
    } else {
        // playerShip2 sprite is horizontal — rotate -90° so it faces up
        ctx.save();
        ctx.translate(leftX + companionW / 2, y + companionH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, -companionH / 2, -companionW / 2, companionH, companionW);
        ctx.restore();

        ctx.save();
        ctx.translate(rightX + companionW / 2, y + companionH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, -companionH / 2, -companionW / 2, companionH, companionW);
        ctx.restore();
    }
}

function resolveBulletClashes() {
    // Player bullets vs alien bullets — both removed on contact
    for (let i = bullets.length - 1; i >= 0; i--) {
        const pb = bullets[i];
        let collided = false;

        for (let j = alienBullets.length - 1; j >= 0; j--) {
            const ab = alienBullets[j];
            if (pb.x < ab.x + ab.w && pb.x + pb.w > ab.x && pb.y < ab.y + ab.h && pb.y + pb.h > ab.y) {
                bullets.splice(i, 1);
                alienBullets.splice(j, 1);
                collided = true;
                break;
            }
        }
        if (collided) continue;

        // Player bullets vs boss bullets — both removed on contact
        for (let k = bossBullets.length - 1; k >= 0; k--) {
            const bb = bossBullets[k];
            if (pb.x < bb.x + bb.w && pb.x + pb.w > bb.x && pb.y < bb.y + bb.h && pb.y + pb.h > bb.y) {
                bullets.splice(i, 1);
                bossBullets.splice(k, 1);
                collided = true;
                break;
            }
        }
    }
}

function drawPlayerHP() {
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#00ff00";
    ctx.fillText("HP: " + Math.max(0, playerHP), 20, 50);
    
    // Draw HP bar
    const barW = 100;
    const barH = 20;
    const barX = 20;
    const barY = 60;
    const maxHP = 5;
    
    // Background
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, barH);
    
    // HP fill
    ctx.fillStyle = playerHP > 2 ? "#00ff00" : playerHP > 0 ? "#ffaa00" : "#ff0000";
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (playerHP / maxHP), barH - 4);
    
    // Border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
    
    ctx.restore();
}

function drawMinion(x, y, w, h, phase) {
    let img;
    switch(phase) {
        case 1: img = images.alienPhase1; break;
        case 2: img = images.alienPhase2; break;
        case 3: img = images.alienPhase3; break;
        case 4: img = images.alienPhase4; break;
        case 5: img = images.alienPhase5; break;
        default: img = images.alienPhase1;
    }
    if (img && img.complete) {
        ctx.drawImage(img, x, y, w, h);
    }
}

function drawBoss(x, y, w, h, bossType = 'final') {
    let img;
    if (bossType === 'phase5') {
        img = images.bossPhase5;
    } else {
        img = images.bossAlien;
    }
    if (img && img.complete) {
        ctx.drawImage(img, x, y, w, h);
    }
}

function getFormationPattern() {
    const patterns = ["v", "triangle", "v", "triangle", "wide-v"];
    return patterns[formationWaveIndex % patterns.length];
}

function createFormationWave() {
    const pattern = getFormationPattern();
    formationWaveIndex++;

    const centerX = canvas.width / 2;
    const startY = 70;
    const enemySize = phase >= 5 ? 70 : 40;
    const speed = 1.4 + (phase * 0.35);
    const formation = [];

    if (pattern === "triangle") {
        formation.push(
            { dx: 0, dy: 0 },
            { dx: -70, dy: 70 },
            { dx: 70, dy: 70 },
            { dx: -140, dy: 140 },
            { dx: 0, dy: 140 },
            { dx: 140, dy: 140 }
        );
    } else if (pattern === "wide-v") {
        formation.push(
            { dx: 0, dy: 0 },
            { dx: -90, dy: 70 },
            { dx: 90, dy: 70 },
            { dx: -180, dy: 140 },
            { dx: 180, dy: 140 },
            { dx: -270, dy: 210 },
            { dx: 270, dy: 210 }
        );
    } else {
        formation.push(
            { dx: 0, dy: 0 },
            { dx: -60, dy: 60 },
            { dx: 60, dy: 60 },
            { dx: -120, dy: 120 },
            { dx: 120, dy: 120 }
        );
    }

    formation.forEach((slot, index) => {
        const targetX = centerX + slot.dx - enemySize / 2;
        const targetY = startY + slot.dy;
        const entryX = index === 0 ? centerX - enemySize / 2 : (targetX < centerX ? -enemySize * 2 : canvas.width + enemySize * 2);
        const entryY = index === 0 ? -enemySize * 2 : (targetY < canvas.height / 3 ? -enemySize * 2 : targetY);

        enemies.push({
            x: entryX,
            y: entryY,
            w: enemySize,
            h: enemySize,
            phase: phase,
            hp: 1 + Math.floor((phase - 1) * 1.5),
            speed,
            targetX,
            targetY,
            formed: false,
            formationSpeed: speed,
            formationPattern: pattern
        });
    });

    // Add additional filler enemies for higher phases to increase difficulty
    const extraCount = Math.max(0, phase - 2);
    for (let i = 0; i < extraCount; i++) {
        const ex = Math.random() * (canvas.width - enemySize);
        enemies.push({ x: ex, y: -enemySize * 2 - (i * 20), w: enemySize, h: enemySize, phase: phase, hp: 1 + Math.floor((phase - 1) * 1.5), speed, targetX: ex, targetY: 80 + i * 20, formed: false, formationSpeed: speed });
    }
}

function playBulletSound() {
    if (soundMuted || !bulletSoundPool.length) return;
    const audio = bulletSoundPool[bulletSoundIndex];
    bulletSoundIndex = (bulletSoundIndex + 1) % bulletSoundPool.length;
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Bullet sound failed:', e));
}

function playLaserSound() {
    if (soundMuted || !laserMusic) return;
    laserMusic.currentTime = 0;
    laserMusic.play().catch(e => console.log('Laser sound failed:', e));
}

function playFinalVictorySound() {
    if (soundMuted || !finalBossKilledSound) return;
    finalBossKilledSound.pause();
    finalBossKilledSound.muted = false;
    if (finalBossKilledSound.readyState === 0) finalBossKilledSound.load();
    finalBossKilledSound.currentTime = 0;
    finalBossKilledSound.play()
        .then(() => {
            pendingFinalVictorySound = false;
        })
        .catch((e) => {
            console.log('final kill sound failed:', e);
            pendingFinalVictorySound = true;
        });
}

function playBossTheme(forceRestart = false) {
    if (soundMuted || !boss) return;
    if (bgMusic) bgMusic.pause();

    // Same boss soundtrack for Phase 5 and Final Boss — keep it continuous
    const track = finalBossEntranceSound;
    if (!track) return;

    // If already playing this track, just let it continue — don't restart
    if (!track.paused && activeBossTrack === track) {
        bossThemePlaying = true;
        return;
    }

    activeBossTrack = track;
    track.muted = false;
    if (track.readyState === 0) track.load();
    // Only reset to beginning if forced (e.g. fresh game start) or never played before
    if (forceRestart || track.currentTime === 0) {
        track.currentTime = 0;
    }
    track.play()
        .then(() => {
            bossThemePlaying = true;
        })
        .catch(e => {
            console.log('Boss sound failed:', e);
            bossThemePlaying = false;
            if (!soundMuted) startBackgroundMusic();
        });
}

// --- LOGIC ---

function checkCollisions() {
    bullets.forEach((b, bIdx) => {
        enemies.forEach((e, eIdx) => {
            if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                    // apply HP to enemies so tougher phases take longer
                    if (typeof e.hp === 'undefined') e.hp = 1;
                        const damage = b.isLaser ? 2 : 1;
                    e.hp -= damage;
                    bullets.splice(bIdx, 1);
                    playBulletSound();
                    if (e.hp <= 0) {
                        enemies.splice(eIdx, 1);
                        score += 100;
                        laserKills++;
                        if (!upgradeUsed) upgradeKills++;
                        // Laser should only be triggered manually by clicking the charge circle.
                        // Do not auto-activate laser here.
                    }
            }
        });
        if (boss && b.x < boss.x + boss.w && b.x + b.w > boss.x && b.y < boss.y + boss.h && b.y + b.h > boss.y) {
            const damageToBoss = b.isLaser ? 5 : 1;
            boss.hp -= damageToBoss;
            bullets.splice(bIdx, 1);
            if (boss.hp <= 0) {
                if (finalBossPhase) {
                    // Final boss defeated — need boss2 dead too for full victory
                    boss = null;
                    score += 10000;
                    bossPending = false;
                    if (!boss2) {
                        // Both bosses dead — VICTORY
                        stopBossAudio();
                        finalBossDefeated = true;
                        enemies = [];
                        bossBullets = [];
                        if (!soundMuted && deathSound) {
                            deathSound.currentTime = 0;
                            deathSound.play().catch(e => console.log('death sound failed:', e));
                        }
                        setTimeout(() => { playFinalVictorySound(); }, 140);
                        const titleEl = document.querySelector('.game-over-title');
                        if (titleEl) titleEl.textContent = 'VICTORY!';
                        endGame();
                    } else {
                        showMessage("FINISH THE PHASE 5 BOSS!", 120);
                    }
                } else {
                    // Phase 5 boss defeated - prepare for final boss
                    boss = null;
                    score += 5000;
                    bossPending = false;
                    stopBossAudio();
                    phase5BossDefeated = true;
                    // Clear remaining phase-5 enemies/escorts to avoid soft-lock state,
                    // then transition straight to final boss.
                    enemies = [];
                    bossBullets = [];
                    finalBossPhase = true;
                    phase = 6;
                    bossPending = true;
                    if (!soundMuted && deathSound) {
                        deathSound.currentTime = 0;
                        deathSound.play().catch(e => console.log('death sound failed:', e));
                    }
                    showMessage("FINAL BOSS!", 120);
                }
            } else {
                // brief visual feedback for boss hit
                showMessage("Boss HP: " + boss.hp, 60);
            }
        }

        // Bullets vs boss2
        if (boss2 && b.x < boss2.x + boss2.w && b.x + b.w > boss2.x && b.y < boss2.y + boss2.h && b.y + b.h > boss2.y) {
            const dmg = b.isLaser ? 5 : 1;
            boss2.hp -= dmg;
            bullets.splice(bIdx, 1);
            if (boss2.hp <= 0) {
                boss2 = null;
                score += 3000;
                if (finalBossPhase && !boss) {
                    // Main boss already dead — VICTORY
                    stopBossAudio();
                    finalBossDefeated = true;
                    enemies = [];
                    bossBullets = [];
                    if (!soundMuted && deathSound) {
                        deathSound.currentTime = 0;
                        deathSound.play().catch(e => console.log('death sound failed:', e));
                    }
                    setTimeout(() => { playFinalVictorySound(); }, 140);
                    const titleEl = document.querySelector('.game-over-title');
                    if (titleEl) titleEl.textContent = 'VICTORY!';
                    endGame();
                } else {
                    showMessage("PHASE 5 BOSS DOWN!", 90);
                }
            } else {
                showMessage("Boss2 HP: " + boss2.hp, 40);
            }
        }
    });
}

function updateFormationEnemy(enemy) {
    if (!enemy.formed) {
        const f = 0.08 * currentTimeScale;
        enemy.x += (enemy.targetX - enemy.x) * f;
        enemy.y += (enemy.targetY - enemy.y) * f;

        if (Math.abs(enemy.x - enemy.targetX) < 1 && Math.abs(enemy.y - enemy.targetY) < 1) {
            enemy.x = enemy.targetX;
            enemy.y = enemy.targetY;
            enemy.formed = true;
        }
        return;
    }

    // Keep enemies in formation (don't descend off-screen).
    // They sway horizontally so phase enemies remain visible and active.
    if (typeof enemy.baseX === 'undefined') enemy.baseX = enemy.targetX;
    if (typeof enemy.baseY === 'undefined') enemy.baseY = enemy.targetY;
    if (typeof enemy.swayOffset === 'undefined') enemy.swayOffset = Math.random() * Math.PI * 2;

    enemy.swayOffset += 0.035 * currentTimeScale;
    enemy.targetX = enemy.baseX + Math.sin(enemy.swayOffset) * 18;
    enemy.targetY = enemy.baseY;

    const f2 = 0.1 * currentTimeScale;
    enemy.x += (enemy.targetX - enemy.x) * f2;
    enemy.y += (enemy.targetY - enemy.y) * f2;
}

// Escort behavior: follow the boss at fixed offsets
function createBossWithEscorts() {
    if (!boss) return;

    if (finalBossPhase) {
        // Final boss phase: phase5 boss appears as second independent boss (boss2)
        boss2 = {
            x: boss.x - 240,
            y: -200,
            w: 180, h: 110,
            hp: 120,
            bossType: 'phase5',
            vx: -1.3, vy: 1.0,
            moveTimer: 0,
            lastShot: 0
        };

        // Mini alien escorts flanking both bosses
        const escortOffsets = [-80, 80, -180, 180];
        escortOffsets.forEach(ox => {
            enemies.push({
                x: boss.x + boss.w / 2 + ox - 25,
                y: -100,
                w: 50, h: 50,
                phase: 5,
                hp: 6,
                escort: true,
                bossRef: boss,
                offsetX: ox,
                offsetY: 110,
                formed: false
            });
        });
    } else {
        // Phase 5 boss: spawn phase 5 aliens as escorts
        const offsets = [-140, -70, 0, 70, 140];
        const enemySize = 60;
        offsets.forEach(ox => {
            enemies.push({
                x: boss.x + boss.w / 2 + ox - enemySize / 2,
                y: boss.y - 200,
                w: enemySize, h: enemySize,
                phase: 5,
                hp: 3 + Math.floor(5 / 1.5),
                escort: true,
                bossRef: boss,
                offsetX: ox,
                offsetY: 80,
                formed: false
            });
        });
    }
}

function updateEscortEnemy(enemy) {
    if (!boss) {
        enemy.escort = false;
        return;
    }
    const targetX = boss.x + boss.w / 2 + (enemy.offsetX || 0) - enemy.w / 2;
    const targetY = boss.y + (enemy.offsetY || 60);
    enemy.x += (targetX - enemy.x) * 0.12;
    enemy.y += (targetY - enemy.y) * 0.08;
}

// Draw laser charge circle on the right side
function drawLaserChargeCircle() {
    const circleRadius = 45;
    const circleCenterX = canvas.width - 70;
    const circleCenterY = canvas.height - 100;
    const requiredKills = 10;
    const chargePercent = Math.min(laserKills / requiredKills, 1); // 0 to 1, stays at 1 after reaching requiredKills
    const isFull = chargePercent >= 1;
    
    // Draw background circle
    ctx.save();
    ctx.strokeStyle = isFull ? '#00ff00' : '#00f7ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw filled arc (charge)
    ctx.fillStyle = isFull ? 'rgba(0, 255, 0, 0.3)' : 'rgba(0, 247, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(circleCenterX, circleCenterY);
    ctx.arc(circleCenterX, circleCenterY, circleRadius, -Math.PI / 2, -Math.PI / 2 + chargePercent * Math.PI * 2);
    ctx.lineTo(circleCenterX, circleCenterY);
    ctx.fill();
    
    // Draw percentage text
    ctx.fillStyle = isFull ? '#00ff00' : '#00f7ff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(chargePercent * 100) + '%', circleCenterX, circleCenterY);
    
    // Draw "LASER" label if full
    if (isFull) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('CLICK', circleCenterX, circleCenterY + 20);
    }
    
    ctx.restore();
    
    // Store circle position for click detection
    window.laserCirclePos = { x: circleCenterX, y: circleCenterY, radius: circleRadius };
}

function drawUpgradeChargeCircle() {
    const circleRadius = 45;
    const circleCenterX = canvas.width - 70;
    const circleCenterY = canvas.height - 220;
    const requiredKills = 15;
    const chargePercent = Math.min(upgradeKills / requiredKills, 1);
    const isFull = chargePercent >= 1;
    const isActive = upgradeActive;

    ctx.save();
    ctx.strokeStyle = isActive ? '#00ff00' : (isFull ? '#00ff00' : '#7dff00');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isActive ? 'rgba(0, 255, 0, 0.25)' : (isFull ? 'rgba(0, 255, 0, 0.3)' : 'rgba(125, 255, 0, 0.18)');
    ctx.beginPath();
    ctx.moveTo(circleCenterX, circleCenterY);
    ctx.arc(circleCenterX, circleCenterY, circleRadius, -Math.PI / 2, -Math.PI / 2 + chargePercent * Math.PI * 2);
    ctx.lineTo(circleCenterX, circleCenterY);
    ctx.fill();

    ctx.fillStyle = isActive ? '#00ff00' : (isFull ? '#00ff00' : '#7dff00');
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isActive ? 'ON' : Math.floor(chargePercent * 100) + '%', circleCenterX, circleCenterY);

    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(isActive ? 'UPGRADED' : (isFull ? 'CLICK' : 'UPGRADE'), circleCenterX, circleCenterY + 20);

    // Label above circle
    if (!isActive && !upgradeUsed) {
        ctx.fillStyle = 'rgba(125,255,0,0.85)';
        ctx.font = 'bold 9px Arial';
        ctx.fillText('15 KILLS', circleCenterX, circleCenterY - circleRadius - 6);
    }

    ctx.restore();

    window.upgradeCirclePos = { x: circleCenterX, y: circleCenterY, radius: circleRadius };
}

function animate(time = 0) {
    if (gameState === "MENU") return;
    if (gameState === "GAMEOVER") return; 
    let deltaTime = lastFrameTime ? (time - lastFrameTime) : 16;
    lastFrameTime = time;
    const timeScale = Math.max(0.5, Math.min(4, deltaTime / 16.6667));
    currentTimeScale = timeScale;

    // Draw animated starfield background
    drawGameBackground(deltaTime);

    // Handle laser mode countdown
    if (laserMode) {
        laserDuration -= deltaTime;
        if (laserDuration <= 0) {
            laserMode = false;
        }
    }

    // Shooting logic
    if (time - lastShot > 250) {
        // Main ship bullets
        let bulletCount = laserMode ? 1 : Math.min(phase, 5);
        let spread = 15;
        let startX = player.x + player.w / 2 - ((bulletCount - 1) * spread) / 2;
        for (let i = 0; i < bulletCount; i++) {
            bullets.push({ x: startX + (i * spread) - 2, y: player.y, w: laserMode ? 20 : 10, h: laserMode ? 30 : 18, isLaser: laserMode, vy: -10 });
        }

        // Companion ship bullets - each fires from their own nose
        if (upgradeActive) {
            if (window.companionLeft) {
                const cl = window.companionLeft;
                bullets.push({ x: cl.x + cl.w / 2 - (laserMode ? 10 : 5), y: cl.y, w: laserMode ? 20 : 10, h: laserMode ? 30 : 18, isLaser: laserMode, vy: -10 });
            }
            if (window.companionRight) {
                const cr = window.companionRight;
                bullets.push({ x: cr.x + cr.w / 2 - (laserMode ? 10 : 5), y: cr.y, w: laserMode ? 20 : 10, h: laserMode ? 30 : 18, isLaser: laserMode, vy: -10 });
            }
        }

        lastShot = time;
    }

    // Draw bullets
    bullets.forEach((b, i) => {
        // bullets now include a `vy` in pixels-per-60fps; scale by timeScale
        const vy = (typeof b.vy !== 'undefined') ? b.vy : -10;
        b.y += vy * timeScale;
        let bulletImg = b.isLaser ? images.laser : images.bullet;
        if (bulletImg && bulletImg.complete) {
            ctx.drawImage(bulletImg, b.x, b.y, b.w, b.h);
        } else {
            ctx.fillStyle = b.isLaser ? "#ffff00" : "#fff";
            ctx.fillRect(b.x, b.y, b.w, b.h);
        }
        if (b.y < -40 || b.y > canvas.height + 40) bullets.splice(i, 1);
    });

    drawPlayer(player.x, player.y, player.w, player.h);
    drawUpgradeCompanions();
    drawPlayerHP();

    // Draw enemies
    enemies.forEach((e, i) => {
        if (e.escort) updateEscortEnemy(e);
        else updateFormationEnemy(e);
        
        // Draw boss escort with boss sprite, regular escorts with alien sprite
        if (e.isBossEscort) {
            drawBoss(e.x, e.y, e.w, e.h, 'phase5');
        } else {
            drawMinion(e.x, e.y, e.w, e.h, e.phase);
        }
        
        // Alien shooting - enemies shoot at player every 1000-1500ms
        if (!e.lastAlienShot) e.lastAlienShot = 0;
        if (time - e.lastAlienShot > 1000 + Math.random() * 500) {
            const alienBulletSpeed = 3;
            const dx = player.x + player.w/2 - (e.x + e.w/2);
            const dy = player.y + player.h/2 - (e.y + e.h/2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            alienBullets.push({
                x: e.x + e.w/2,
                y: e.y + e.h/2,
                w: 8,
                h: 8,
                vx: Math.cos(angle) * alienBulletSpeed,
                vy: Math.sin(angle) * alienBulletSpeed
            });
            e.lastAlienShot = time;
        }
    });

    // Draw boss
    if (boss) {
        if (boss.y < 100) boss.y += 2 * timeScale;
        else {
            boss.moveTimer = (boss.moveTimer || 0) + deltaTime;
            if (boss.moveTimer >= 1500) {
                boss.vx = (Math.random() * 3.2) - 1.6;
                boss.vy = (Math.random() * 2.4) - 1.2;
                if (Math.abs(boss.vx) < 0.7) boss.vx = boss.vx < 0 ? -0.7 : 0.7;
                if (Math.abs(boss.vy) < 0.4) boss.vy = boss.vy < 0 ? -0.4 : 0.4;
                boss.moveTimer = 0;
            }
            boss.x += boss.vx * timeScale;
            boss.y += boss.vy * timeScale;
            if (boss.x < 0) { boss.x = 0; boss.vx *= -1; }
            if (boss.x > canvas.width - boss.w) { boss.x = canvas.width - boss.w; boss.vx *= -1; }
            if (boss.y < 60) { boss.y = 60; boss.vy = Math.abs(boss.vy); }
            if (boss.y > canvas.height * 0.38) { boss.y = canvas.height * 0.38; boss.vy = -Math.abs(boss.vy); }

            // Boss shooting
            if (!boss.lastShot) boss.lastShot = 0;
            if (time - boss.lastShot > 850 + Math.random() * 700) {
                const shotCount = 3;
                const spread = 0.28;
                const baseAngle = Math.atan2(
                    (player.y + player.h / 2) - (boss.y + boss.h / 2),
                    (player.x + player.w / 2) - (boss.x + boss.w / 2)
                );
                for (let i = 0; i < shotCount; i++) {
                    const angleOffset = (i - 1) * spread;
                    const speed = 4.6;
                    bossBullets.push({
                        x: boss.x + boss.w / 2,
                        y: boss.y + boss.h - 8,
                        w: 10,
                        h: 16,
                        vx: Math.cos(baseAngle + angleOffset) * speed,
                        vy: Math.sin(baseAngle + angleOffset) * speed,
                        source: 'boss'
                    });
                }
                boss.lastShot = time;
            }
        }
        drawBoss(boss.x, boss.y, boss.w, boss.h, boss.bossType || 'final');
        playBossTheme();
        // draw boss HP bar
        try {
            ctx.save();
            const barW = 220;
            const barH = 12;
            const barX = Math.max(10, boss.x + boss.w/2 - barW/2);
            const barY = boss.y - 20;
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barW, barH);
            const hpRatio = Math.max(0, (boss.hp || 0) / (150 + (phase * 80)));
            ctx.fillStyle = '#e22';
            ctx.fillRect(barX + 2, barY + 2, (barW - 4) * hpRatio, barH - 4);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS HP: ' + Math.max(0, boss.hp), barX + barW/2, barY + barH - 1);
            ctx.restore();
        } catch(e) { console.log('boss HP draw error', e); }
    }

    // Draw and update boss2 (phase5 boss alongside final boss)
    if (boss2) {
        if (boss2.y < 80) {
            boss2.y += 2 * timeScale;
        } else {
            boss2.moveTimer = (boss2.moveTimer || 0) + deltaTime;
            if (boss2.moveTimer >= 1666) {
                boss2.vx = (Math.random() * 2.8) - 1.4;
                boss2.vy = (Math.random() * 2.0) - 1.0;
                if (Math.abs(boss2.vx) < 0.5) boss2.vx = boss2.vx < 0 ? -0.5 : 0.5;
                if (Math.abs(boss2.vy) < 0.3) boss2.vy = boss2.vy < 0 ? -0.3 : 0.3;
                boss2.moveTimer = 0;
            }
            boss2.x += boss2.vx * timeScale;
            boss2.y += boss2.vy * timeScale;
            if (boss2.x < 0) { boss2.x = 0; boss2.vx *= -1; }
            if (boss2.x > canvas.width - boss2.w) { boss2.x = canvas.width - boss2.w; boss2.vx *= -1; }
            if (boss2.y < 60) { boss2.y = 60; boss2.vy = Math.abs(boss2.vy); }
            if (boss2.y > canvas.height * 0.38) { boss2.y = canvas.height * 0.38; boss2.vy = -Math.abs(boss2.vy); }

            // boss2 shoots at player
            if (!boss2.lastShot) boss2.lastShot = 0;
            if (time - boss2.lastShot > 1100 + Math.random() * 800) {
                const baseAngle = Math.atan2(
                    (player.y + player.h / 2) - (boss2.y + boss2.h / 2),
                    (player.x + player.w / 2) - (boss2.x + boss2.w / 2)
                );
                for (let i = 0; i < 2; i++) {
                    const angleOffset = (i - 0.5) * 0.25;
                    bossBullets.push({
                        x: boss2.x + boss2.w / 2,
                        y: boss2.y + boss2.h - 8,
                        w: 10, h: 16,
                        vx: Math.cos(baseAngle + angleOffset) * 4.0,
                        vy: Math.sin(baseAngle + angleOffset) * 4.0,
                        source: 'boss2'
                    });
                }
                boss2.lastShot = time;
            }
        }
        drawBoss(boss2.x, boss2.y, boss2.w, boss2.h, 'phase5');
        // boss2 HP bar
        try {
            ctx.save();
            const b2MaxHp = 120;
            const barW = 180, barH = 12;
            const barX = Math.max(10, boss2.x + boss2.w / 2 - barW / 2);
            const barY = boss2.y - 20;
            ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = '#e55';
            ctx.fillRect(barX + 2, barY + 2, (barW - 4) * Math.max(0, boss2.hp / b2MaxHp), barH - 4);
            ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.textAlign = 'center';
            ctx.fillText('BOSS HP: ' + Math.max(0, boss2.hp), barX + barW / 2, barY + barH - 1);
            ctx.restore();
        } catch(e) { console.log('boss2 HP draw error', e); }
    }

    // Draw and update alien bullets
    alienBullets.forEach((ab, i) => {
        ab.x += ab.vx * timeScale;
        ab.y += ab.vy * timeScale;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(ab.x, ab.y, ab.w, ab.h);
        
        // Remove bullets that go off-screen
        if (ab.x > canvas.width + 40 || ab.x < -40 || ab.y > canvas.height + 40 || ab.y < -40) {
            alienBullets.splice(i, 1);
        }
    });

    // Draw and update boss bullets
    bossBullets.forEach((bb, i) => {
        bb.x += bb.vx * timeScale;
        bb.y += bb.vy * timeScale;
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
        if (bb.x > canvas.width + 40 || bb.x < -40 || bb.y > canvas.height + 40 || bb.y < -40) {
            bossBullets.splice(i, 1);
        }
    });

    // Bullet vs bullet cancellation
    resolveBulletClashes();

    // Smaller effective hitbox so player does not die too quickly
    const hitboxPaddingX = player.w * 0.2;
    const hitboxPaddingY = player.h * 0.2;
    const hitbox = {
        x: player.x + hitboxPaddingX,
        y: player.y + hitboxPaddingY,
        w: player.w - hitboxPaddingX * 2,
        h: player.h - hitboxPaddingY * 2
    };

    // Check if remaining alien bullets hit player hitbox
    alienBullets.forEach((ab, i) => {
        if (ab.x < hitbox.x + hitbox.w && ab.x + ab.w > hitbox.x &&
            ab.y < hitbox.y + hitbox.h && ab.y + ab.h > hitbox.y) {
            alienBullets.splice(i, 1);
            playerHP--;
            if (playerHP <= 0) endGame();
        }
    });

    // Check if boss bullets hit player hitbox
    bossBullets.forEach((bb, i) => {
        if (bb.x < hitbox.x + hitbox.w && bb.x + bb.w > hitbox.x &&
            bb.y < hitbox.y + hitbox.h && bb.y + bb.h > hitbox.y) {
            bossBullets.splice(i, 1);
            playerHP -= 2;
            if (playerHP <= 0) endGame();
        }
    });

    // Draw message
    if (messageTimer > 0) {
        ctx.save();
        ctx.fillStyle = "#0ff"; ctx.font = "18px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText(messageText, canvas.width / 2, canvas.height / 2);
        ctx.restore();
        messageTimer--;
    }

    // Draw laser charge circle
    drawLaserChargeCircle();
    drawUpgradeChargeCircle();

    // Laser mode indicator
    if (laserMode) {
        ctx.save();
        ctx.fillStyle = "#ffff00";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("LASER MODE: " + Math.ceil(laserDuration / 1000) + "s", canvas.width / 2, 120);
        ctx.restore();
    }

    // Spawn waves / boss
    if (!boss && !bossPending) {
        if (!waveActive) {
            createFormationWave();
            waveActive = true;
        } else if (enemies.length === 0) {
            if (phase < 5) {
                phase++;
                waveActive = false;
                if (document.getElementById('phase')) document.getElementById('phase').innerText = phase;
                showMessage("PHASE " + phase);
                createFormationWave();
                waveActive = true;
                // Phase 5 should have boss + mini aliens at the same time
                if (phase === 5 && !phase5BossDefeated) {
                    bossPending = true;
                    showMessage("PHASE 5 BOSS!");
                }
            } else if (phase === 5 && !phase5BossDefeated) {
                // After phase 5 waves, spawn phase 5 boss
                bossPending = true;
                showMessage("PHASE 5 BOSS!");
            } else if (phase5BossDefeated && !finalBossPhase) {
                // After phase 5 boss, move to final boss phase
                finalBossPhase = true;
                phase = 6;
                bossPending = true;
                showMessage("FINAL BOSS!");
            }
        }
    }

    if (bossPending && !boss && !finalBossDefeated) {
        if (finalBossPhase) {
            // Final boss phase - use final boss sprite with phase 5 boss as escort
            boss = { x: canvas.width/2-100, y: -200, w: 200, h: 120, hp: 200 + (phase * 100), speed: 2, bossType: 'final', vx: 1.6, vy: 1.2, moveTimer: 0 };
        } else {
            // Phase 5 boss
            boss = { x: canvas.width/2-100, y: -200, w: 200, h: 120, hp: 150 + (phase * 80), speed: 2, bossType: 'phase5', vx: 1.5, vy: 1.0, moveTimer: 0 };
        }
        bossPending = false;
        // spawn escorts that accompany the boss
        createBossWithEscorts();
        // Start phase boss music immediately on spawn.
        playBossTheme(true);
    }

    checkCollisions();
    if(document.getElementById('score')) document.getElementById('score').innerText = score;
    requestAnimationFrame(animate);
}

// --- CONTROLS ---

function movePlayer(clientX, clientY) {
    if (gameState === "PLAYING") {
        player.x = clientX - player.w / 2;
        player.y = clientY - player.h - 50; 
    }
}

function resumeAudioFromGesture() {
    initAudio();
    if (soundMuted) return;
    if (pendingFinalVictorySound) {
        playFinalVictorySound();
    }
    if (gameState === "GAMEOVER") return;
    // On mobile/webview, retry boss track inside user gesture to avoid delayed playback.
    if (boss) playBossTheme(true);
    else startBackgroundMusic();
}

canvas.addEventListener('touchstart', () => resumeAudioFromGesture(), { passive: true });
canvas.addEventListener('mousedown', () => resumeAudioFromGesture());
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); movePlayer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('mousemove', (e) => movePlayer(e.clientX, e.clientY));

// Click handler for laser charge circle
canvas.addEventListener('click', (e) => {
    if (gameState !== "PLAYING" || !window.laserCirclePos) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const circle = window.laserCirclePos;
    
    // Check if click is within circle radius
    const distX = clickX - circle.x;
    const distY = clickY - circle.y;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    // If clicked on circle and laser is fully charged (requires at least 10 kills)
    if (distance <= circle.radius && laserKills >= 10 && !laserMode) {
        laserMode = true;
        laserDuration = 2000 + Math.random() * 3000;
        playLaserSound();
        laserKills = 0; // Reset laser charge counter
    }

    const upgradeCircle = window.upgradeCirclePos;
    if (upgradeCircle) {
        const uDx = clickX - upgradeCircle.x;
        const uDy = clickY - upgradeCircle.y;
        const uDistance = Math.sqrt(uDx * uDx + uDy * uDy);
        if (uDistance <= upgradeCircle.radius && upgradeKills >= 15 && !upgradeActive && !upgradeUsed) {
            upgradeActive = true;
            upgradeUsed = true;
            upgradeKills = 0;
            upgradeFlashTimer = 120; // ~2 seconds at 60fps
            window.companionSlideY = canvas.height + 80;
        }
    }
});

document.addEventListener('pointerdown', () => {
    resumeAudioFromGesture();
});
homeScreen.addEventListener('pointerdown', () => {
    initAudio();
    startBackgroundMusic();
});

// --- BUTTON EVENT LISTENERS ---

startBtn.addEventListener('click', () => {
    resetGame();
    resumeAudioFromGesture();
    animate();
});

tryAgainBtn.addEventListener('click', () => {
    stopBossAudio();
    resetGame();
    if (!soundMuted) startBackgroundMusic();
    resumeAudioFromGesture();
    animate();
});

backMenuBtn.addEventListener('click', () => {
    gameState = "MENU";
    gameOverScreen.style.display = 'none';
    homeScreen.style.display = 'flex';
    hud.style.display = 'none';
    bossThemePlaying = false;
    pendingFinalVictorySound = false;
    // Stop any boss audio and clear boss state so it won't resume
    stopBossAudio();
    boss = null;
    boss2 = null;
    bossPending = false;
    finalBossPhase = false;
    finalBossDefeated = false;
    // Restart bg music for main menu
    if (!soundMuted) startBackgroundMusic();
    // Clear the canvas
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    resumeAudioFromGesture();
});

// --- SOUND TOGGLE BUTTON INITIALIZATION (after all variables declared) ---
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', toggleSound);
    soundToggleBtn.textContent = soundMuted ? '🔇' : '🔊';
    if (soundMuted) soundToggleBtn.classList.add('muted');
    else soundToggleBtn.classList.remove('muted');
}

function stopBossAudio() {
    if (bossMusic) { bossMusic.pause(); bossMusic.currentTime = 0; bossMusic.muted = true; }
    if (phase5EntranceSound) { phase5EntranceSound.pause(); phase5EntranceSound.currentTime = 0; phase5EntranceSound.muted = true; }
    if (finalBossEntranceSound) { finalBossEntranceSound.pause(); finalBossEntranceSound.currentTime = 0; finalBossEntranceSound.muted = true; }
    activeBossTrack = null;
    bossThemePlaying = false;
}