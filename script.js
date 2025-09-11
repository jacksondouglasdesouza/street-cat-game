const config = {
    type: Phaser.AUTO,
    width: 2000,
    height: 1000,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2500 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// --- VARIÁVEIS GLOBAIS ---
let player, obstacles, ground, scoreText, gameOverText, dustParticles, startText;
let score = 0;
let gameSpeed = -600;
let speedIncreasePerSecond = 10;
let gameStarted = false;
let obstacleTimer;
let backgroundLayers = {};
let jumpSound, collectSound, hitSound, backgroundMusic;
let gamePausedForEvent = false;

const game = new Phaser.Game(config);

// --- PRÉ-CARREGAMENTO DE RECURSOS ---
function preload() {
    this.load.image('city-background-scene1', 'img/city-background-scene1.png');
    this.load.image('city-background-scene2', 'img/city-background-scene2.png');
    this.load.image('cat-shit', 'img/catShit.png');
    this.load.image('cat-run', 'img/cat-run.png');
    this.load.image('trash-can', 'img/trash-can.png');
    this.load.image('fish', 'img/fish.png');
    this.load.audio('jump', 'audio/jump.mp3');
    this.load.audio('collect', 'audio/collect.mp3');
    this.load.audio('hit', 'audio/fail.mp3');
    this.load.audio('background-music', 'audio/bgSound.mp3');
}

// --- CRIAÇÃO DA CENA ---
function create() {
    const { width, height } = config;

    // Reset de variáveis
    gameStarted = false;
    gamePausedForEvent = false;
    score = 0;
    gameSpeed = -600;

    // Inicializa os sons
    jumpSound = this.sound.add('jump');
    collectSound = this.sound.add('collect');
    hitSound = this.sound.add('hit');
    backgroundMusic = this.sound.add('background-music');
    
    if (!backgroundMusic.isPlaying) {
        backgroundMusic.play({ loop: true, volume: 0.5 });
    }

    // --- CENÁRIO ---
    backgroundLayers.layer1 = this.add.tileSprite(0, 0, width, height, 'city-background-scene1').setOrigin(0, 0);
    backgroundLayers.layer1.setScale(Math.max(width / backgroundLayers.layer1.width, height / backgroundLayers.layer1.height));
    
    backgroundLayers.layer2 = this.add.tileSprite(0, 0, width, height, 'city-background-scene2').setOrigin(0, 0);
    backgroundLayers.layer2.setScale(Math.max(width / backgroundLayers.layer2.width, height / backgroundLayers.layer2.height));

    // --- CHÃO ---
    const groundHeight = 100;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x4a4a4a);
    graphics.fillRect(0, 0, 50, 50);
    graphics.fillStyle(0x5a5a5a);
    graphics.fillRect(50, 0, 50, 50);
    graphics.fillRect(0, 50, 50, 50);
    graphics.fillStyle(0x4a4a4a);
    graphics.fillRect(50, 50, 50, 50);
    graphics.generateTexture('sidewalk-texture', 100, 100);
    graphics.destroy();
    ground = this.add.tileSprite(0, height - groundHeight, width, groundHeight, 'sidewalk-texture').setOrigin(0);
    this.physics.add.existing(ground, true);

    // --- JOGADOR ---
    player = this.physics.add.sprite(200, height - 250, 'cat-run');
    player.setScale(0.7);
    player.setBounce(0.1);
    player.body.setSize(player.width * 0.8, player.height * 0.5).setOffset(player.width * 0.1, player.height * 0.2);
    this.physics.add.collider(player, ground);
    
    // --- EFEITO DE BRILHO DO PULO ---
    const circleGraphics = this.add.graphics({ fillStyle: { color: 0xffffff } });
    circleGraphics.fillCircle(5, 5, 5);
    circleGraphics.generateTexture('light-particle', 10, 10);
    circleGraphics.destroy();

    dustParticles = this.add.particles(0, 0, 'light-particle', {
        frame: 0,
        speed: { min: 50, max: 150 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.1, end: 0 },
        lifespan: 500,
        gravityY: 100,
        blendMode: 'ADD',
        tint: 0x00ff00,
        // --- AJUSTE DE BRILHO ---
        quantity: 5, // Aumentado de 3 para 5 para um pouco mais de brilho
        on: false 
    });
    dustParticles.startFollow(player, -player.width/2 * player.scale + 20, player.height/2 * player.scale - 10);

    // --- GRUPO DE OBSTÁCULOS ---
    obstacles = this.physics.add.group();

    // --- UI ---
    const fontStyle = { 
        fontSize: '32px', 
        fill: '#FFFFFF', 
        fontFamily: 'Arial, sans-serif', 
        fontStyle: 'bold', 
        stroke: '#000000', 
        strokeThickness: 6 
    };
    
    scoreText = this.add.text(width - 30, 30, `FISH: ${score}`, fontStyle).setOrigin(1, 0).setScrollFactor(0);
    
    gameOverText = this.add.text(width / 2, height / 2 - 50, 'GAME OVER\nClick to restart', { 
        ...fontStyle, 
        fontSize: '48px', 
        align: 'center', 
        fill: '#ff3838' 
    }).setOrigin(0.5).setVisible(false).setScrollFactor(0);

    startText = this.add.text(width / 2, height / 2, 'CLICK TO START', { 
        ...fontStyle, 
        fontSize: '48px',
        fill: '#ff9f43'
    }).setOrigin(0.5).setScrollFactor(0);
    
    this.tweens.add({ 
        targets: startText, 
        alpha: 0.2, 
        duration: 800, 
        ease: 'Sine.easeInOut', 
        yoyo: true, 
        repeat: -1 
    });

    // --- LÓGICA DE PULO REATORADA ---
    // Criamos uma função separada para o pulo para ser chamada por múltiplos controles
    const jump = () => {
        if (player.body.blocked.down && !gamePausedForEvent) {
            player.setVelocityY(-1200);
            player.setVelocityX(50);
            dustParticles.emitParticle(5); // Aumentado para 5 para corresponder ao ajuste
            jumpSound.play();
        }
    };

    // --- CONTROLES ---
    // 1. Controle por Mouse/Toque
    this.input.on('pointerdown', () => {
        if (gameOverText.visible) {
            backgroundMusic.stop();
            this.scene.restart();
            return;
        }

        if (!gameStarted) {
            gameStarted = true;
            startText.destroy();
            
            obstacleTimer = this.time.addEvent({ 
                delay: 1200, 
                callback: spawnObstacle, 
                callbackScope: this, 
                loop: true 
            });
        }
        
        jump(); // Chama a função de pulo
    });

    // 2. Controle por Teclado (Tecla Tab)
    this.input.keyboard.on('keydown-TAB', (event) => {
        event.preventDefault(); // Impede o comportamento padrão da tecla Tab no navegador
        jump(); // Chama a mesma função de pulo
    });

    this.physics.add.overlap(player, obstacles, handleCollision, null, this);
}

