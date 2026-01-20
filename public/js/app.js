// API 基础路径
const API_BASE = '';

// 状态管理
let eggCount = 6;
let eggConfig = {
  eggImage: '/images/egg.png',
  eggSmashedImage: '/images/egg-smashed.png',
  eggSmashEffect: 'fade'
};
let prizePool = [];
let isDrawing = false;
let soundConfig = {
  hit: { url: '/audio/hit.mp3' },
  win: { url: '/audio/win.mp3' }
};

// DOM 元素
const eggsContainer = document.getElementById('eggsContainer');
const prizePoolEl = document.getElementById('prizePool');
const refreshBtn = document.getElementById('refreshBtn');
const winModal = document.getElementById('winModal');
const winPrizeName = document.getElementById('winPrizeName');
const winPrizeImage = document.getElementById('winPrizeImage');
const modalClose = document.getElementById('modalClose');
const emptyModal = document.getElementById('emptyModal');
const emptyClose = document.getElementById('emptyClose');

// ==================== 初始化 ====================

async function init() {
  await loadConfig();
  await loadSoundConfig();
  await loadPrizePool();
  renderEggs();
  renderPrizePool();
}

// ==================== 加载配置 ====================

async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const data = await res.json();
    eggCount = data.eggCount || 6;
    eggConfig = {
      eggImage: data.eggImage || '/images/egg.png',
      eggSmashedImage: data.eggSmashedImage || '/images/egg-smashed.png',
      eggSmashEffect: data.eggSmashEffect || 'fade'
    };
    console.log('配置加载成功:', eggConfig);
  } catch (error) {
    console.error('加载配置失败:', error);
    // 使用默认配置
    eggCount = 6;
    eggConfig = {
      eggImage: '/images/egg.png',
      eggSmashedImage: '/images/egg-smashed.png',
      eggSmashEffect: 'fade'
    };
  }
}

// ==================== 加载奖品池 ====================

async function loadPrizePool() {
  try {
    const res = await fetch(`${API_BASE}/api/prizes/pool`);
    prizePool = await res.json();
  } catch (error) {
    console.error('加载奖品池失败:', error);
  }
}

// ==================== 加载音效配置 ====================

async function loadSoundConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/sounds`);
    soundConfig = await res.json();
  } catch (error) {
    console.error('加载音效配置失败:', error);
    // 使用默认音效
    soundConfig = {
      hit: { url: '/audio/hit.mp3' },
      win: { url: '/audio/win.mp3' }
    };
  }
}

// ==================== 渲染金蛋 ====================

function renderEggs() {
  eggsContainer.innerHTML = '';

  for (let i = 0; i < eggCount; i++) {
    const egg = document.createElement('div');
    egg.className = 'egg';
    egg.dataset.index = i;

    // 从配置中获取图片路径
    const eggImagePath = eggConfig.eggImage;
    const eggSmashedPath = eggConfig.eggSmashedImage;

    egg.innerHTML = `
      <!-- 完整的金蛋图片 -->
      <img class="egg-image egg-intact" src="${eggImagePath}" alt="金蛋" onerror="this.src='https://via.placeholder.com/300x400/ffd700/ffffff?text=金蛋'">

      <!-- 破碎的金蛋图片 -->
      <img class="egg-image egg-smashed" src="${eggSmashedPath}" alt="破碎金蛋" style="display: none;" onerror="this.style.display='none'">

      <!-- 手掌光标提示 -->
      <div class="hammer-hint">👋</div>
    `;

    egg.addEventListener('click', () => smashEgg(egg));
    eggsContainer.appendChild(egg);
  }
}

// ==================== 渲染奖品池 ====================

function renderPrizePool() {
  if (prizePool.length === 0) {
    prizePoolEl.innerHTML = '<p class="loading">暂无奖品</p>';
    return;
  }

  prizePoolEl.innerHTML = prizePool.map(prize => {
    const stockClass = prize.stock === 0 ? 'out-of-stock' : (prize.stock <= 3 ? 'low-stock' : '');
    const stockText = prize.stock === 0 ? '已抽完 ✓' : `剩余: ${prize.stock}`;

    return `
      <div class="prize-item ${stockClass}">
        <div class="prize-name">${prize.name}</div>
        <div class="prize-stock">
          库存: <span class="stock-status ${prize.stock === 0 ? 'empty' : (prize.stock <= 3 ? 'low' : '')}">${stockText}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 砸金蛋 ====================

