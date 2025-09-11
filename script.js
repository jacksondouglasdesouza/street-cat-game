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
let bgImagesLoaded = false;
let fishCollected = 0;


const game = new Phaser.Game(config);

// --- PRÉ-CARREGAMENTO DE RECURSOS ---
function preload() {
    // Carrega as imagens de fundo
    this.load.image('city-background-scene1', 'img/city-background-scene1.png').on('loaderror', () => {
        console.warn('Failed to load city-background-scene1.png');
    });
    this.load.image('city-background-scene2', 'img/city-background-scene2.png').on('loaderror', () => {
        console.warn('Failed to load city-background-scene2.png');
    });
    this.load.image('cat-shit', 'img/catShit.png');
    // Carrega os sprites reaispro
    this.load.image('cat-run', 'img/cat-run.png');
    this.load.image('trash-can', 'img/trash-can.png');
    this.load.image('fish', 'img/fish.png');
    
    // Carrega os áudios
    this.load.audio('jump', 'audio/jump.mp3');
    this.load.audio('collect', 'audio/collect.mp3');
    this.load.audio('hit', 'audio/fail.mp3');
    this.load.audio('background-music', 'audio/bgSound.mp3');
}

// --- CRIAÇÃO DA CENA ---
function create() {
    const { width, height } = config;

    gameStarted = false;
    score = 0;
    gameSpeed = -600;

    // Inicializa os sons
    jumpSound = this.sound.add('jump');
    collectSound = this.sound.add('collect');
    hitSound = this.sound.add('hit');
    backgroundMusic = this.sound.add('background-music');
    
    // Toca a música de fundo em loop
    backgroundMusic.play({ loop: true, volume: 0.5 });

    // --- CENÁRIO COM PARALLAX INFINITO ---
    // Verifica se as imagens de fundo foram carregadas, senão usa fallbacks
    if (this.textures.exists('city-background-scene1')) {
        backgroundLayers.layer1 = this.add.tileSprite(0, 0, width, height, 'city-background-scene1').setOrigin(0, 0);
        backgroundLayers.layer1.setScale(
            Math.max(width / backgroundLayers.layer1.width, height / backgroundLayers.layer1.height)
        );
    } else {
        // Fallback: retângulo colorido
        backgroundLayers.layer1 = this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0, 0);
        console.log('Using fallback for city-background-scene1');
    }
    
    if (this.textures.exists('city-background-scene2')) {
        backgroundLayers.layer2 = this.add.tileSprite(0, 0, width, height, 'city-background-scene2').setOrigin(0, 0);
        backgroundLayers.layer2.setScale(
            Math.max(width / backgroundLayers.layer2.width, height / backgroundLayers.layer2.height)
        );
    } else {
        // Fallback: retângulo colorido
        backgroundLayers.layer2 = this.add.rectangle(0, 0, width, height, 0x16213e).setOrigin(0, 0);
        console.log('Using fallback for city-background-scene2');
    }
    

    // --- Chão com Textura de Calçada ---
    const groundHeight = 100;
    const tileColor1 = 0x4a4a4a; // Cor da lajota
    const tileColor2 = 0x5a5a5a; // Cor alternativa da lajota
    const tileSize = 50; // Tamanho de cada "lajota"

    // Cria um objeto gráfico temporário para desenhar a textura
    const graphics = this.add.graphics();
    graphics.fillStyle(tileColor1);
    graphics.fillRect(0, 0, tileSize, tileSize);
    graphics.fillStyle(tileColor2);
    graphics.fillRect(tileSize, 0, tileSize, tileSize);
    graphics.fillStyle(tileColor2);
    graphics.fillRect(0, tileSize, tileSize, tileSize);
    graphics.fillStyle(tileColor1);
    graphics.fillRect(tileSize, tileSize, tileSize, tileSize);

    // Gera uma textura a partir do desenho e a destrói em seguida
    graphics.generateTexture('sidewalk-texture', tileSize * 2, tileSize * 2);
    graphics.destroy();

    // Cria o chão usando a nova textura como um TileSprite (para repetir)
    ground = this.add.tileSprite(0, height - groundHeight, width, groundHeight, 'sidewalk-texture').setOrigin(0);
    this.physics.add.existing(ground, true); // Adiciona física ao chão

    // Adiciona um evento para mover a textura da calçada junto com o jogo
    this.time.addEvent({
        delay: 16, // Aproximadamente 60 FPS
        loop: true,
        callback: () => {
            if (gameStarted && !gameOverText.visible) {
                // A velocidade do chão deve ser a mesma do jogo para parecer que o gato está correndo sobre ele
                ground.tilePositionX -= gameSpeed / 60; 
            }
        }
    });


    // --- JOGADOR ---
    // Verifica se a textura do gato foi carregada, senão cria um placeholder
    if (this.textures.exists('cat-run')) {
        player = this.physics.add.sprite(200, height - 250, 'cat-run');
    } else {
        // Cria um placeholder para o gato
        const graphics = this.add.graphics();
        graphics.fillStyle(0xff6b6b);
        graphics.fillRect(0, 0, 60, 40);
        graphics.fillStyle(0x000000);
        graphics.fillRect(10, 10, 10, 10);
        graphics.fillRect(40, 10, 10, 10);
        graphics.generateTexture('cat-run-placeholder', 60, 40);
        graphics.destroy();
        
        player = this.physics.add.sprite(200, height - 250, 'cat-run-placeholder');
    }
    player.setScale(0.7);
    player.setBounce(0.1);
    player.body.setSize(player.width * 0.8, player.height * 0.5).setOffset(player.width * 0.1, player.height * 0.2);
    this.physics.add.collider(player, ground);
    
    // >>>>>>>>>>>>>>>>>>>>>>>>     this.physics.pause();

    // --- EFEITOS VISUAIS ---
    dustParticles = this.add.particles(0, 0, null, {
        speed: { min: -50, max: 50 }, 
        angle: { min: 250, max: 290 },
        scale: { start: 0.3, end: 0 }, 
        lifespan: 400,
        blendMode: 'SCREEN', 
        tint: 0xaaaaaa, 
        on: false
    });
    dustParticles.startFollow(player, -player.width/2 * player.scale, player.height/2 * player.scale - 20);

    // --- OBSTÁCULOS ---
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
    
    scoreText = this.add.text(width - 30, 30, `FISHES: ${score}`, fontStyle).setOrigin(1, 0).setScrollFactor(0);
    
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

    // --- CONTROLES ---
    this.input.on('pointerdown', () => {
        if (gameOverText.visible) {
            this.scene.restart();
            return;
        }

        if (!gameStarted) {
            gameStarted = true;
            this.physics.resume();
            startText.destroy();
            
            obstacleTimer = this.time.addEvent({ 
                delay: 1200, 
                callback: spawnObstacle, 
                callbackScope: this, 
                loop: true 
            });

            player.setVelocityY(-1200);
            player.setVelocityX(50);
            dustParticles.emitParticle(15);
            jumpSound.play();
            return;
        }

        if (player.body.blocked.down) {
            player.setVelocityY(-1200);
            player.setVelocityX(50);
            dustParticles.emitParticle(15);
            jumpSound.play();
        }
    });
}

