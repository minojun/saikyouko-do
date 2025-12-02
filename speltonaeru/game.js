// キャンバスとコンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 画面の設定
const SCREEN_WIDTH = 1000;
const SCREEN_HEIGHT = 400;
const FPS = 60;
const DIVIDER_Y = SCREEN_HEIGHT / 2; // 画面の中央（区切り線）

// 色の定義
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const RED = '#FF0000';
const GREEN = '#00FF00';
const KEY_COLOR = '#E8E8E8';
const KEY_BORDER = '#CCCCCC';

// プレイヤーの設定
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 3;

// 敵と弾の設定
const ENEMY_SIZE = 30;
const ENEMY_X = SCREEN_WIDTH / 2; // 画面中央
const ENEMY_Y = 30; // 画面上部
const BULLET_SIZE = 8;
const BULLET_SPEED = 1; // 弾の速度を遅く
const BULLET_SPAWN_INTERVAL = 90; // フレーム数（弾幕発射間隔）
const BULLET_COUNT_HARD = 8; // 一度に発射する弾の数（hard）
const BULLET_COUNT_EASY = 4; // 一度に発射する弾の数（easy）
const BULLET_SPREAD_ANGLE = Math.PI * 0.6; // 弾幕の広がり角度（ラジアン）
let bulletSpawnTimer = 0;

// 難易度設定
const DIFFICULTY = {
    EASY: 'easy',
    HARD: 'hard'
};
let selectedDifficulty = null; // 選択された難易度（null = 未選択）
let hoveredDifficultyIndex = null; // ホバー中の難易度のインデックス
const bullets = []; // 弾の配列
let gameOver = false;
let isPaused = false;

        // 敵の体力設定
        const ENEMY_MAX_HP = 10; // 敵の最大体力
let enemyHP = ENEMY_MAX_HP; // 敵の現在の体力

// 爆発演出の設定
let isExploding = false; // 爆発演出中かどうか
let explosionTimer = 0; // 爆発演出のタイマー
const EXPLOSION_DURATION = 60; // 爆発演出の継続時間（フレーム数）
const explosionParticles = []; // 爆発パーティクルの配列
let hasExploded = false; // 一度爆発演出が開始されたかどうか（敵の体力がリセットされるまで保持）

// 勝利画面の設定
let victoryStartTime = 0; // 勝利画面の開始時刻
const VICTORY_DELAY = 500; // 0.5秒後に移動開始（ミリ秒）
const VICTORY_ANIMATION_DURATION = 1000; // 移動アニメーションの継続時間（ミリ秒）
let victoryTextY = SCREEN_HEIGHT / 2; // 勝利テキストのY座標
const VICTORY_TO_REWARD_DELAY = VICTORY_DELAY + VICTORY_ANIMATION_DURATION; // 報酬フェーズへの移行タイミング

// ゲームの状態管理
const GAME_STATE = {
    BATTLE: 'battle',  // 戦闘パート
    EXPLORATION: 'exploration',  // 探索パート
    REWARD: 'reward'  // 報酬フェーズ
};
let currentGameState = GAME_STATE.EXPLORATION;

// キーの設定
const KEY_WIDTH = 50;
const KEY_HEIGHT = 50;
const KEY_SPACING = 5;
const ROW_SPACING = 10;

// キーボード配列の定義（QWERTY配列）
const KEYBOARD_LAYOUT = [
    // 上段
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    // 中段
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    // 下段
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

// 各キーの領域を生成
const KEY_AREAS = {};
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

// まず、現在のレイアウトで全体の幅を計算（基準位置100から）
let tempMinX = Infinity, tempMaxX = -Infinity;
KEYBOARD_LAYOUT.forEach((row, rowIndex) => {
    const tempStartX = 100 + (rowIndex === 1 ? KEY_WIDTH / 2 : rowIndex === 2 ? KEY_WIDTH * 1.5 : 0);
    const rowWidth = row.length * KEY_WIDTH + (row.length - 1) * KEY_SPACING;
    tempMinX = Math.min(tempMinX, tempStartX);
    tempMaxX = Math.max(tempMaxX, tempStartX + rowWidth);
});
// 全体の中心を画面の中心に合わせる
const currentCenter = (tempMinX + tempMaxX) / 2;
const screenCenter = SCREEN_WIDTH / 2;
const centerOffset = screenCenter - currentCenter;

KEYBOARD_LAYOUT.forEach((row, rowIndex) => {
    const baseX = 100 + (rowIndex === 1 ? KEY_WIDTH / 2 : rowIndex === 2 ? KEY_WIDTH * 1.5 : 0);
    const startX = baseX + centerOffset;
    // 画面の下半分（区切り線の下）に配置
    const startY = DIVIDER_Y + 20 + rowIndex * (KEY_HEIGHT + ROW_SPACING);
    
    row.forEach((key, keyIndex) => {
        const x = startX + keyIndex * (KEY_WIDTH + KEY_SPACING);
        const y = startY;
        
        KEY_AREAS[key] = {
            x: x,
            y: y,
            width: KEY_WIDTH,
            height: KEY_HEIGHT,
            label: key
        };
        
        // 移動可能領域の境界を計算
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + KEY_WIDTH);
        maxY = Math.max(maxY, y + KEY_HEIGHT);
    });
});

// 共通の移動可能領域（全キー領域を含む、マージンを追加して広めに）
const MARGIN = KEY_WIDTH; // キー1つ分のマージンを追加
const COMMON_AREA = {
    x: minX - MARGIN,
    y: minY - MARGIN,
    width: (maxX - minX) + MARGIN * 2,
    height: (maxY - minY) + MARGIN * 2
};

// プレイヤークラス
class Player {
    constructor(x, y) {
        this.x = x; // 中心X座標
        this.y = y; // 中心Y座標
        this.radius = PLAYER_SIZE / 2; // 半径
        
        // ダッシュ関連のプロパティ
        this.isDashing = false; // ダッシュ中かどうか
        this.dashCooldown = 0; // ダッシュのクールダウン（フレーム数）
        this.dashVelocity = { x: 0, y: 0 }; // ダッシュの速度ベクトル
        this.dashDuration = 0; // ダッシュの持続時間（フレーム数）
        this.dashSpeed = PLAYER_SPEED * 3; // ダッシュの速度（通常の3倍）
        this.dashMaxDuration = 10; // ダッシュの最大持続時間（フレーム数）
        this.dashCooldownDuration = 6; // ダッシュのクールダウン時間（0.1秒 = 約6フレーム、60fps想定）
        this.wasShiftPressed = false; // 前フレームでシフトキーが押されていたか
        this.decelerationFrames = 0; // 減速中のフレーム数
        this.initialDashVelocity = { x: 0, y: 0 }; // ダッシュ終了時の初期速度（減速用）
    }

            update(keys) {
                // 単語表示モーダルが開いている場合は移動しない
                const isWordModalOpen = wordModal.style.display === 'flex';
                if (isWordModalOpen || isPaused) {
                    return;
                }
                
                // 移動前の位置を保存
                const oldX = this.x;
                const oldY = this.y;

                // シフトキーの状態を確認
                const isShiftPressed = keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight'];
                const shiftJustPressed = isShiftPressed && !this.wasShiftPressed;
                this.wasShiftPressed = isShiftPressed;

                // クールダウンの更新
                if (this.dashCooldown > 0) {
                    this.dashCooldown--;
                }

                // ダッシュの処理
                if (this.isDashing) {
                    // ダッシュ中の移動
                    this.x += this.dashVelocity.x;
                    this.y += this.dashVelocity.y;
                    
                    // ダッシュの持続時間を減らす
                    this.dashDuration--;
                    
                    // ダッシュ終了処理
                    if (this.dashDuration <= 0) {
                        this.isDashing = false;
                        // クールダウンを開始（減速中も含む）
                        this.dashCooldown = this.dashCooldownDuration;
                    }
                } else {
                    // 通常の移動処理
                    // ブーツの効果で移動速度を倍率適用
                    const currentSpeed = PLAYER_SPEED * playerItems.speedMultiplier;
                    
                    // 移動方向を記録（ダッシュ用）
                    let moveX = 0;
                    let moveY = 0;
                    
                    if (keys['w'] || keys['W'] || keys['ArrowUp']) {
                        moveY -= currentSpeed;
                        this.y -= currentSpeed;
                    }
                    if (keys['s'] || keys['S'] || keys['ArrowDown']) {
                        moveY += currentSpeed;
                        this.y += currentSpeed;
                    }
                    if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
                        moveX -= currentSpeed;
                        this.x -= currentSpeed;
                    }
                    if (keys['d'] || keys['D'] || keys['ArrowRight']) {
                        moveX += currentSpeed;
                        this.x += currentSpeed;
                    }
                    
                    // シフトキーを押した瞬間にダッシュ開始（クールダウン中でない場合のみ、移動中の場合のみ）
                    if (shiftJustPressed && this.dashCooldown === 0 && (moveX !== 0 || moveY !== 0)) {
                        // 移動方向を正規化
                        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
                        if (magnitude > 0) {
                            const normalizedX = moveX / magnitude;
                            const normalizedY = moveY / magnitude;
                            
                            // ダッシュの速度ベクトルを設定
                            this.dashVelocity.x = normalizedX * this.dashSpeed * playerItems.speedMultiplier;
                            this.dashVelocity.y = normalizedY * this.dashSpeed * playerItems.speedMultiplier;
                            
                            this.isDashing = true;
                            this.dashDuration = this.dashMaxDuration;
                        }
                    }
                    
                    // 減速中の処理（ダッシュ終了後、速度が残っている場合）
                    if (!this.isDashing && this.decelerationFrames > 0) {
                        // 線形に減速：0.1秒（6フレーム）かけて速度を0にする
                        const progress = 1 - (this.decelerationFrames / this.dashCooldownDuration);
                        this.dashVelocity.x = this.initialDashVelocity.x * (1 - progress);
                        this.dashVelocity.y = this.initialDashVelocity.y * (1 - progress);
                        
                        this.x += this.dashVelocity.x;
                        this.y += this.dashVelocity.y;
                        
                        this.decelerationFrames--;
                        
                        // 減速が終了したら速度を0にする
                        if (this.decelerationFrames <= 0) {
                            this.dashVelocity.x = 0;
                            this.dashVelocity.y = 0;
                            this.initialDashVelocity.x = 0;
                            this.initialDashVelocity.y = 0;
                        }
                    }
                }