async function smashEgg(egg) {
  if (isDrawing || egg.classList.contains('smashed')) {
    return;
  }

  isDrawing = true;

  // 播放敲击动画
  await playHitAnimation(egg);

  // 调用抽奖接口
  try {
    const res = await fetch(`${API_BASE}/api/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (data.success) {
      // 中奖了
      await playSmashAnimation(egg);
      showWinModal(data.prize);
      await loadPrizePool();
      renderPrizePool();
      confettiEffect();

      // 延迟后自动刷新金蛋
      setTimeout(async () => {
        await loadConfig();
        renderEggs();
      }, 2000); // 2秒后刷新
    } else {
      // 奖品抽完
      showEmptyModal();
    }
  } catch (error) {
    console.error('抽奖失败:', error);
    alert('抽奖失败，请稍后重试');
  } finally {
    isDrawing = false;
  }
}

// ==================== 敲击动画 ====================

function playHitAnimation(egg) {
  // 播放敲击音效
  playSound('hit');

  return new Promise(resolve => {
    gsap.timeline({
      onComplete: resolve
    })
      .to(egg, { scale: 0.9, duration: 0.1 })
      .to(egg, { scale: 1.1, duration: 0.1 })
      .to(egg, { scale: 1, duration: 0.1 });
  });
}

// ==================== 碎裂动画 ====================

function playSmashAnimation(egg) {
  return new Promise(resolve => {
    egg.classList.add('smashed');

    // 获取图片元素
    const intactImage = egg.querySelector('.egg-intact');
    const smashedImage = egg.querySelector('.egg-smashed');
    const effect = eggConfig.eggSmashEffect || 'fade';

    // 震动效果
    gsap.to(egg, {
      x: '+=5',
      duration: 0.05,
      repeat: 5,
      yoyo: true,
      ease: 'power1.inOut'
    });

    // 根据配置选择碎裂效果
    setTimeout(() => {
      if (effect === 'image') {
        // 切换到破碎图片
        if (intactImage) {
          intactImage.style.display = 'none';
        }

        if (smashedImage) {
          smashedImage.style.display = 'block';
          gsap.fromTo(smashedImage,
            { scale: 1.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4 }
          );
        }
      } else {
        // 淡出效果（默认）
        if (intactImage) {
          gsap.to(intactImage, {
            scale: 0.5,
            opacity: 0,
            duration: 0.4,
            onComplete: () => {
              intactImage.style.display = 'none';
            }
          });
        }
      }
    }, 300);

    setTimeout(resolve, 800);
  });
}

// ==================== 显示中奖弹窗 ====================

function showWinModal(prize) {
  winPrizeName.textContent = prize.name;

  if (prize.image) {
    winPrizeImage.style.backgroundImage = `url(${prize.image})`;
    winPrizeImage.textContent = '';
  } else {
    winPrizeImage.style.backgroundImage = '';
    winPrizeImage.textContent = '🎁';
  }

  winModal.classList.add('show');

  // 播放中奖音效（如果有的话）
  playSound('win');
}

// ==================== 显示奖品抽完弹窗 ====================

function showEmptyModal() {
  emptyModal.classList.add('show');
}

// ==================== 关闭弹窗 ====================

modalClose.addEventListener('click', () => {
  winModal.classList.remove('show');
});

emptyClose.addEventListener('click', () => {
  emptyModal.classList.remove('show');
});

// 点击弹窗外部关闭
winModal.addEventListener('click', (e) => {
  if (e.target === winModal) {
    winModal.classList.remove('show');
  }
});

emptyModal.addEventListener('click', (e) => {
  if (e.target === emptyModal) {
    emptyModal.classList.remove('show');
  }
});

// ==================== 刷新金蛋 ====================

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<span>🔄</span> 刷新中...';

  await loadConfig();
  await loadPrizePool();

  // 重新渲染金蛋和奖品池
  renderEggs();
  renderPrizePool();

  setTimeout(() => {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<span>🔄</span> 刷新金蛋';
  }, 500);
});

// ==================== 播放音效 ====================

// 音频上下文（用于生成备用音效）
let audioContext = null;

// 使用 Web Audio API 生成简单音效
function playGeneratedSound(type) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === 'hit') {
    // 敲击音效 - 短促的敲击声
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } else if (type === 'win') {
    // 中奖音效 - 欢快的上升音调
    const now = audioContext.currentTime;
    oscillator.type = 'sine';

    // 播放一段欢快的旋律
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }
}

function playSound(type) {
  // 先尝试播放配置的音效文件
  const soundUrl = soundConfig[type]?.url || `/audio/${type}.mp3`;
  const audio = new Audio(soundUrl);

  audio.play().then(() => {
    // 音效文件播放成功
  }).catch(() => {
    // 音效文件播放失败，使用生成的音效
    playGeneratedSound(type);
  });
}

// ==================== 庆祝特效 ====================

function confettiEffect() {
  // 使用 confetti.js 中的函数
  if (typeof startConfetti === 'function') {
    startConfetti();
    setTimeout(stopConfetti, 3000);
  }
}

// ==================== 定时刷新奖品池 ====================

setInterval(async () => {
  await loadPrizePool();
  renderPrizePool();
}, 10000); // 每10秒刷新一次

// ==================== 启动应用 ====================

init();