// --- ATUALIZAÇÃO DO JOGO ---
function update(time, delta) {
    if (gameStarted && !gameOverText.visible) {
        gameSpeed -= (speedIncreasePerSecond * delta) / 1000;
    }

    if (!gameStarted || gameOverText.visible) {
        return;
    }
    
    // Atualiza a posição dos fundos para rolar continuamente (efeito parallax)
    // Apenas se for um TileSprite (não um retângulo de fallback)
    if (backgroundLayers.layer1 instanceof Phaser.GameObjects.TileSprite) {
        backgroundLayers.layer1.tilePositionX += 0.5;  // Mais lento
    }
    if (backgroundLayers.layer2 instanceof Phaser.GameObjects.TileSprite) {
        backgroundLayers.layer2.tilePositionX += 1.5;  // Velocidade média
    }

    if (player.body.blocked.down) {
        dustParticles.emitParticle(1);
    }

    obstacles.getChildren().forEach(obstacle => {
        if (obstacle.active && obstacle.x < -100) {
            obstacle.destroy(); 
        }
    });
}

// --- FUNÇÕES AUXILIARES ---
function spawnObstacle() {
    if (!gameStarted) return;

    const isObstacle = Math.random() > 0.45;
    const key = isObstacle ? 'trash-can' : 'fish';
    
    // Verifica se a textura existe, senão usa fallback
    let textureKey = key;
    if (!this.textures.exists(key)) {
        // Cria texturas de fallback
        const graphics = this.add.graphics();
        if (key === 'trash-can') {
            graphics.fillStyle(0x8c7ae6);
            graphics.fillRect(0, 0, 40, 60);
            graphics.fillStyle(0x353b48);
            graphics.fillRect(8, 8, 24, 35);
            graphics.generateTexture('trash-can-placeholder', 40, 60);
        } else {
            graphics.fillStyle(0x00a8ff);
            graphics.fillEllipse(20, 10, 20, 10);
            graphics.fillStyle(0xffffff);
            graphics.fillEllipse(25, 8, 4, 4);
            graphics.generateTexture('fish-placeholder', 40, 20);
        }
        graphics.destroy();
        textureKey = key + '-placeholder';
    }
    
    let obstacle = obstacles.create(config.width + 200, 0, textureKey);
    obstacle.body.setAllowGravity(false);
    
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

    this.physics.add.overlap(player, obstacle, () => handleCollision(obstacle, isObstacle, this));
}