// --- ATUALIZAÇÃO DO JOGO ---
function update(time, delta) {
    if (!gameStarted || gameOverText.visible || gamePausedForEvent) {
        if (gamePausedForEvent && player.body.velocity.x > 0) {
            player.setVelocityX(Math.max(0, player.body.velocity.x - 5)); 
        }
        return;
    }
    
    gameSpeed -= (speedIncreasePerSecond * delta) / 1000;

    backgroundLayers.layer1.tilePositionX += 0.5;
    backgroundLayers.layer2.tilePositionX += 1.5;
    ground.tilePositionX -= gameSpeed / 60; 

    obstacles.getChildren().forEach(obstacle => {
        if (obstacle.active && obstacle.x < -100) {
            obstacle.destroy(); 
        }
    });
}

// --- FUNÇÕES AUXILIARES ---
function spawnObstacle() {
    if (gamePausedForEvent) return;

    const isObstacle = Math.random() > 0.45;
    const key = isObstacle ? 'trash-can' : 'fish';
    
    let obstacle = obstacles.create(config.width + 200, 0, key);
    obstacle.body.setAllowGravity(false);
    
    obstacle.setData('isObstacle', isObstacle);

    if (isObstacle) {
        obstacle.setScale(0.5);
        obstacle.y = config.height - ground.displayHeight - (obstacle.height * obstacle.scaleY / 2) + 10;
        obstacle.body.setSize(obstacle.width * 0.6, obstacle.height * 0.9).setOffset(obstacle.width * 0.2, 0);
        obstacle.body.immovable = true;
    } else {
        obstacle.setScale(0.5);
        obstacle.y = Phaser.Math.Between(config.height - 450, config.height - 300);
        obstacle.body.setSize(obstacle.width * 0.8, obstacle.height * 0.6);
        this.tweens.add({ 
            targets: obstacle, 
            alpha: { from: 0.7, to: 1 }, 
            duration: 500, 
            yoyo: true, 
            repeat: -1 
        });
    }

    obstacle.body.setVelocityX(isObstacle ? gameSpeed : gameSpeed * 1.2);
}

function handleCollision(player, obstacle) {
    if (!obstacle.active) return;

    const isObstacle = obstacle.getData('isObstacle');
    const scene = this; 

    if (isObstacle) {
        gameStarted = false;
        obstacleTimer.paused = true;
        scene.physics.pause();
        player.setTint(0xff5555);
        gameOverText.setVisible(true);
        hitSound.play();
        backgroundMusic.stop();
    } else {
        score++;
        scoreText.setText(`FISH: ${score}`);
        collectSound.play();

        const collectEffect = scene.add.circle(obstacle.x, obstacle.y, 10, 0x00BFFF).setScale(1);
        scene.tweens.add({ 
            targets: collectEffect, 
            scale: { to: 15 }, 
            alpha: { from: 1, to: 0 }, 
            duration: 600, 
            onComplete: () => collectEffect.destroy() 
        });

        obstacle.destroy();

        if (!gamePausedForEvent && (score === 3 || score === 10 || score === 20)) {
            gamePausedForEvent = true;
            obstacleTimer.paused = true;
            
            player.body.stop(); 
            player.setVelocity(0,0);
            
            const checkGroundEvent = scene.time.addEvent({
                delay: 50,
                loop: true,
                callback: () => {
                    if (player.body.blocked.down) {
                        checkGroundEvent.remove();
                        
                        if (scene.textures.exists('cat-shit')) {
                            player.setTexture("cat-shit");
                            player.body.setSize(player.width * 0.9, player.height * 0.4).setOffset(player.width * 0.05, player.height * 0.55);
                        } else {
                             player.setTint(0x996633); 
                        }
                        
                        player.y = ground.y - player.body.height / 2 - player.body.offset.y;
                        
                        scene.time.delayedCall(2000, () => {
                            player.setTexture("cat-run");
                            player.clearTint(); 
                            player.body.setSize(player.width * 0.8, player.height * 0.5).setOffset(player.width * 0.1, player.height * 0.2);
                            player.y = ground.y - player.body.height / 2 - player.body.offset.y;

                            gamePausedForEvent = false;
                            if(gameStarted) { 
                                obstacleTimer.paused = false;
                            }
                            scene.physics.resume(); 
                        });
                    }
                }
            });
        }
    }
}