        // 移動可能領域内に制限（円形の判定）
        if (this.x - this.radius < COMMON_AREA.x || 
            this.y - this.radius < COMMON_AREA.y || 
            this.x + this.radius > COMMON_AREA.x + COMMON_AREA.width ||
            this.y + this.radius > COMMON_AREA.y + COMMON_AREA.height) {
            this.x = oldX;
            this.y = oldY;
        }
    }

    draw() {
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    getCenterX() {
        return this.x;
    }

    getCenterY() {
        return this.y;
    }

    getCircle() {
        return {
            x: this.x,
            y: this.y,
            radius: this.radius
        };
    }
}

// 弾のクラス
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        // 指定された角度で発射
        this.vx = Math.cos(angle) * BULLET_SPEED;
        this.vy = Math.sin(angle) * BULLET_SPEED;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(this.x, this.y, BULLET_SIZE, 0, Math.PI * 2);
        ctx.fill();
    }

    isOffScreen() {
        return this.x < 0 || this.x > SCREEN_WIDTH || 
               this.y < 0 || this.y > SCREEN_HEIGHT;
    }

    getRect() {
        return {
            x: this.x - BULLET_SIZE,
            y: this.y - BULLET_SIZE,
            width: BULLET_SIZE * 2,
            height: BULLET_SIZE * 2
        };
    }

    getCircle() {
        return {
            x: this.x,
            y: this.y,
            radius: BULLET_SIZE
        };
    }
}

// 衝突判定（矩形と矩形）
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 円と円の衝突判定
function checkCircleCollision(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (circle1.radius + circle2.radius);
}

// 爆発パーティクルのクラス
class ExplosionParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 3 + Math.random() * 5;
        this.life = 1.0; // パーティクルの寿命（1.0から0.0へ減少）
        this.decay = 0.02 + Math.random() * 0.03; // 寿命の減少速度
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.98; // 減速
        this.vy *= 0.98;
    }

    draw() {
        if (this.life > 0) {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = `hsl(${Math.random() * 60}, 100%, 50%)`; // オレンジから黄色
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    isDead() {
        return this.life <= 0;
    }
}

// 爆発演出を開始する関数
function startExplosion() {
    if (!isExploding && !hasExploded) {
        isExploding = true;
        hasExploded = true;
        explosionTimer = 0;
        explosionParticles.length = 0;
        
        // パーティクルを生成
        for (let i = 0; i < 30; i++) {
            const offsetX = (Math.random() - 0.5) * ENEMY_SIZE;
            const offsetY = (Math.random() - 0.5) * ENEMY_SIZE;
            explosionParticles.push(new ExplosionParticle(ENEMY_X + offsetX, ENEMY_Y + offsetY));
        }
    }
}

// 領域判定関数
function getAreaLabel(x, y) {
    for (const [key, area] of Object.entries(KEY_AREAS)) {
        if (x >= area.x && x <= area.x + area.width &&
            y >= area.y && y <= area.y + area.height) {
            return key;
        }
    }
    return null;
}

// キーの描画
function drawKey(area) {
    // キーの背景
    ctx.fillStyle = KEY_COLOR;
    ctx.fillRect(area.x, area.y, area.width, area.height);
    
    // キーの枠線
    ctx.strokeStyle = KEY_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    
    // アルファベットの描画
    ctx.fillStyle = BLACK;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        area.label,
        area.x + area.width / 2,
        area.y + area.height / 2
    );
}

// ゲームの初期化（Aキーの位置から開始）
const player = new Player(
    KEY_AREAS['A'].x + KEY_AREAS['A'].width / 2,
    KEY_AREAS['A'].y + KEY_AREAS['A'].height / 2
);

// 踏んだ領域の履歴
const visitedAreas = [];
let previousArea = null;

// テーマ別の単語プール
const wordThemes = {
    fruit: [ // 果物類
        {english: 'apple', japanese: 'りんご'},
        {english: 'banana', japanese: 'バナナ'},
        {english: 'orange', japanese: 'オレンジ'},
        {english: 'grape', japanese: 'ぶどう'},
        {english: 'melon', japanese: 'メロン'},
        {english: 'cherry', japanese: 'さくらんぼ'},
        {english: 'peach', japanese: 'もも'},
        {english: 'mango', japanese: 'マンゴー'},
        {english: 'kiwi', japanese: 'キウイ'},
        {english: 'lemon', japanese: 'レモン'}
    ],
    job: [ // 職業類
        {english: 'teacher', japanese: '教師'},
        {english: 'doctor', japanese: '医者'},
        {english: 'nurse', japanese: '看護師'},
        {english: 'engineer', japanese: 'エンジニア'},
        {english: 'cook', japanese: '料理人'},
        {english: 'pilot', japanese: 'パイロット'},
        {english: 'artist', japanese: '芸術家'},
        {english: 'writer', japanese: '作家'},
        {english: 'singer', japanese: '歌手'},
        {english: 'farmer', japanese: '農家'}
    ],
    food: [ // 食べ物類
        {english: 'bread', japanese: 'パン'},
        {english: 'rice', japanese: 'ご飯'},
        {english: 'soup', japanese: 'スープ'},
        {english: 'pizza', japanese: 'ピザ'},
        {english: 'pasta', japanese: 'パスタ'},
        {english: 'salad', japanese: 'サラダ'},
        {english: 'steak', japanese: 'ステーキ'},
        {english: 'sushi', japanese: '寿司'},
        {english: 'curry', japanese: 'カレー'},
        {english: 'sandwich', japanese: 'サンドイッチ'}
    ]
};

// テーマの定義
const themes = [
    {id: 'fruit', name: '果物類'},
    {id: 'job', name: '職業類'},
    {id: 'food', name: '食べ物類'}
];

// 出現しうる単語リスト（戦闘パートで使用される単語）
let words = []; // 初期状態は空（探索パートで単語を入手してから使用）
let currentWordIndex = 0; // 単語が追加されたら更新される
let currentCharIndex = 0; // 現在入力中の文字位置
const completedChars = []; // 正しく入力された文字の位置を記録
let wordCompleted = false; // 単語完成フラグ
let wordCompletedTime = 0; // 単語完成時刻
const COMPLETION_DISPLAY_TIME = 300; // 完成表示時間（ミリ秒）

// 探索パート用の変数
let selectedThemeIndex = null; // 選択されたテーマのインデックス
let hoveredThemeIndex = null; // マウスホバー中のテーマのインデックス
let selectedThemeWords = []; // 選択されたテーマから選ばれた3単語
let selectedWordIndex = null; // 選択された単語のインデックス（selectedThemeWords内でのインデックス）
let hoveredWordIndex = null; // マウスホバー中の単語のインデックス

// 報酬フェーズ用の変数
let firstSelectedThemeIndex = null; // 最初に選んだテーマのインデックス（報酬フェーズで使用）
let rewardWords = []; // 報酬フェーズで表示する3単語
let selectedRewardWordIndex = null; // 選択された報酬単語のインデックス
let hoveredRewardWordIndex = null; // マウスホバー中の報酬単語のインデックス
let rewardPhase = 'word'; // 報酬フェーズの段階: 'word' (単語選択) または 'item' (アイテム選択)
let rewardItems = []; // 報酬フェーズで表示する3アイテム
let selectedRewardItemIndex = null; // 選択された報酬アイテムのインデックス
let hoveredRewardItemIndex = null; // マウスホバー中の報酬アイテムのインデックス