function handleCollision(obstacle, isObstacle, scene) {
    if (!obstacle.active) return;

    if (isObstacle) {
        gameStarted = false;
        obstacleTimer.paused = true;
        scene.physics.pause();
        player.setTint(0xff5555);
        gameOverText.setVisible(true);
        hitSound.play();
        backgroundMusic.stop();
    } else {
        // --- Lógica de Coleta de Peixe ---
        score++;
        scoreText.setText(`FISH: ${score}`);
        collectSound.play();
        fishCollected++;
        console.log(`Peixes coletados: ${fishCollected}`); // Para depuração

        // Efeito visual da coleta
        const collectEffect = scene.add.circle(obstacle.x, obstacle.y, 10, 0x00BFFF).setScale(1);
        scene.tweens.add({ 
            targets: collectEffect, 
            scale: { to: 15 }, 
            alpha: { from: 1, to: 0 }, 
            duration: 600, 
            onComplete: () => collectEffect.destroy() 
        });

        obstacle.destroy();

        // --- Lógica da Pausa para Necessidades ---
        if (fishCollected === 3 || fishCollected === 10 || fishCollected === 20) {
            // Pausa o jogo, mas deixa o gato cair (gravidade ativa)
            gameStarted = false;
            obstacleTimer.paused = true;
            player.setVelocityX(0); // Para o movimento horizontal
            // Não pausamos a física aqui para o gato poder cair

            // Cria um evento para verificar quando o gato toca o chão
            const checkGroundEvent = scene.time.addEvent({
                delay: 50, // Verifica a cada 50ms
                loop: true,
                callback: () => {
                    if (player.body.blocked.down) {
                        // O gato tocou o chão, agora começa a cena!
                        checkGroundEvent.remove(); // Para de verificar
                        scene.physics.pause(); // Pausa a física completamente agora
                        player.setVelocityY(0); // Garante que ele pare de se mover verticalmente

                        // Troca a imagem e ajusta a posição
                        player.setTexture("cat-shit");
                        player.y += 30;
                        player.body.setAllowGravity(false); // Impede que o gato caia durante a pausa

                        // Adiciona o som e o balão de fala (vamos criar em breve)
                        // shameSound.play(); 
                        // thoughtBubble.setVisible(true);

                        // Timer para voltar ao normal
                        scene.time.delayedCall(2000, () => {
                            player.y -= 30;
                            player.setTexture("cat-run");
                            player.body.setAllowGravity(true); // Restaura a gravidade
                            gameStarted = true;
                            obstacleTimer.paused = false;
                            scene.physics.resume();
                            // Re-adiciona o collider para garantir que o gato não caia
                            scene.physics.add.collider(player, ground);
                            fishCollected = 0; // Reseta a contagem de peixes
                            player.body.enable = true; // Garante que o corpo físico esteja habilitado
                            // thoughtBubble.setVisible(false);
                        });
                    }
                }
            });
        }
    }
}
