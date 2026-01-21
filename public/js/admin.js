// API 基础路径
const API_BASE = '';

// 状态管理
let isLoggedIn = false;
let prizes = [];
let sounds = [];

// DOM 元素
const loginPage = document.getElementById('loginPage');
const adminPage = document.getElementById('adminPage');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const totalDrawsEl = document.getElementById('totalDraws');
const totalStockEl = document.getElementById('totalStock');
const eggCountSelect = document.getElementById('eggCount');
const eggImageInput = document.getElementById('eggImage');
const eggImageFileInput = document.getElementById('eggImageFile');
const eggSmashedImageInput = document.getElementById('eggSmashedImage');
const eggSmashedImageFileInput = document.getElementById('eggSmashedImageFile');
const eggSmashEffectSelect = document.getElementById('eggSmashEffect');
const previewEggImage = document.getElementById('previewEggImage');
const previewSmashedImage = document.getElementById('previewSmashedImage');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const addPrizeBtn = document.getElementById('addPrizeBtn');
const prizeList = document.getElementById('prizeList');
const recordsBody = document.getElementById('recordsBody');
const prizeModal = document.getElementById('prizeModal');
const modalTitle = document.getElementById('modalTitle');
const prizeForm = document.getElementById('prizeForm');
const prizeIdInput = document.getElementById('prizeId');
const prizeNameInput = document.getElementById('prizeName');
const prizeImageInput = document.getElementById('prizeImage');
const prizeStockInput = document.getElementById('prizeStock');
const prizeProbabilityInput = document.getElementById('prizeProbability');
const prizeModalClose = document.getElementById('prizeModalClose');
const prizeModalCancel = document.getElementById('prizeModalCancel');

// 音效相关元素
const addSoundBtn = document.getElementById('addSoundBtn');
const soundList = document.getElementById('soundList');
const soundModal = document.getElementById('soundModal');
const soundModalTitle = document.getElementById('soundModalTitle');
const soundForm = document.getElementById('soundForm');
const soundIdInput = document.getElementById('soundId');
const soundTypeInput = document.getElementById('soundType');
const soundNameInput = document.getElementById('soundName');
const soundUrlInput = document.getElementById('soundUrl');
const soundModalClose = document.getElementById('soundModalClose');
const soundModalCancel = document.getElementById('soundModalCancel');
const previewSoundBtn = document.getElementById('previewSoundBtn');

// ==================== 登录相关 ====================

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = passwordInput.value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      isLoggedIn = true;
      showAdminPage();
      loadData();
    } else {
      loginError.textContent = data.message || '登录失败';
    }
  } catch (error) {
    loginError.textContent = '网络错误，请稍后重试';
    console.error('登录失败:', error);
  }
});

logoutBtn.addEventListener('click', () => {
  isLoggedIn = false;
  showLoginPage();
});

function showLoginPage() {
  loginPage.style.display = 'flex';
  adminPage.style.display = 'none';
  passwordInput.value = '';
  loginError.textContent = '';
}

function showAdminPage() {
  loginPage.style.display = 'none';
  adminPage.style.display = 'block';
}

// ==================== 加载数据 ====================

async function loadData() {
  await Promise.all([
    loadStats(),
    loadConfig(),
    loadPrizes(),
    loadSounds(),
    loadRecords()
  ]);
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    const data = await res.json();

    totalDrawsEl.textContent = data.totalDraws;
    totalStockEl.textContent = data.totalStock;
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/config`);
    const data = await res.json();

    eggCountSelect.value = data.eggCount;
    eggImageInput.value = data.eggImage || '';
    eggSmashedImageInput.value = data.eggSmashedImage || '';
    eggSmashEffectSelect.value = data.eggSmashEffect || 'fade';

    // 更新预览图片
    updatePreview(data.eggImage, data.eggSmashedImage);
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 更新预览图片
function updatePreview(eggUrl, smashedUrl) {
  if (eggUrl) {
    previewEggImage.src = eggUrl;
  } else {
    previewEggImage.src = 'https://via.placeholder.com/150x200/ffd700/ffffff?text=金蛋';
  }

  if (smashedUrl) {
    previewSmashedImage.src = smashedUrl;
  } else {
    previewSmashedImage.src = 'https://via.placeholder.com/150x200/d3d3d3/666666?text=破碎';
  }
}

// 监听图片URL变化，实时更新预览
eggImageInput.addEventListener('input', () => {
  previewEggImage.src = eggImageInput.value || 'https://via.placeholder.com/150x200/ffd700/ffffff?text=金蛋';
});

eggSmashedImageInput.addEventListener('input', () => {
  previewSmashedImage.src = eggSmashedImageInput.value || 'https://via.placeholder.com/150x200/d3d3d3/666666?text=破碎';
});

// 监听文件选择，自动上传并填充URL
eggImageFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 显示上传提示
  eggImageInput.value = '上传中...';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/admin/upload/egg-image`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      eggImageInput.value = data.url;
      // 更新预览
      previewEggImage.src = data.url;
    } else {
      alert('上传失败：' + (data.message || '未知错误'));
      eggImageInput.value = '';
    }
  } catch (error) {
    alert('上传失败，请稍后重试');
    console.error('上传失败:', error);
    eggImageInput.value = '';
  }

  // 清空文件选择
  eggImageFileInput.value = '';
});

eggSmashedImageFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 显示上传提示
  eggSmashedImageInput.value = '上传中...';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/admin/upload/smashed-image`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      eggSmashedImageInput.value = data.url;
      // 更新预览
      previewSmashedImage.src = data.url;
    } else {
      alert('上传失败：' + (data.message || '未知错误'));
      eggSmashedImageInput.value = '';
    }
  } catch (error) {
    alert('上传失败，请稍后重试');
    console.error('上传失败:', error);
    eggSmashedImageInput.value = '';
  }

  // 清空文件选择
  eggSmashedImageFileInput.value = '';
});

async function loadPrizes() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/prizes`);
    prizes = await res.json();

    renderPrizes();
  } catch (error) {
    console.error('加载奖品失败:', error);
  }
}

async function loadRecords() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/records`);
    const records = await res.json();

    renderRecords(records);
  } catch (error) {
    console.error('加载记录失败:', error);
  }
}

async function loadSounds() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/sounds`);
    sounds = await res.json();

    renderSounds();
  } catch (error) {
    console.error('加载音效失败:', error);
  }
}

// ==================== 保存配置 ====================

saveConfigBtn.addEventListener('click', async () => {
  const eggCount = parseInt(eggCountSelect.value);
  const eggImage = eggImageInput.value;
  const eggSmashedImage = eggSmashedImageInput.value;
  const eggSmashEffect = eggSmashEffectSelect.value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eggCount,
        eggImage,
        eggSmashedImage,
        eggSmashEffect
      })
    });

    const data = await res.json();

    if (data.success) {
      alert('配置保存成功！');
    } else {
      alert('保存失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('保存配置失败:', error);
  }
});

// ==================== 奖品管理 ====================