// アイテムの定義
const ITEMS = [
    {
        id: 'pendant',
        name: 'ペンダント',
        description: '敵に与えるダメージが+1される',
        effect: 'damage_boost'
    },
    {
        id: 'boots',
        name: 'ブーツ',
        description: '自分の移動速度が1.5倍になる',
        effect: 'speed_boost'
    },
    {
        id: 'capsule',
        name: 'カプセル',
        description: '自分の残機を+1する（一回まで被弾してもゲームオーバーにならなくなる）',
        effect: 'extra_life'
    }
];

// プレイヤーのアイテム効果
let playerItems = {
    damageBoost: 0, // ダメージ増加
    speedMultiplier: 1.0, // 移動速度倍率
    extraLives: 0 // 残機数
};

// キー入力の管理
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    // エスケープキーでポーズ/再開
    if (e.key === 'Escape') {
        if (!gameOver) {
            isPaused = !isPaused;
        }
    }
    // スペースキーでゲームリセット（ゲームオーバー時のみ）
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // ページスクロールを防ぐ
        if (gameOver) {
            resetGame();
        }
    }
    // 矢印キーでページスクロールを防ぐ
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
    }
            // 探索パートでキー入力処理
            if (currentGameState === GAME_STATE.EXPLORATION) {
                const keyNum = parseInt(e.key);
                // 難易度が選択されていない場合：1, 2キーで難易度を選択
                if (selectedDifficulty === null) {
                    if (keyNum === 1) {
                        selectedDifficulty = DIFFICULTY.EASY;
                    } else if (keyNum === 2) {
                        selectedDifficulty = DIFFICULTY.HARD;
                    }
                } else if (selectedThemeIndex === null) {
                    // テーマが選択されていない場合：1, 2, 3キーでテーマを選択
                    if (keyNum >= 1 && keyNum <= 3 && themes.length >= keyNum) {
                        selectTheme(keyNum - 1);
                    }
                } else {
                    // テーマが選択されている場合：1, 2, 3キーで単語を選択（3は単語ボックス）
                    if (keyNum >= 1 && keyNum <= 3) {
                        if (keyNum <= 2 && selectedThemeWords.length >= keyNum) {
                            selectWord(keyNum - 1);
                        } else if (keyNum === 3) {
                            selectWord(2); // 単語ボックス
                        }
                    }
                }
            }
            // 報酬フェーズでキー入力処理
            if (currentGameState === GAME_STATE.REWARD) {
                const keyNum = parseInt(e.key);
                if (rewardPhase === 'word' && keyNum >= 1 && keyNum <= 3) {
                    if (keyNum <= 2 && rewardWords.length >= keyNum) {
                        selectRewardWord(keyNum - 1);
                    } else if (keyNum === 3) {
                        selectRewardWord(2); // 単語ボックス
                    }
                } else if (rewardPhase === 'item' && keyNum >= 1 && keyNum <= 3 && rewardItems.length >= keyNum) {
                    selectRewardItem(keyNum - 1);
                }
            }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 単語リストをモーダルに表示する関数
