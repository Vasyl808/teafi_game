// TeaJumpGame.js

class TeaJumpGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Game state
        this.gameState = 'start';
        this.score = 0;
        this.tokens = this.getStoredTokens();
        this.highScore = this.getHighScore();
        this.camera = { y: 0 };
        
        // Player (tea cup)
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 100,
            width: 50,
            height: 50,
            velX: 0,
            velY: 0,
            speed: 6,
            jumpPower: 16,
            onGround: false,
            rotation: 0
        };

        // Tilt control params
        this.tiltActive = false;
        this.tiltX = 0; // store tilt value (gamma)
        this.tiltSensitivity = 1.0; // feel free to adjust

        // Game elements
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        this.platformGap = 100;
        this.lastCollectibleY = this.canvas.height;
        
        this.generateInitialPlatforms();
        this.setupControls();
        this.setupTiltControls(); // <<--- додано
        this.setupUI();
        this.updateDisplays();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    setupControls() {
        this.keys = {};
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mobile controls
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        
        // Touch events for mobile buttons
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys['a'] = true;
        });
        
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys['a'] = false;
        });
        
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys['d'] = true;
        });
        
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keys['d'] = false;
        });
        
        // Mouse events as fallback
        leftBtn.addEventListener('mousedown', () => this.keys['a'] = true);
        leftBtn.addEventListener('mouseup', () => this.keys['a'] = false);
        rightBtn.addEventListener('mousedown', () => this.keys['d'] = true);
        rightBtn.addEventListener('mouseup', () => this.keys['d'] = false);
    }

    setupTiltControls() {
        // (1) Запит дозволу на iOS (тільки при потребі)
        if (
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
            // Додаємо інструкцію/клік для дозволу тільки на iOS Safari
            document.getElementById('startBtn').addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission().then(response => {
                    if (response === 'granted') {
                        this.tiltActive = true;
                    }
                }).catch(console.error);
            });
        } else {
            // Android, Chrome та інші: tilt працює одразу
            this.tiltActive = true;
        }

        // (2) Слухаємо deviceorientation
        window.addEventListener('deviceorientation', (event) => {
            if (!this.tiltActive) return;
            if (event.gamma === null) return;
            // Нормалізуємо gamma до [-30, +30]
            let gamma = Math.max(-30, Math.min(30, event.gamma));
            // Фільтр шуму (менше 3 градусів - ігнор)
            if (Math.abs(gamma) < 3) gamma = 0;
            this.tiltX = gamma;
        });
    }
    
    setupUI() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('startScreen').style.display = 'none';
        this.gameLoop();
    }
    
    restartGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.camera.y = 0;
        
        // Reset player
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 100;
        this.player.velX = 0;
        this.player.velY = 0;
        this.player.onGround = false;
        this.player.rotation = 0;
        
        // Reset game elements
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        this.lastCollectibleY = this.canvas.height;
        
        this.generateInitialPlatforms();
        
        document.getElementById('gameOver').style.display = 'none';
        this.updateDisplays();
        this.gameLoop();
    }
    
    generateInitialPlatforms() {
        // Start platform
        this.platforms.push({
            x: this.canvas.width / 2 - 60,
            y: this.canvas.height - 50,
            width: 120,
            height: 20,
            type: 'normal',
            color: '#4CAF50'
        });
        
        // Generate platforms upwards
        for (let i = 1; i < 30; i++) {
            this.generatePlatform(i);
        }
    }
    
    generatePlatform(index) {
        // Added 'crumbling' type!
        const types = ['normal', 'moving', 'spring', 'fragile', 'crumbling'];
        const weights = [52, 18, 14, 6, 10]; // Adjusted weights, crumbling is rarer
        
        let type = 'normal';
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                type = types[i];
                break;
            }
        }
        
        const platform = {
            x: Math.random() * (this.canvas.width - 100),
            y: this.canvas.height - (index * this.platformGap),
            width: type === 'fragile' ? 80 : type === 'spring' ? 70 : type === 'crumbling' ? 80 : 100,
            height: type === 'spring' ? 25 : 20,
            type: type,
            moveDirection: Math.random() > 0.5 ? 1 : -1,
            moveSpeed: 1.5 + Math.random(),
            broken: false,
            bounceHeight: 0,
            hitCount: 0,
            // for crumbling platforms
            crumbling: false,
            crumbleTimer: 0,
            crumblePieces: []
        };
        
        // Set colors
        switch (type) {
            case 'normal': platform.color = '#4CAF50'; break;
            case 'moving': platform.color = '#FF7043'; break;
            case 'spring': platform.color = '#42A5F5'; break;
            case 'fragile': platform.color = '#FFA726'; break;
            case 'crumbling': platform.color = '#BDBDBD'; break;
        }
        
        this.platforms.push(platform);
        
        // Add collectible chance
        if (Math.random() < 0.3 && index > 2) {
            this.collectibles.push({
                x: platform.x + platform.width / 2 - 15,
                y: platform.y - 40,
                width: 30,
                height: 30,
                collected: false,
                bounce: 0,
                type: 'tea_leaf'
            });
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.updatePlayer();
        this.updatePlatforms();
        this.updateCollectibles();
        this.updateParticles();
        this.checkCollisions();
        this.updateCamera();
        this.generateNewPlatforms();
        this.updateScore();
        this.checkGameOver();
    }
    
    updatePlayer() {
        // -- Класичне керування кнопками --
        let usingButton = false;
        if (this.keys['arrowleft'] || this.keys['a']) {
            this.player.velX = -this.player.speed;
            this.player.rotation = Math.max(this.player.rotation - 0.1, -0.3);
            usingButton = true;
        } else if (this.keys['arrowright'] || this.keys['d']) {
            this.player.velX = this.player.speed;
            this.player.rotation = Math.min(this.player.rotation + 0.1, 0.3);
            usingButton = true;
        }

        // -- Керування нахилом (якщо не натиснута кнопка) --
        if (!usingButton && Math.abs(this.tiltX) > 0.1) {
            // tiltX: -30...+30 (лівий/правий нахил)
            this.player.velX = (this.tiltX / 30) * this.player.speed * this.tiltSensitivity;
            this.player.rotation = Math.max(-0.3, Math.min(0.3, (this.tiltX / 30) * 0.3));
        }

        // Якщо не tilt і не кнопка, гальмуємо
        if (!usingButton && Math.abs(this.tiltX) <= 0.1) {
            this.player.velX *= 0.85; // Friction
            this.player.rotation *= 0.9; // Return to upright
        }

        // Gravity
        this.player.velY += 0.8;
        
        // Update position
        this.player.x += this.player.velX;
        this.player.y += this.player.velY;
        
        // Horizontal wrap
        if (this.player.x < -this.player.width) {
            this.player.x = this.canvas.width;
        } else if (this.player.x > this.canvas.width) {
            this.player.x = -this.player.width;
        }
    }
    
    updatePlatforms() {
        this.platforms.forEach(platform => {
            if (platform.type === 'moving') {
                platform.x += platform.moveDirection * platform.moveSpeed;
                if (platform.x <= 0 || platform.x >= this.canvas.width - platform.width) {
                    platform.moveDirection *= -1;
                }
            }
            
            if (platform.bounceHeight > 0) {
                platform.bounceHeight *= 0.9;
            }

            // Handle crumbling platforms
            if (platform.type === 'crumbling' && platform.crumbling && !platform.broken) {
                platform.crumbleTimer++;
                if (platform.crumbleTimer > 15) {
                    // Start crumble animation and remove platform
                    platform.broken = true;
                    this.createCrumblePieces(platform);
                }
            }
        });
    }

    createCrumblePieces(platform) {
        // Create falling "pieces" for crumble animation
        let pieceCount = 5;
        for (let i = 0; i < pieceCount; i++) {
            this.particles.push({
                x: platform.x + (platform.width / pieceCount) * (i + 0.5),
                y: platform.y + platform.height / 2,
                velX: (Math.random() - 0.5) * 2,
                velY: Math.random() * 4 + 2,
                color: '#BDBDBD',
                life: 35,
                maxLife: 35,
                alpha: 1,
                size: platform.width / pieceCount * 0.8
            });
        }
    }
    
    updateCollectibles() {
        this.collectibles.forEach(collectible => {
            if (!collectible.collected) {
                collectible.bounce += 0.1;
            }
        });
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.velX;
            particle.y += particle.velY;
            particle.velY += 0.3;
            particle.life--;
            particle.alpha = particle.life / particle.maxLife;
            return particle.life > 0;
        });
    }
    
    checkCollisions() {
        this.player.onGround = false;
        
        // Platform collisions
        this.platforms.forEach(platform => {
            if (platform.broken) return;
            
            if (this.player.x < platform.x + platform.width &&
                this.player.x + this.player.width > platform.x &&
                this.player.y < platform.y + platform.height &&
                this.player.y + this.player.height > platform.y) {
                
                if (this.player.velY > 0 && this.player.y < platform.y) {
                    this.player.y = platform.y - this.player.height;
                    this.player.onGround = true;
                    
                    // Platform effects
                    if (platform.type === 'spring') {
                        this.player.velY = -this.player.jumpPower * 1.4;
                        platform.bounceHeight = 15;
                        this.createJumpParticles(platform.x + platform.width/2, platform.y, '#42A5F5');
                    } else if (platform.type === 'fragile') {
                        platform.hitCount++;
                        if (platform.hitCount >= 2) {
                            platform.broken = true;
                            this.createJumpParticles(platform.x + platform.width/2, platform.y, '#FFA726');
                        }
                        this.player.velY = -this.player.jumpPower;
                    } else if (platform.type === 'crumbling') {
                        if (!platform.crumbling) {
                            platform.crumbling = true;
                            platform.crumbleTimer = 0;
                        }
                        this.player.velY = -this.player.jumpPower;
                        this.createJumpParticles(platform.x + platform.width/2, platform.y, '#BDBDBD');
                    } else {
                        this.player.velY = -this.player.jumpPower;
                        this.createJumpParticles(platform.x + platform.width/2, platform.y, platform.color);
                    }
                }
            }
        });
        
        // Collectible collisions
        this.collectibles.forEach(collectible => {
            if (!collectible.collected &&
                this.player.x < collectible.x + collectible.width &&
                this.player.x + this.player.width > collectible.x &&
                this.player.y < collectible.y + collectible.height &&
                this.player.y + this.player.height > collectible.y) {
                
                collectible.collected = true;
                this.tokens++;
                this.saveTokens();
                this.updateDisplays();
                this.createCollectParticles(collectible.x + collectible.width/2, collectible.y, '#4CAF50');
            }
        });
    }
    
    createJumpParticles(x, y, color) {
        // Steam/splash particles when jumping
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 30,
                y: y,
                velX: (Math.random() - 0.5) * 8,
                velY: (Math.random() - 0.5) * 8 - 4,
                color: color,
                life: 25 + Math.random() * 20,
                maxLife: 25 + Math.random() * 20,
                alpha: 1,
                size: 2 + Math.random() * 4
            });
        }
    }
    
    createCollectParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                velX: Math.cos(i * Math.PI / 4) * 5,
                velY: Math.sin(i * Math.PI / 4) * 5,
                color: color,
                life: 30,
                maxLife: 30,
                alpha: 1,
                size: 3
            });
        }
    }
    
    updateCamera() {
        const targetY = this.player.y - this.canvas.height * 0.6;
        if (targetY < this.camera.y) {
            this.camera.y += (targetY - this.camera.y) * 0.1;
        }
    }
    
    generateNewPlatforms() {
        const highestPlatform = Math.min(...this.platforms.map(p => p.y));
        const cameraTop = this.camera.y;
        
        if (highestPlatform > cameraTop - 300) {
            const newPlatformY = highestPlatform - this.platformGap;
            const index = Math.floor((this.canvas.height - newPlatformY) / this.platformGap);
            this.generatePlatform(index);
        }
        
        // Clean up old platforms and collectibles
        this.platforms = this.platforms.filter(p => p.y < this.camera.y + this.canvas.height + 100);
        this.collectibles = this.collectibles.filter(c => c.y < this.camera.y + this.canvas.height + 100);
    }
    
    updateScore() {
        const newScore = Math.max(0, Math.floor((this.canvas.height - this.player.y - 100) / 10));
        if (newScore > this.score) {
            this.score = newScore;
            this.updateDisplays();
        }
    }
    
    checkGameOver() {
        if (this.player.y > this.camera.y + this.canvas.height + 100) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        let isNewRecord = false;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            isNewRecord = true;
        }
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalTokens').textContent = this.tokens;
        document.getElementById('newRecord').style.display = isNewRecord ? 'block' : 'none';
        document.getElementById('gameOver').style.display = 'block';
        this.updateDisplays();
    }
    
    render() {
        // Clear canvas with gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#E8F4FD');
        gradient.addColorStop(0.3, '#F0F8FF');
        gradient.addColorStop(0.7, '#E8F4FD');
        gradient.addColorStop(1, '#D6EAF8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add floating tea background elements
        this.drawBackgroundElements();
        
        // Save context for camera
        this.ctx.save();
        this.ctx.translate(0, -this.camera.y);
        
        // Draw platforms
        this.renderPlatforms();
        
        // Draw collectibles
        this.renderCollectibles();
        
        // Draw particles
        this.renderParticles();
        
        // Draw player
        this.renderPlayer();
        
        this.ctx.restore();
    }
    
    drawBackgroundElements() {
        // Floating tea elements in background
        const time = Date.now() * 0.001;
        this.ctx.globalAlpha = 0.1;
        
        for (let i = 0; i < 5; i++) {
            const x = (i * this.canvas.width / 4) + Math.sin(time + i) * 20;
            const y = (this.camera.y + i * 100) % this.canvas.height + Math.cos(time + i) * 15;
            
            this.ctx.font = '40px serif';
            this.ctx.fillStyle = '#6C55BC';
            this.ctx.fillText(i % 2 === 0 ? '🫖' : '☕', x, y);
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    renderPlatforms() {
        this.platforms.forEach(platform => {
            if (platform.broken) return;
            
            this.ctx.save();
            
            // Platform shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.15)';
            this.ctx.fillRect(
                platform.x + 3,
                platform.y + 3 + (platform.bounceHeight || 0),
                platform.width,
                platform.height
            );
            
            // Main platform with gradient
            const platformGradient = this.ctx.createLinearGradient(
                platform.x, platform.y - (platform.bounceHeight || 0),
                platform.x, platform.y + platform.height - (platform.bounceHeight || 0)
            );
            
            switch (platform.type) {
                case 'normal':
                    platformGradient.addColorStop(0, '#66BB6A');
                    platformGradient.addColorStop(1, '#4CAF50');
                    break;
                case 'moving':
                    platformGradient.addColorStop(0, '#FF8A65');
                    platformGradient.addColorStop(1, '#FF7043');
                    break;
                case 'spring':
                    platformGradient.addColorStop(0, '#64B5F6');
                    platformGradient.addColorStop(1, '#42A5F5');
                    break;
                case 'fragile':
                    var alpha = Math.max(0.3, 1 - platform.hitCount * 0.4);
                    platformGradient.addColorStop(0, `rgba(255, 183, 77, ${alpha})`);
                    platformGradient.addColorStop(1, `rgba(255, 167, 38, ${alpha})`);
                    break;
                case 'crumbling':
                    platformGradient.addColorStop(0, '#EEEEEE');
                    platformGradient.addColorStop(1, '#BDBDBD');
                    break;
            }
            
            this.ctx.fillStyle = platformGradient;
            this.ctx.fillRect(
                platform.x,
                platform.y - (platform.bounceHeight || 0),
                platform.width,
                platform.height
            );
            
            // Platform decorations
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.fillRect(
                platform.x + 2,
                platform.y - (platform.bounceHeight || 0) + 2,
                platform.width - 4,
                3
            );
            
            // Special platform indicators
            if (platform.type === 'spring') {
                this.ctx.fillStyle = '#1976D2';
                this.ctx.beginPath();
                this.ctx.arc(
                    platform.x + platform.width/2,
                    platform.y - (platform.bounceHeight || 0) + platform.height/2,
                    8, 0, Math.PI * 2
                );
                this.ctx.fill();
                
                // Spring coil effect
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                const centerX = platform.x + platform.width/2;
                const centerY = platform.y - (platform.bounceHeight || 0) + platform.height/2;
                for (let i = 0; i < 3; i++) {
                    this.ctx.arc(centerX, centerY, 3 + i * 2, 0, Math.PI * 2);
                }
                this.ctx.stroke();
            } else if (platform.type === 'moving') {
                // Arrow indicator
                this.ctx.fillStyle = '#D32F2F';
                this.ctx.font = '16px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    platform.moveDirection > 0 ? '→' : '←',
                    platform.x + platform.width/2,
                    platform.y - (platform.bounceHeight || 0) + platform.height/2 + 5
                );
            } else if (platform.type === 'fragile') {
                // Crack indicators
                this.ctx.strokeStyle = '#D84315';
                this.ctx.lineWidth = 1;
                for (let i = 0; i < platform.hitCount; i++) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(platform.x + 20 + i * 20, platform.y - (platform.bounceHeight || 0));
                    this.ctx.lineTo(platform.x + 25 + i * 20, platform.y - (platform.bounceHeight || 0) + platform.height);
                    this.ctx.stroke();
                }
            } else if (platform.type === 'crumbling') {
                // Crumbling icon / indicator
                this.ctx.fillStyle = '#757575';
                this.ctx.font = '16px serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('🪨', platform.x + platform.width/2, platform.y + platform.height/2 + 7);
                if (platform.crumbling) {
                    // Shake effect
                    this.ctx.strokeStyle = '#B71C1C';
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([4, 3]);
                    this.ctx.strokeRect(
                        platform.x,
                        platform.y - (platform.bounceHeight || 0),
                        platform.width,
                        platform.height
                    );
                    this.ctx.setLineDash([]);
                }
            }
            
            this.ctx.restore();
        });
    }
    
    renderCollectibles() {
        this.collectibles.forEach(collectible => {
            if (collectible.collected) return;
            
            this.ctx.save();
            
            const bounceOffset = Math.sin(collectible.bounce) * 5;
            const x = collectible.x + collectible.width / 2;
            const y = collectible.y + collectible.height / 2 + bounceOffset;
            
            // Glow effect
            this.ctx.shadowColor = '#4CAF50';
            this.ctx.shadowBlur = 15;
            
            // Tea leaf
            this.ctx.font = '24px serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillText('🍃', x, y + 8);
            
            // Sparkle effect
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(collectible.bounce * 2) * 0.3})`;
            this.ctx.font = '12px serif';
            this.ctx.fillText('✨', x + 15, y - 10);
            
            this.ctx.restore();
        });
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            if (particle.size > 8) {
                // Crumbling pieces as rectangles
                this.ctx.fillRect(particle.x - particle.size/2, particle.y - 6, particle.size, 12);
            } else {
                // Default particle as circle
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size || 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        });
    }
    
    renderPlayer() {
        this.ctx.save();
        
        // Player shadow
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = 'black';
        this.ctx.beginPath();
        this.ctx.ellipse(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height + 8,
            20, 6, 0, 0, Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        
        // Player rotation and position
        const centerX = this.player.x + this.player.width / 2;
        const centerY = this.player.y + this.player.height / 2;
        
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(this.player.rotation);
        
        // Tea cup with steam animation
        this.ctx.font = '40px serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#8D6E63';
        this.ctx.fillText('☕', 0, 15);
        
        // Steam effect when moving fast
        if (Math.abs(this.player.velY) > 10) {
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillStyle = '#E0E0E0';
            this.ctx.font = '16px serif';
            this.ctx.fillText('💨', -25, -15);
            this.ctx.fillText('💨', 25, -10);
        }
        
        this.ctx.restore();
    }
    
    updateDisplays() {
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('tokenCount').textContent = this.tokens;
        document.getElementById('highScore').textContent = this.highScore;
    }
    
    getHighScore() {
        return parseInt(localStorage.getItem('teaJumpHighScore')) || 0;
    }
    
    saveHighScore() {
        localStorage.setItem('teaJumpHighScore', this.highScore.toString());
    }
    
    getStoredTokens() {
        return parseInt(localStorage.getItem('teaJumpTokens')) || 0;
    }
    
    saveTokens() {
        localStorage.setItem('teaJumpTokens', this.tokens.toString());
    }
    
    gameLoop() {
        if (this.gameState === 'playing') {
            this.update();
            this.render();
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Initialize the game when page loads
let game;
window.addEventListener('load', () => {
    game = new TeaJumpGame();
});

// Prevent zoom on mobile
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

// Prevent context menu on long press
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
});