function renderPrizes() {
  if (prizes.length === 0) {
    prizeList.innerHTML = '<p class="loading">暂无奖品，点击上方按钮添加</p>';
    return;
  }

  prizeList.innerHTML = prizes.map(prize => {
    const stockClass = prize.stock === 0 ? 'out-of-stock' : (prize.stock <= 3 ? 'low-stock' : '');
    const stockWarning = prize.stock === 0 ? ' (已抽完)' : (prize.stock <= 3 ? ' (库存不足)' : '');

    return `
      <div class="prize-item ${stockClass}">
        <div class="prize-info">
          <div class="prize-info-name">${prize.name}</div>
          <div class="prize-info-details">
            <span>库存: <strong class="${prize.stock <= 3 ? 'stock-warning' : ''}">${prize.stock}</strong>${stockWarning}</span>
            <span>概率: ${prize.probability}%</span>
          </div>
        </div>
        <div class="prize-actions">
          <button class="btn-primary" onclick="editPrize(${prize.id})">编辑</button>
          <button class="btn-danger" onclick="deletePrize(${prize.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

addPrizeBtn.addEventListener('click', () => {
  openPrizeModal();
});

function openPrizeModal(prize = null) {
  if (prize) {
    modalTitle.textContent = '编辑奖品';
    prizeIdInput.value = prize.id;
    prizeNameInput.value = prize.name;
    prizeImageInput.value = prize.image || '';
    prizeStockInput.value = prize.stock;
    prizeProbabilityInput.value = prize.probability;
  } else {
    modalTitle.textContent = '添加奖品';
    prizeForm.reset();
    prizeIdInput.value = '';
    prizeStockInput.value = 1;
    prizeProbabilityInput.value = 1;
  }

  prizeModal.classList.add('show');
}

function closePrizeModal() {
  prizeModal.classList.remove('show');
  prizeForm.reset();
}

prizeModalClose.addEventListener('click', closePrizeModal);
prizeModalCancel.addEventListener('click', closePrizeModal);

prizeModal.addEventListener('click', (e) => {
  if (e.target === prizeModal) {
    closePrizeModal();
  }
});

prizeForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    name: prizeNameInput.value,
    image: prizeImageInput.value,
    stock: parseInt(prizeStockInput.value),
    probability: parseFloat(prizeProbabilityInput.value)
  };

  const prizeId = prizeIdInput.value;

  try {
    const url = prizeId
      ? `${API_BASE}/api/admin/prizes/${prizeId}`
      : `${API_BASE}/api/admin/prizes`;

    const method = prizeId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      closePrizeModal();
      await loadPrizes();
      await loadStats();
    } else {
      alert('保存失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('保存奖品失败:', error);
  }
});

// 全局函数供 HTML onclick 调用
window.editPrize = function(id) {
  const prize = prizes.find(p => p.id === id);
  if (prize) {
    openPrizeModal(prize);
  }
};

window.deletePrize = async function(id) {
  if (!confirm('确定要删除这个奖品吗？')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/prizes/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (data.success) {
      await loadPrizes();
      await loadStats();
    } else {
      alert('删除失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('删除奖品失败:', error);
  }
};

// ==================== 音效管理 ====================

function renderSounds() {
  if (sounds.length === 0) {
    soundList.innerHTML = '<p class="loading">暂无音效，点击上方按钮添加</p>';
    return;
  }

  const hitSounds = sounds.filter(s => s.type === 'hit');
  const winSounds = sounds.filter(s => s.type === 'win');

  soundList.innerHTML = `
    <div class="sound-group">
      <h3>敲击音效</h3>
      ${hitSounds.length === 0 ? '<p class="loading">暂无敲击音效</p>' : hitSounds.map(sound => renderSoundItem(sound)).join('')}
    </div>
    <div class="sound-group">
      <h3>中奖音效</h3>
      ${winSounds.length === 0 ? '<p class="loading">暂无中奖音效</p>' : winSounds.map(sound => renderSoundItem(sound)).join('')}
    </div>
  `;
}

function renderSoundItem(sound) {
  const activeClass = sound.is_active ? 'active' : '';
  const activeText = sound.is_active ? '✓ 已激活' : '激活';
  const activeBtnClass = sound.is_active ? 'btn-success' : 'btn-primary';

  return `
    <div class="sound-item ${activeClass}">
      <div class="sound-info">
        <div class="sound-info-name">${sound.name}</div>
        <div class="sound-info-url">${sound.url}</div>
      </div>
      <div class="sound-actions">
        <button class="btn-secondary" onclick="previewSound('${sound.url}')">🔊 试听</button>
        <button class="${activeBtnClass}" onclick="activateSound(${sound.id})">${activeText}</button>
        <button class="btn-primary" onclick="editSound(${sound.id})">编辑</button>
        <button class="btn-danger" onclick="deleteSound(${sound.id})">删除</button>
      </div>
    </div>
  `;
}

addSoundBtn.addEventListener('click', () => {
  openSoundModal();
});

function openSoundModal(sound = null) {
  if (sound) {
    soundModalTitle.textContent = '编辑音效';
    soundIdInput.value = sound.id;
    soundTypeInput.value = sound.type;
    soundNameInput.value = sound.name;
    soundUrlInput.value = sound.url;
  } else {
    soundModalTitle.textContent = '添加音效';
    soundForm.reset();
    soundIdInput.value = '';
  }

  soundModal.classList.add('show');
}

function closeSoundModal() {
  soundModal.classList.remove('show');
  soundForm.reset();
}

soundModalClose.addEventListener('click', closeSoundModal);
soundModalCancel.addEventListener('click', closeSoundModal);

soundModal.addEventListener('click', (e) => {
  if (e.target === soundModal) {
    closeSoundModal();
  }
});

previewSoundBtn.addEventListener('click', () => {
  const url = soundUrlInput.value;
  if (url) {
    previewSound(url);
  }
});

soundForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    type: soundTypeInput.value,
    name: soundNameInput.value,
    url: soundUrlInput.value
  };

  const soundId = soundIdInput.value;

  try {
    const url = soundId
      ? `${API_BASE}/api/admin/sounds/${soundId}`
      : `${API_BASE}/api/admin/sounds`;

    const method = soundId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      closeSoundModal();
      await loadSounds();
    } else {
      alert('保存失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('保存音效失败:', error);
  }
});

window.previewSound = function(url) {
  const audio = new Audio(url);
  audio.play().catch(() => {
    alert('无法播放音效，请检查URL是否正确');
  });
};

window.activateSound = async function(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/sounds/${id}/activate`, {
      method: 'PUT'
    });

    const data = await res.json();

    if (data.success) {
      await loadSounds();
    } else {
      alert('激活失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('激活音效失败:', error);
  }
};

window.editSound = function(id) {
  const sound = sounds.find(s => s.id === id);
  if (sound) {
    openSoundModal(sound);
  }
};

window.deleteSound = async function(id) {
  if (!confirm('确定要删除这个音效吗？')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/sounds/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (data.success) {
      await loadSounds();
    } else {
      alert('删除失败，请稍后重试');
    }
  } catch (error) {
    alert('网络错误，请稍后重试');
    console.error('删除音效失败:', error);
  }
};

// ==================== 中奖记录 ====================

function renderRecords(records) {
  if (records.length === 0) {
    recordsBody.innerHTML = '<tr><td colspan="2" class="loading">暂无中奖记录</td></tr>';
    return;
  }

  recordsBody.innerHTML = records.map(record => {
    const time = new Date(record.created_at).toLocaleString('zh-CN');
    return `
      <tr>
        <td>${time}</td>
        <td>${record.prize_name}</td>
      </tr>
    `;
  }).join('');
}

// ==================== 定时刷新数据 ====================

setInterval(() => {
  if (isLoggedIn) {
    loadStats();
    loadPrizes();
  }
}, 30000); // 每30秒刷新一次统计数据和奖品库存