function updateWordModal() {
    const wordModalList = document.getElementById('wordModalList');
    wordModalList.innerHTML = '';
    words.forEach((word, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${word.japanese} (${word.english.toUpperCase()})`;
        wordModalList.appendChild(li);
    });
}

// デバッグメニューのボタンイベント
const wordListBtn = document.getElementById('wordListBtn');
const damageBtn = document.getElementById('damageBtn');
const wordModal = document.getElementById('wordModal');
const closeWordModal = document.getElementById('closeWordModal');

// 探索パートでテーマを選択する関数
function selectTheme(index) {
    if (index >= 0 && index < themes.length) {
        selectedThemeIndex = index;
        // 最初に選んだテーマを記録（報酬フェーズで使用）
        if (firstSelectedThemeIndex === null) {
            firstSelectedThemeIndex = index;
        }
        const selectedTheme = themes[index];
        const themeWords = wordThemes[selectedTheme.id];
        
        // テーマの単語から、既に追加されていない単語を取得
        const availableWords = themeWords.filter(word => 
            !words.some(w => w.english === word.english && w.japanese === word.japanese)
        );
        
        // 利用可能な単語から2つをランダムに選択して表示
        const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
        selectedThemeWords = shuffled.slice(0, Math.min(2, availableWords.length));
        
        // 単語選択状態をリセット
        selectedWordIndex = null;
        hoveredWordIndex = null;
    }
}

// 探索パートで単語を選択する関数
function selectWord(index) {
    // インデックス2は単語ボックス
    if (index === 2) {
        // 単語ボックス：最初に選んだテーマからランダムに5単語を追加
        if (firstSelectedThemeIndex !== null) {
            const rewardTheme = themes[firstSelectedThemeIndex];
            const themeWords = wordThemes[rewardTheme.id];
            
            // テーマの単語から、既に追加されていない単語を取得
            const availableWords = themeWords.filter(word => 
                !words.some(w => w.english === word.english && w.japanese === word.japanese)
            );
            
            // 利用可能な単語から5つをランダムに選択
            const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
            const wordsToAdd = shuffled.slice(0, Math.min(5, availableWords.length));
            
            // 単語を追加
            wordsToAdd.forEach(word => {
                const exists = words.some(w => w.english === word.english && w.japanese === word.japanese);
                if (!exists) {
                    words.push(word);
                }
            });
        }
        
        // 戦闘パートに切り替え
        currentGameState = GAME_STATE.BATTLE;
        // 戦闘パートの状態をリセット
        currentCharIndex = 0;
        completedChars.length = 0;
        wordCompleted = false;
        gameOver = false;
        bullets.length = 0;
        bulletSpawnTimer = 0;
        enemyHP = ENEMY_MAX_HP; // 敵の体力をリセット
        hasExploded = false; // 爆発フラグをリセット
    } else if (index >= 0 && index < selectedThemeWords.length) {
        // 通常の単語を選択
        const selectedWord = selectedThemeWords[index];
        
        // 既にリストに含まれていないか確認して追加
        const exists = words.some(w => w.english === selectedWord.english && w.japanese === selectedWord.japanese);
        if (!exists) {
            words.push(selectedWord);
        }
        
        // 選択された単語を戦闘パートで使用するように設定
        currentWordIndex = words.findIndex(w => w.english === selectedWord.english && w.japanese === selectedWord.japanese);
        
        // 戦闘パートに切り替え
        currentGameState = GAME_STATE.BATTLE;
        // 戦闘パートの状態をリセット
        currentCharIndex = 0;
        completedChars.length = 0;
        wordCompleted = false;
        gameOver = false;
        bullets.length = 0;
        bulletSpawnTimer = 0;
        enemyHP = ENEMY_MAX_HP; // 敵の体力をリセット
        hasExploded = false; // 爆発フラグをリセット
    }
}

// 探索パートに入ったときに選択状態をリセット
function resetExplorationState() {
    selectedThemeIndex = null;
    hoveredThemeIndex = null;
    selectedThemeWords = [];
    selectedWordIndex = null;
    hoveredWordIndex = null;
}

// 報酬フェーズ用の単語を生成する関数
function generateRewardWords() {
    if (firstSelectedThemeIndex !== null) {
        const rewardTheme = themes[firstSelectedThemeIndex];
        const themeWords = wordThemes[rewardTheme.id];
        
        // テーマの単語から、既に追加されていない単語を取得
        const availableWords = themeWords.filter(word => 
            !words.some(w => w.english === word.english && w.japanese === word.japanese)
        );
        
        // 利用可能な単語から2つをランダムに選択
        const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
        rewardWords = shuffled.slice(0, Math.min(2, availableWords.length));
        
        // 報酬選択状態をリセット
        selectedRewardWordIndex = null;
        hoveredRewardWordIndex = null;
    }
}

// 報酬フェーズで単語を選択する関数
function selectRewardWord(index) {
    // インデックス2は単語ボックス
    if (index === 2) {
        // 単語ボックス：最初に選んだテーマからランダムに5単語を追加
        if (firstSelectedThemeIndex !== null) {
            const rewardTheme = themes[firstSelectedThemeIndex];
            const themeWords = wordThemes[rewardTheme.id];
            
            // テーマの単語から、既に追加されていない単語を取得
            const availableWords = themeWords.filter(word => 
                !words.some(w => w.english === word.english && w.japanese === word.japanese)
            );
            
            // 利用可能な単語から5つをランダムに選択
            const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
            const wordsToAdd = shuffled.slice(0, Math.min(5, availableWords.length));
            
            // 単語を追加
            wordsToAdd.forEach(word => {
                const exists = words.some(w => w.english === word.english && w.japanese === word.japanese);
                if (!exists) {
                    words.push(word);
                }
            });
        }
        
        // アイテム選択フェーズに移行
        rewardPhase = 'item';
        generateRewardItems();
    } else if (index >= 0 && index < rewardWords.length) {
        // 通常の単語を選択
        const selectedWord = rewardWords[index];
        
        // 既にリストに含まれていないか確認して追加
        const exists = words.some(w => w.english === selectedWord.english && w.japanese === selectedWord.japanese);
        if (!exists) {
            words.push(selectedWord);
        }
        
        // アイテム選択フェーズに移行
        rewardPhase = 'item';
        generateRewardItems();
    }
}

// 報酬フェーズ用のアイテムを生成する関数
function generateRewardItems() {
    // 3つのアイテムをランダムに選択
    const shuffled = [...ITEMS].sort(() => Math.random() - 0.5);
    rewardItems = shuffled.slice(0, 3);
    
    // アイテム選択状態をリセット
    selectedRewardItemIndex = null;
    hoveredRewardItemIndex = null;
}

// 報酬フェーズでアイテムを選択する関数
function selectRewardItem(index) {
    if (index >= 0 && index < rewardItems.length) {
        const selectedItem = rewardItems[index];
        
        // アイテムの効果を適用
        switch (selectedItem.effect) {
            case 'damage_boost':
                playerItems.damageBoost += 1;
                break;
            case 'speed_boost':
                playerItems.speedMultiplier = 1.5;
                break;
            case 'extra_life':
                playerItems.extraLives += 1;
                break;
        }
        
        // 報酬フェーズ終了後、戦闘パートに戻る
        currentGameState = GAME_STATE.BATTLE;
        // 戦闘パートの状態をリセット
        currentCharIndex = 0;
        completedChars.length = 0;
        wordCompleted = false;
        gameOver = false;
        bullets.length = 0;
        bulletSpawnTimer = 0;
        enemyHP = ENEMY_MAX_HP; // 敵の体力をリセット
        hasExploded = false; // 爆発フラグをリセット
        // 勝利画面をリセット
        victoryStartTime = 0;
        victoryTextY = SCREEN_HEIGHT / 2;
        rewardPhase = 'word';
    }
}

// ゲームを完全にリセットする関数
function resetGame() {
    // 単語リストをリセット
    words = [];
    currentWordIndex = 0;
    currentCharIndex = 0;
    completedChars.length = 0;
    wordCompleted = false;
    wordCompletedTime = 0;
    
    // 探索パートに戻す
    currentGameState = GAME_STATE.EXPLORATION;
    resetExplorationState();
    // 難易度をリセット（再選択可能にする）
    selectedDifficulty = null;
    hoveredDifficultyIndex = null;
    
    // ゲーム状態をリセット
    gameOver = false;
    isPaused = false;
    
    // 弾をクリア
    bullets.length = 0;
    bulletSpawnTimer = 0;
    
    // 敵の体力をリセット
    enemyHP = ENEMY_MAX_HP;
    
    // プレイヤーの位置をリセット（Aキーの位置）
    player.x = KEY_AREAS['A'].x + KEY_AREAS['A'].width / 2;
    player.y = KEY_AREAS['A'].y + KEY_AREAS['A'].height / 2;
    
    // 領域履歴をリセット
    visitedAreas.length = 0;
    previousArea = null;
    
    // 爆発演出をリセット
    isExploding = false;
    hasExploded = false;
    explosionTimer = 0;
    explosionParticles.length = 0;
    
    // 勝利画面をリセット
    victoryStartTime = 0;
    victoryTextY = SCREEN_HEIGHT / 2;
    
    // 報酬フェーズをリセット
    rewardWords = [];
    selectedRewardWordIndex = null;
    hoveredRewardWordIndex = null;
    firstSelectedThemeIndex = null;
    rewardPhase = 'word';
    rewardItems = [];
    selectedRewardItemIndex = null;
    hoveredRewardItemIndex = null;
    
    // アイテムをリセット
    playerItems = {
        damageBoost: 0,
        speedMultiplier: 1.0,
        extraLives: 0
    };
}


// 単語表示ボタンのイベント
wordListBtn.addEventListener('click', () => {
    updateWordModal();
    wordModal.style.display = 'flex';
});

// ダメージボタンのイベント
damageBtn.addEventListener('click', () => {
    if (currentGameState === GAME_STATE.BATTLE && enemyHP > 0) {
        enemyHP = Math.max(0, enemyHP - 50);
    }
});

// 閉じるボタンのイベント
closeWordModal.addEventListener('click', () => {
    wordModal.style.display = 'none';
});

// モーダルの背景をクリックしても閉じる
wordModal.addEventListener('click', (e) => {
    if (e.target === wordModal) {
        wordModal.style.display = 'none';
    }
});

// 探索パートの描画
function drawExplorationPart() {
    // 画面のクリア
    ctx.fillStyle = '#E8F5E9';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 難易度が選択されていない場合は難易度選択画面を表示
    if (selectedDifficulty === null) {
        // タイトル
        ctx.fillStyle = BLACK;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('難易度を選択してください', SCREEN_WIDTH / 2, 80);

        // 説明文
        ctx.font = '20px Arial';
        ctx.fillText('クリックまたは1, 2キーで選択', SCREEN_WIDTH / 2, 120);

        // 2つの難易度を表示
        const difficultyBoxWidth = 300;
        const difficultyBoxHeight = 150;
        const difficultyBoxSpacing = 50;
        const totalWidth = difficultyBoxWidth * 2 + difficultyBoxSpacing;
        const startX = (SCREEN_WIDTH - totalWidth) / 2;
        const startY = SCREEN_HEIGHT / 2 - difficultyBoxHeight / 2;

        const difficulties = [
            { name: 'EASY', description: 'ゲーム初心者向け' },
            { name: 'HARD', description: '熟練者向け' }
        ];

        difficulties.forEach((difficulty, index) => {
            const x = startX + index * (difficultyBoxWidth + difficultyBoxSpacing);
            const y = startY;

            // ホバー状態の判定
            const isHovered = hoveredDifficultyIndex === index;

            // ボックスの背景色
            if (isHovered) {
                ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
            } else {
                ctx.fillStyle = WHITE; // 通常は白
            }
            ctx.fillRect(x, y, difficultyBoxWidth, difficultyBoxHeight);

            // ボックスの枠線
            ctx.strokeStyle = isHovered ? '#FBC02D' : '#CCCCCC';
            ctx.lineWidth = isHovered ? 4 : 2;
            ctx.strokeRect(x, y, difficultyBoxWidth, difficultyBoxHeight);

            // 番号表示
            ctx.fillStyle = BLACK;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x + difficultyBoxWidth / 2, y + 30);

            // 難易度名
            ctx.font = 'bold 36px Arial';
            ctx.fillText(difficulty.name, x + difficultyBoxWidth / 2, y + 80);

            // 説明文
            ctx.font = '18px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(difficulty.description, x + difficultyBoxWidth / 2, y + 120);
        });

        return;
    }

    // 探索パートのタイトル
    ctx.fillStyle = BLACK;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('探索パート', SCREEN_WIDTH / 2, 50);

    // テーマが選択されていない場合：テーマ選択画面
    if (selectedThemeIndex === null) {
        // 説明文
        ctx.font = '20px Arial';
        ctx.fillText('テーマを1つ選択してください（クリックまたは1, 2, 3キー）', SCREEN_WIDTH / 2, 90);

        // 3つのテーマを表示
        const themeBoxWidth = 250;
        const themeBoxHeight = 120;
        const themeBoxSpacing = 30;
        const totalWidth = themeBoxWidth * themes.length + themeBoxSpacing * (themes.length - 1);
        const startX = (SCREEN_WIDTH - totalWidth) / 2;
        const startY = SCREEN_HEIGHT / 2 - themeBoxHeight / 2;

        themes.forEach((theme, index) => {
            const x = startX + index * (themeBoxWidth + themeBoxSpacing);
            const y = startY;

            // ホバーまたは選択状態の判定
            const isHovered = hoveredThemeIndex === index;
            const isSelected = selectedThemeIndex === index;

            // テーマの利用可能な単語数を確認
            const themeWords = wordThemes[theme.id];
            const availableCount = themeWords.filter(word => 
                !words.some(w => w.english === word.english && w.japanese === word.japanese)
            ).length;

            // ボックスの背景色
            if (isSelected) {
                ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
            } else if (isHovered) {
                ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
            } else {
                ctx.fillStyle = WHITE; // 通常は白
            }
            ctx.fillRect(x, y, themeBoxWidth, themeBoxHeight);

            // ボックスの枠線
            ctx.strokeStyle = isSelected ? GREEN : (isHovered ? '#FBC02D' : '#CCCCCC');
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.strokeRect(x, y, themeBoxWidth, themeBoxHeight);

            // 番号表示
            ctx.fillStyle = BLACK;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x + themeBoxWidth / 2, y + 30);

            // テーマ名
            ctx.font = 'bold 32px Arial';
            ctx.fillText(theme.name, x + themeBoxWidth / 2, y + 70);

            // 利用可能な単語数（小さく）
            ctx.font = '18px Arial';
            ctx.fillStyle = availableCount > 0 ? '#666666' : '#CC0000';
            ctx.fillText(`利用可能: ${availableCount}単語`, x + themeBoxWidth / 2, y + 100);
        });
    } else {
        // テーマが選択されている場合：単語選択画面
        const selectedTheme = themes[selectedThemeIndex];
        
        // 説明文
        ctx.font = '20px Arial';
        ctx.fillText(`${selectedTheme.name}から単語を1つ選択してください（クリックまたは1, 2, 3キー）`, SCREEN_WIDTH / 2, 90);
        ctx.fillText('選択した単語が「出現しうる単語」に追加されます', SCREEN_WIDTH / 2, 115);

        // 利用可能な単語がない場合のメッセージ
        if (selectedThemeWords.length === 0) {
            ctx.font = '24px Arial';
            ctx.fillText('このテーマの単語はすべて追加済みです', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
            return;
        }

        // 2つの単語と1つの単語ボックスを表示（合計3つ）
        const wordBoxWidth = 250;
        const wordBoxHeight = 120;
        const wordBoxSpacing = 30;
        const totalCount = 3; // 2つの単語 + 1つの単語ボックス
        const totalWidth = wordBoxWidth * totalCount + wordBoxSpacing * (totalCount - 1);
        const startX = (SCREEN_WIDTH - totalWidth) / 2;
        const startY = SCREEN_HEIGHT / 2 - wordBoxHeight / 2;

        // 2つの単語を表示
        selectedThemeWords.forEach((word, index) => {
            const x = startX + index * (wordBoxWidth + wordBoxSpacing);
            const y = startY;

            // ホバーまたは選択状態の判定
            const isHovered = hoveredWordIndex === index;
            const isSelected = selectedWordIndex === index;

            // ボックスの背景色
            if (isSelected) {
                ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
            } else if (isHovered) {
                ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
            } else {
                ctx.fillStyle = WHITE; // 通常は白
            }
            ctx.fillRect(x, y, wordBoxWidth, wordBoxHeight);

            // ボックスの枠線
            ctx.strokeStyle = isSelected ? GREEN : (isHovered ? '#FBC02D' : '#CCCCCC');
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.strokeRect(x, y, wordBoxWidth, wordBoxHeight);

            // 番号表示
            ctx.fillStyle = BLACK;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x + wordBoxWidth / 2, y + 30);

            // 日本語の単語
            ctx.font = 'bold 32px Arial';
            ctx.fillText(word.japanese, x + wordBoxWidth / 2, y + 70);

            // 英語の単語（小さく）
            ctx.font = '20px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(word.english.toUpperCase(), x + wordBoxWidth / 2, y + 100);
        });

        // 単語ボックスを表示（インデックス2）
        const boxIndex = 2;
        const boxX = startX + boxIndex * (wordBoxWidth + wordBoxSpacing);
        const boxY = startY;

        // ホバーまたは選択状態の判定
        const isBoxHovered = hoveredWordIndex === boxIndex;
        const isBoxSelected = selectedWordIndex === boxIndex;

        // ボックスの背景色
        if (isBoxSelected) {
            ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
        } else if (isBoxHovered) {
            ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
        } else {
            ctx.fillStyle = WHITE; // 通常は白
        }
        ctx.fillRect(boxX, boxY, wordBoxWidth, wordBoxHeight);

        // ボックスの枠線
        ctx.strokeStyle = isBoxSelected ? GREEN : (isBoxHovered ? '#FBC02D' : '#CCCCCC');
        ctx.lineWidth = isBoxSelected ? 4 : 2;
        ctx.strokeRect(boxX, boxY, wordBoxWidth, wordBoxHeight);

        // 番号表示
        ctx.fillStyle = BLACK;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('3', boxX + wordBoxWidth / 2, boxY + 30);

        // 単語ボックス名
        ctx.font = 'bold 28px Arial';
        ctx.fillText('単語ボックス', boxX + wordBoxWidth / 2, boxY + 70);

        // 説明文（小さく）
        ctx.font = '18px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText('ランダムに5単語追加', boxX + wordBoxWidth / 2, boxY + 100);
    }
}

    // マウスイベントの処理（探索パートと報酬フェーズでのテーマ/単語選択）
    canvas.addEventListener('mousemove', (e) => {
        if (currentGameState === GAME_STATE.EXPLORATION) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 難易度が選択されていない場合は難易度選択のホバー処理
        if (selectedDifficulty === null) {
            const difficultyBoxWidth = 300;
            const difficultyBoxHeight = 150;
            const difficultyBoxSpacing = 50;
            const totalWidth = difficultyBoxWidth * 2 + difficultyBoxSpacing;
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = SCREEN_HEIGHT / 2 - difficultyBoxHeight / 2;

            hoveredDifficultyIndex = null;
            for (let i = 0; i < 2; i++) {
                const boxX = startX + i * (difficultyBoxWidth + difficultyBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + difficultyBoxWidth && y >= boxY && y <= boxY + difficultyBoxHeight) {
                    hoveredDifficultyIndex = i;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            if (hoveredDifficultyIndex === null) {
                canvas.style.cursor = 'default';
            }
            return;
        }

        if (selectedThemeIndex === null) {
            // テーマが選択されていない場合：テーマのホバー処理
            const themeBoxWidth = 250;
            const themeBoxHeight = 120;
            const themeBoxSpacing = 30;
            const totalWidth = themeBoxWidth * themes.length + themeBoxSpacing * (themes.length - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = SCREEN_HEIGHT / 2 - themeBoxHeight / 2;

            hoveredThemeIndex = null;
            for (let i = 0; i < themes.length; i++) {
                const boxX = startX + i * (themeBoxWidth + themeBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + themeBoxWidth && y >= boxY && y <= boxY + themeBoxHeight) {
                    hoveredThemeIndex = i;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            if (hoveredThemeIndex === null) {
                canvas.style.cursor = 'default';
            }
        } else {
            // テーマが選択されている場合：単語のホバー処理（2つの単語 + 1つの単語ボックス）
            const wordBoxWidth = 250;
            const wordBoxHeight = 120;
            const wordBoxSpacing = 30;
            const totalCount = 3; // 2つの単語 + 1つの単語ボックス
            const totalWidth = wordBoxWidth * totalCount + wordBoxSpacing * (totalCount - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = SCREEN_HEIGHT / 2 - wordBoxHeight / 2;

            hoveredWordIndex = null;
            // 2つの単語のホバー処理
            for (let i = 0; i < selectedThemeWords.length; i++) {
                const boxX = startX + i * (wordBoxWidth + wordBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                    hoveredWordIndex = i;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            // 単語ボックスのホバー処理（インデックス2）
            if (hoveredWordIndex === null) {
                const boxIndex = 2;
                const boxX = startX + boxIndex * (wordBoxWidth + wordBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                    hoveredWordIndex = boxIndex;
                    canvas.style.cursor = 'pointer';
                }
            }
            if (hoveredWordIndex === null) {
                canvas.style.cursor = 'default';
            }
        }
    } else if (currentGameState === GAME_STATE.REWARD) {
        // 報酬フェーズでのホバー処理
        // 描画と同じ座標計算を使用
        const elapsed = Date.now() - victoryStartTime;
        let victoryTextYPos = SCREEN_HEIGHT / 2;
        if (elapsed >= VICTORY_DELAY) {
            const animationElapsed = elapsed - VICTORY_DELAY;
            const progress = Math.min(animationElapsed / VICTORY_ANIMATION_DURATION, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const targetY = 50; // 画面上部の目標位置
            victoryTextYPos = SCREEN_HEIGHT / 2 + (targetY - SCREEN_HEIGHT / 2) * easeOut;
        }
        
        const descriptionY = victoryTextYPos + 100;
        
        if (rewardPhase === 'word') {
            // 単語選択フェーズのホバー処理（2つの単語 + 1つの単語ボックス）
            const wordBoxWidth = 250;
            const wordBoxHeight = 120;
            const wordBoxSpacing = 30;
            const totalCount = 3; // 2つの単語 + 1つの単語ボックス
            const totalWidth = wordBoxWidth * totalCount + wordBoxSpacing * (totalCount - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = descriptionY + 70; // 説明文の下に配置（描画と同じ）

            hoveredRewardWordIndex = null;
            // 2つの単語のホバー処理
            for (let i = 0; i < rewardWords.length; i++) {
                const boxX = startX + i * (wordBoxWidth + wordBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                    hoveredRewardWordIndex = i;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            // 単語ボックスのホバー処理（インデックス2）
            if (hoveredRewardWordIndex === null) {
                const boxIndex = 2;
                const boxX = startX + boxIndex * (wordBoxWidth + wordBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                    hoveredRewardWordIndex = boxIndex;
                    canvas.style.cursor = 'pointer';
                }
            }
            if (hoveredRewardWordIndex === null) {
                canvas.style.cursor = 'default';
            }
        } else if (rewardPhase === 'item') {
            // アイテム選択フェーズのホバー処理
            const itemBoxWidth = 280;
            const itemBoxHeight = 140;
            const itemBoxSpacing = 30;
            const totalWidth = itemBoxWidth * rewardItems.length + itemBoxSpacing * (rewardItems.length - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = descriptionY + 50; // 説明文の下に配置（描画と同じ）

            hoveredRewardItemIndex = null;
            for (let i = 0; i < rewardItems.length; i++) {
                const boxX = startX + i * (itemBoxWidth + itemBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + itemBoxWidth && y >= boxY && y <= boxY + itemBoxHeight) {
                    hoveredRewardItemIndex = i;
                    canvas.style.cursor = 'pointer';
                    break;
                }
            }
            if (hoveredRewardItemIndex === null) {
                canvas.style.cursor = 'default';
            }
        }
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (currentGameState === GAME_STATE.EXPLORATION) {
        // 難易度が選択されていない場合は難易度を選択
        if (selectedDifficulty === null) {
            if (hoveredDifficultyIndex !== null) {
                selectedDifficulty = hoveredDifficultyIndex === 0 ? DIFFICULTY.EASY : DIFFICULTY.HARD;
            }
        } else if (selectedThemeIndex === null) {
            // テーマが選択されていない場合：テーマを選択
            if (hoveredThemeIndex !== null) {
                selectTheme(hoveredThemeIndex);
            }
        } else {
            // テーマが選択されている場合：単語を選択
            if (hoveredWordIndex !== null) {
                selectWord(hoveredWordIndex);
            }
        }
    } else if (currentGameState === GAME_STATE.REWARD) {
        // 報酬フェーズで単語を選択
        // クリック座標から直接判定
        const elapsed = Date.now() - victoryStartTime;
        let victoryTextYPos = SCREEN_HEIGHT / 2;
        if (elapsed >= VICTORY_DELAY) {
            const animationElapsed = elapsed - VICTORY_DELAY;
            const progress = Math.min(animationElapsed / VICTORY_ANIMATION_DURATION, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const targetY = 50;
            victoryTextYPos = SCREEN_HEIGHT / 2 + (targetY - SCREEN_HEIGHT / 2) * easeOut;
        }
        
        const descriptionY = victoryTextYPos + 100;
        
        if (rewardPhase === 'word') {
            // 単語選択フェーズ（2つの単語 + 1つの単語ボックス）
            const wordBoxWidth = 250;
            const wordBoxHeight = 120;
            const wordBoxSpacing = 30;
            const totalCount = 3; // 2つの単語 + 1つの単語ボックス
            const totalWidth = wordBoxWidth * totalCount + wordBoxSpacing * (totalCount - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = descriptionY + 70;

            // 2つの単語のクリック処理
            for (let i = 0; i < rewardWords.length; i++) {
                const boxX = startX + i * (wordBoxWidth + wordBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                    selectRewardWord(i);
                    break;
                }
            }
            // 単語ボックスのクリック処理（インデックス2）
            const boxIndex = 2;
            const boxX = startX + boxIndex * (wordBoxWidth + wordBoxSpacing);
            const boxY = startY;
            if (x >= boxX && x <= boxX + wordBoxWidth && y >= boxY && y <= boxY + wordBoxHeight) {
                selectRewardWord(boxIndex);
            }
        } else if (rewardPhase === 'item') {
            // アイテム選択フェーズ
            const itemBoxWidth = 280;
            const itemBoxHeight = 140;
            const itemBoxSpacing = 30;
            const totalWidth = itemBoxWidth * rewardItems.length + itemBoxSpacing * (rewardItems.length - 1);
            const startX = (SCREEN_WIDTH - totalWidth) / 2;
            const startY = descriptionY + 50;

            for (let i = 0; i < rewardItems.length; i++) {
                const boxX = startX + i * (itemBoxWidth + itemBoxSpacing);
                const boxY = startY;
                if (x >= boxX && x <= boxX + itemBoxWidth && y >= boxY && y <= boxY + itemBoxHeight) {
                    selectRewardItem(i);
                    break;
                }
            }
        }
    }
});

// 報酬フェーズのオーバーレイ描画（戦闘パートの描画の上に重ねる）
function drawRewardOverlay() {
    // 半透明の黒を重ねる
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 勝利の文字を画面上部に表示（アニメーション完了後の位置）
    const elapsed = Date.now() - victoryStartTime;
    if (elapsed >= VICTORY_DELAY) {
        const animationElapsed = elapsed - VICTORY_DELAY;
        const progress = Math.min(animationElapsed / VICTORY_ANIMATION_DURATION, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const targetY = 50; // 画面上部の目標位置
        victoryTextY = SCREEN_HEIGHT / 2 + (targetY - SCREEN_HEIGHT / 2) * easeOut;
    }
    
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VICTORY!', SCREEN_WIDTH / 2, victoryTextY);
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('敵を倒しました！', SCREEN_WIDTH / 2, victoryTextY + 60);

    // 説明文（勝利の文字の下）
    ctx.font = '20px Arial';
    const descriptionY = victoryTextY + 100;
    
    if (rewardPhase === 'word') {
        // 単語選択フェーズ
        if (firstSelectedThemeIndex !== null) {
            const rewardTheme = themes[firstSelectedThemeIndex];
            ctx.fillText(`${rewardTheme.name}から単語を1つ選択してください（クリックまたは1, 2, 3キー）`, SCREEN_WIDTH / 2, descriptionY);
            ctx.fillText('選択した単語が「出現しうる単語」に追加されます', SCREEN_WIDTH / 2, descriptionY + 25);
        }

        // 利用可能な単語がない場合のメッセージ
        if (rewardWords.length === 0) {
            ctx.font = '24px Arial';
            ctx.fillText('このテーマの単語はすべて追加済みです', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
            return;
        }

        // 2つの単語と1つの単語ボックスを表示（合計3つ）
        const wordBoxWidth = 250;
        const wordBoxHeight = 120;
        const wordBoxSpacing = 30;
        const totalCount = 3; // 2つの単語 + 1つの単語ボックス
        const totalWidth = wordBoxWidth * totalCount + wordBoxSpacing * (totalCount - 1);
        const startX = (SCREEN_WIDTH - totalWidth) / 2;
        const startY = descriptionY + 70; // 説明文の下に配置

        // 2つの単語を表示
        rewardWords.forEach((word, index) => {
            const x = startX + index * (wordBoxWidth + wordBoxSpacing);
            const y = startY;

            // ホバーまたは選択状態の判定
            const isHovered = hoveredRewardWordIndex === index;
            const isSelected = selectedRewardWordIndex === index;

            // ボックスの背景色
            if (isSelected) {
                ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
            } else if (isHovered) {
                ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
            } else {
                ctx.fillStyle = WHITE; // 通常は白
            }
            ctx.fillRect(x, y, wordBoxWidth, wordBoxHeight);

            // ボックスの枠線
            ctx.strokeStyle = isSelected ? GREEN : (isHovered ? '#FBC02D' : '#CCCCCC');
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.strokeRect(x, y, wordBoxWidth, wordBoxHeight);

            // 番号表示
            ctx.fillStyle = BLACK;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x + wordBoxWidth / 2, y + 30);

            // 日本語の単語
            ctx.font = 'bold 32px Arial';
            ctx.fillText(word.japanese, x + wordBoxWidth / 2, y + 70);

            // 英語の単語（小さく）
            ctx.font = '20px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(word.english.toUpperCase(), x + wordBoxWidth / 2, y + 100);
        });

        // 単語ボックスを表示（インデックス2）
        const boxIndex = 2;
        const boxX = startX + boxIndex * (wordBoxWidth + wordBoxSpacing);
        const boxY = startY;

        // ホバーまたは選択状態の判定
        const isBoxHovered = hoveredRewardWordIndex === boxIndex;
        const isBoxSelected = selectedRewardWordIndex === boxIndex;

        // ボックスの背景色
        if (isBoxSelected) {
            ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
        } else if (isBoxHovered) {
            ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
        } else {
            ctx.fillStyle = WHITE; // 通常は白
        }
        ctx.fillRect(boxX, boxY, wordBoxWidth, wordBoxHeight);

        // ボックスの枠線
        ctx.strokeStyle = isBoxSelected ? GREEN : (isBoxHovered ? '#FBC02D' : '#CCCCCC');
        ctx.lineWidth = isBoxSelected ? 4 : 2;
        ctx.strokeRect(boxX, boxY, wordBoxWidth, wordBoxHeight);

        // 番号表示
        ctx.fillStyle = BLACK;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('3', boxX + wordBoxWidth / 2, boxY + 30);

        // 単語ボックス名
        ctx.font = 'bold 28px Arial';
        ctx.fillText('単語ボックス', boxX + wordBoxWidth / 2, boxY + 70);

        // 説明文（小さく）
        ctx.font = '18px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText('ランダムに5単語追加', boxX + wordBoxWidth / 2, boxY + 100);
    } else if (rewardPhase === 'item') {
        // アイテム選択フェーズ
        ctx.fillText('アイテムを1つ選択してください（クリックまたは1, 2, 3キー）', SCREEN_WIDTH / 2, descriptionY);
        
        // 3つのアイテムを表示（画面中央付近）
        const itemBoxWidth = 280;
        const itemBoxHeight = 140;
        const itemBoxSpacing = 30;
        const totalWidth = itemBoxWidth * rewardItems.length + itemBoxSpacing * (rewardItems.length - 1);
        const startX = (SCREEN_WIDTH - totalWidth) / 2;
        const startY = descriptionY + 50; // 説明文の下に配置

        rewardItems.forEach((item, index) => {
            const x = startX + index * (itemBoxWidth + itemBoxSpacing);
            const y = startY;

            // ホバーまたは選択状態の判定
            const isHovered = hoveredRewardItemIndex === index;
            const isSelected = selectedRewardItemIndex === index;

            // ボックスの背景色
            if (isSelected) {
                ctx.fillStyle = '#C8E6C9'; // 選択済みは薄い緑
            } else if (isHovered) {
                ctx.fillStyle = '#FFF9C4'; // ホバーは薄い黄色
            } else {
                ctx.fillStyle = WHITE; // 通常は白
            }
            ctx.fillRect(x, y, itemBoxWidth, itemBoxHeight);

            // ボックスの枠線
            ctx.strokeStyle = isSelected ? GREEN : (isHovered ? '#FBC02D' : '#CCCCCC');
            ctx.lineWidth = isSelected ? 4 : 2;
            ctx.strokeRect(x, y, itemBoxWidth, itemBoxHeight);

            // 番号表示
            ctx.fillStyle = BLACK;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, x + itemBoxWidth / 2, y + 25);

            // アイテム名
            ctx.font = 'bold 28px Arial';
            ctx.fillText(item.name, x + itemBoxWidth / 2, y + 60);

            // アイテムの説明（小さく）
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666666';
            // 説明文を適切に改行して表示
            const maxWidth = itemBoxWidth - 20; // 左右に10pxのマージン
            const words = item.description.split('');
            let line = '';
            let yPos = y + 90;
            const lineHeight = 18;
            
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i];
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && line.length > 0) {
                    // 現在の行を描画
                    ctx.fillText(line, x + itemBoxWidth / 2, yPos);
                    line = words[i];
                    yPos += lineHeight;
                } else {
                    line = testLine;
                }
            }
            // 最後の行を描画
            if (line.length > 0) {
                ctx.fillText(line, x + itemBoxWidth / 2, yPos);
            }
        });
    }
}

// 戦闘パートの描画
function drawBattlePart() {
    // 単語が空の場合はゲームを進行させない
    if (words.length === 0) {
        // 画面のクリア
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        // メッセージを表示
        ctx.fillStyle = BLACK;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('出題できる単語がありません', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);
        ctx.font = 'bold 24px Arial';
        ctx.fillText('探索パートで単語を入手してください', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30);
        return;
    }
    
    // 敵の体力が0になったときに爆発演出を開始（一度だけ）
    if (enemyHP <= 0 && !hasExploded && !gameOver) {
        startExplosion();
    }

    // 爆発演出中の処理
    if (isExploding) {
        explosionTimer++;
        // パーティクルの更新
        for (let i = explosionParticles.length - 1; i >= 0; i--) {
            explosionParticles[i].update();
            if (explosionParticles[i].isDead()) {
                explosionParticles.splice(i, 1);
            }
        }
        // 爆発演出が終了したら勝利状態に移行
        if (explosionTimer >= EXPLOSION_DURATION) {
            isExploding = false;
        }
    }

    // 単語表示モーダルが開いているかチェック
    const isWordModalOpen = wordModal.style.display === 'flex';
    
    if (!gameOver && !isPaused && !isWordModalOpen && enemyHP > 0 && !isExploding) {
        // プレイヤーの更新
        player.update(keys);

        // 弾幕の生成
        bulletSpawnTimer++;
        if (bulletSpawnTimer >= BULLET_SPAWN_INTERVAL) {
            bulletSpawnTimer = 0;
            // 難易度に応じた弾の数を取得
            const bulletCount = selectedDifficulty === DIFFICULTY.EASY ? BULLET_COUNT_EASY : BULLET_COUNT_HARD;
            // 弾幕を発射（扇状に広がる）
            // 基本角度：下方向（画面下に向かう）
            const baseAngle = Math.PI / 2; // 90度（下方向）
            // 弾幕の広がり角度の中心を少しランダムにずらす（毎回違うパターン）
            const angleOffset = (Math.random() - 0.5) * 0.3; // -0.15 ～ 0.15 ラジアン
            const startAngle = baseAngle - BULLET_SPREAD_ANGLE / 2 + angleOffset;
            const angleStep = BULLET_SPREAD_ANGLE / (bulletCount - 1);
            
            for (let i = 0; i < bulletCount; i++) {
                const angle = startAngle + angleStep * i;
                bullets.push(new Bullet(ENEMY_X, ENEMY_Y, angle));
            }
        }

        // 弾の更新
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            // 画面外に出た弾を削除
            if (bullets[i].isOffScreen()) {
                bullets.splice(i, 1);
                continue;
            }
            // 衝突判定（円と円）
            if (checkCircleCollision(bullets[i].getCircle(), player.getCircle())) {
                // カプセルの効果：残機がある場合はゲームオーバーにならない
                if (playerItems.extraLives > 0) {
                    playerItems.extraLives -= 1;
                    // 被弾した弾を削除
                    bullets.splice(i, 1);
                } else {
                    gameOver = true;
                    break;
                }
            }
        }
    }

    // 画面のクリア
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 敵の描画（画面上部中央）- 爆発演出中は描画しない
    if (!isExploding) {
        ctx.fillStyle = '#800080';
        ctx.fillRect(ENEMY_X - ENEMY_SIZE / 2, ENEMY_Y - ENEMY_SIZE / 2, ENEMY_SIZE, ENEMY_SIZE);
    } else {
        // 爆発演出中は敵を拡大して消えるアニメーション
        const scale = 1 + (explosionTimer / EXPLOSION_DURATION) * 2;
        const alpha = 1 - (explosionTimer / EXPLOSION_DURATION);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(
            ENEMY_X - (ENEMY_SIZE * scale) / 2,
            ENEMY_Y - (ENEMY_SIZE * scale) / 2,
            ENEMY_SIZE * scale,
            ENEMY_SIZE * scale
        );
        ctx.globalAlpha = 1.0;
    }
    
    // 爆発パーティクルの描画
    if (isExploding) {
        for (const particle of explosionParticles) {
            particle.draw();
        }
    }
    
    // 敵の体力バーの描画
    const hpBarWidth = 200;
    const hpBarHeight = 20;
    const hpBarX = ENEMY_X - hpBarWidth / 2;
    const hpBarY = ENEMY_Y + ENEMY_SIZE / 2 + 10;
    
    // 体力バーの背景（灰色）
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
    
    // 体力バー（赤から緑へのグラデーション）
    const hpPercentage = enemyHP / ENEMY_MAX_HP;
    const currentHpWidth = hpBarWidth * hpPercentage;
    if (hpPercentage > 0.5) {
        // 50%以上は緑から黄色へ
        const greenValue = Math.floor(255 * (hpPercentage - 0.5) * 2);
        ctx.fillStyle = `rgb(${255 - greenValue}, 255, 0)`;
    } else {
        // 50%以下は黄色から赤へ
        const redValue = Math.floor(255 * hpPercentage * 2);
        ctx.fillStyle = `rgb(255, ${redValue}, 0)`;
    }
    ctx.fillRect(hpBarX, hpBarY, currentHpWidth, hpBarHeight);
    
    // 体力バーの枠線
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
    
    // 体力の数値を表示
    ctx.fillStyle = BLACK;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${enemyHP} / ${ENEMY_MAX_HP}`, ENEMY_X, hpBarY + hpBarHeight / 2);

    // 区切り線の描画（画面の中央）
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, DIVIDER_Y);
    ctx.lineTo(SCREEN_WIDTH, DIVIDER_Y);
    ctx.stroke();

    // すべてのキーの描画
    for (const area of Object.values(KEY_AREAS)) {
        drawKey(area);
    }

    // 弾の描画（キーの後に描画して手前に表示）
    for (const bullet of bullets) {
        bullet.draw();
    }

    // プレイヤーの描画
    player.draw();
}

// ゲームループ
function gameLoop() {
    // パートに応じて描画を切り替え
    // 報酬フェーズでも、まず戦闘パートの描画を行う（背景が見えるように）
    if (currentGameState === GAME_STATE.BATTLE || currentGameState === GAME_STATE.REWARD) {
        drawBattlePart();
    } else if (currentGameState === GAME_STATE.EXPLORATION) {
        drawExplorationPart();
    }
    
    // 報酬フェーズの場合は、戦闘パートの描画の上に報酬フェーズの内容を重ねる
    if (currentGameState === GAME_STATE.REWARD) {
        drawRewardOverlay();
    }

    // ポーズ表示（戦闘パートのみ）
    const isWordModalOpen = wordModal.style.display === 'flex';
    if (currentGameState === GAME_STATE.BATTLE && (isPaused || isWordModalOpen)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.font = 'bold 24px Arial';
        ctx.fillText('ESCキーで再開', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 60);
    }

    // 敵の体力が0になり、爆発演出が終了した場合の処理
    if ((currentGameState === GAME_STATE.BATTLE || currentGameState === GAME_STATE.REWARD) && enemyHP <= 0 && !gameOver && !isExploding) {
        // 勝利画面の開始時刻を記録（初回のみ）
        if (victoryStartTime === 0) {
            victoryStartTime = Date.now();
            victoryTextY = SCREEN_HEIGHT / 2; // 初期位置を画面中央に設定
        }
        
        const elapsed = Date.now() - victoryStartTime;
        
        // 0.5秒後からアニメーション開始
        if (elapsed >= VICTORY_DELAY) {
            const animationElapsed = elapsed - VICTORY_DELAY;
            const progress = Math.min(animationElapsed / VICTORY_ANIMATION_DURATION, 1);
            // イージング関数（ease-out）を使用してゆっくり移動
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const targetY = 50; // 画面上部の目標位置
            victoryTextY = SCREEN_HEIGHT / 2 + (targetY - SCREEN_HEIGHT / 2) * easeOut;
        }
        
        // アニメーション終了後、報酬フェーズに移行
        if (elapsed >= VICTORY_TO_REWARD_DELAY && currentGameState === GAME_STATE.BATTLE) {
            // 報酬フェーズに移行
            currentGameState = GAME_STATE.REWARD;
            // 最初に選んだテーマから報酬用の単語を生成（テーマが選択されていない場合は最初のテーマを使用）
            if (firstSelectedThemeIndex === null) {
                firstSelectedThemeIndex = 0; // デフォルトで最初のテーマを使用
            }
            generateRewardWords();
        }
        
        // 報酬フェーズに移行していない場合のみ勝利画面を描画
        // 報酬フェーズでは、drawRewardOverlayで描画されるため、ここでは描画しない
        // ただし、報酬フェーズに移行した直後のフレームでも、勝利画面の描画を継続する
        if (currentGameState === GAME_STATE.BATTLE || (currentGameState === GAME_STATE.REWARD && elapsed < VICTORY_TO_REWARD_DELAY + 50)) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            ctx.fillStyle = GREEN;
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('VICTORY!', SCREEN_WIDTH / 2, victoryTextY);
            ctx.fillStyle = WHITE;
            ctx.font = 'bold 24px Arial';
            ctx.fillText('敵を倒しました！', SCREEN_WIDTH / 2, victoryTextY + 60);
        }
    }

    // ゲームオーバー表示（戦闘パートのみ）
    if (currentGameState === GAME_STATE.BATTLE && gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = RED;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 24px Arial';
        ctx.fillText('スペースキーで再開', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 60);
    }

    // 現在の領域情報を更新（戦闘パートのみ、ゲームオーバー時とポーズ時、敵の体力が0の時、単語が空の時はスキップ）
    const isWordModalOpenForArea = wordModal.style.display === 'flex';
    if (currentGameState === GAME_STATE.BATTLE && words.length > 0 && !gameOver && !isPaused && !isWordModalOpenForArea && enemyHP > 0) {
        const currentArea = getAreaLabel(player.getCenterX(), player.getCenterY());
        const areaInfo = document.getElementById('currentArea');
        if (currentArea) {
        areaInfo.textContent = `現在の領域: ${currentArea}`;
        
        // 新しい領域に入った場合、履歴に追加
        // previousAreaがnullの場合は最初の領域なので、領域外から戻ってきた場合も含めて処理
        if (currentArea !== previousArea) {
            // 最初の領域でない場合、または領域外から戻ってきた場合は履歴に追加
            if (previousArea !== null) {
                visitedAreas.push(currentArea);
            }
            
            // 単語入力のチェック（英語のアルファベットで入力）
            const currentWord = words[currentWordIndex];
            if (currentWord && currentCharIndex < currentWord.english.length) {
                const expectedChar = currentWord.english[currentCharIndex].toUpperCase();
                if (currentArea === expectedChar) {
                    // 正しい文字が踏まれた
                    completedChars.push(currentCharIndex);
                    currentCharIndex++;
                    
                    // 単語が完成したら次の単語へ（ランダムに選択）
                    if (currentCharIndex >= currentWord.english.length) {
                        // 単語完成時の処理
                        wordCompleted = true;
                        wordCompletedTime = Date.now();
                        // すべての文字を完成済みとして記録（緑色表示のため）
                        for (let i = 0; i < currentWord.english.length; i++) {
                            if (!completedChars.includes(i)) {
                                completedChars.push(i);
                            }
                        }
                        // 敵の体力を減少（単語の文字数に応じたダメージ + ペンダントの効果）
                        const damage = currentWord.english.length + playerItems.damageBoost;
                        enemyHP = Math.max(0, enemyHP - damage);
                    }
                }
            }
        }
        previousArea = currentArea;
        } else {
            areaInfo.textContent = '現在の領域: -';
            // 領域外に出た時に"-"を記録（領域外から戻ってきたときに検出できるように）
            if (previousArea !== null && previousArea !== '-') {
                previousArea = '-';
            }
        }
    }

    // 単語完成時の処理（一定時間後に次の単語へ）
    if (wordCompleted && Date.now() - wordCompletedTime >= COMPLETION_DISPLAY_TIME) {
        // 次の単語に移る
        currentCharIndex = 0;
        completedChars.length = 0;
        wordCompleted = false;
        // ランダムに次の単語を選択（同じ単語が連続しないように）
        let nextWordIndex;
        do {
            nextWordIndex = Math.floor(Math.random() * words.length);
        } while (nextWordIndex === currentWordIndex && words.length > 1);
        currentWordIndex = nextWordIndex;
    }

    // 単語を表示（履歴の下）- 日本語で表示（戦闘パートのみ、単語がある場合のみ）
    if (currentGameState === GAME_STATE.BATTLE && words.length > 0) {
        const currentWord = words[currentWordIndex];
        if (currentWord) {
            const wordY = 70; // 履歴の下に配置
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // 日本語の単語を大きく表示
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = BLACK;
            ctx.fillText(currentWord.japanese, 20, wordY);
            
            // 英語のアルファベットを「o」で隠して表示（入力進捗表示用）
            const englishY = wordY + 45;
            ctx.font = 'bold 24px Arial';
            for (let i = 0; i < currentWord.english.length; i++) {
                const charX = 20 + i * 20; // 文字間隔を20pxに設定
                const char = currentWord.english[i];
                
                // 単語完成時はすべて緑色、正しく入力された文字は緑色、未入力は黒色
                if (wordCompleted) {
                    ctx.fillStyle = GREEN;
                    // 完成時は実際の文字を表示
                    ctx.fillText(char.toUpperCase(), charX, englishY);
                } else if (completedChars.includes(i)) {
                    ctx.fillStyle = GREEN; // 正解を打った位置は緑色
                    // 正解を打った位置は実際の文字を表示
                    ctx.fillText(char.toUpperCase(), charX, englishY);
                } else {
                    ctx.fillStyle = BLACK;
                    // まだ打っていない位置は「o」で隠す
                    ctx.fillText('o', charX, englishY);
                }
            }
        }
    }

    // 次のフレームをリクエスト
    requestAnimationFrame(gameLoop);
}

// ゲーム開始
gameLoop();

