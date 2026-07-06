import * as skinview3d from 'https://cdn.jsdelivr.net/npm/skinview3d@3.4.2/+esm';
const tabGallery = document.getElementById('tab-gallery');
const tabCapes = document.getElementById('tab-capes');
const tabUpload = document.getElementById('tab-upload');
const sectionGallery = document.getElementById('section-gallery');
const sectionCapes = document.getElementById('section-capes');
const sectionUpload = document.getElementById('section-upload');
const skinsGrid = document.getElementById('skins-grid');
const skinsEmptyState = document.getElementById('skins-empty-state');
const capesGrid = document.getElementById('capes-grid');
const capesEmptyState = document.getElementById('capes-empty-state');
const tabNamemc = document.getElementById('tab-namemc');
const sectionNamemc = document.getElementById('section-namemc');
const namemcSearchInput = document.getElementById('namemc-search-input');
const namemcSearchBtn = document.getElementById('namemc-search-btn');
const namemcSearchResult = document.getElementById('namemc-search-result');
const namemcTrendingGrid = document.getElementById('namemc-trending-grid');
const namemcTrendingEmptyState = document.getElementById('namemc-trending-empty-state');
const namemcPrevPage = document.getElementById('namemc-prev-page');
const namemcNextPage = document.getElementById('namemc-next-page');
const namemcCurrentPage = document.getElementById('namemc-current-page');
const namemcTimeFilters = document.getElementById('namemc-time-filters');
const uploadForm = document.getElementById('upload-skin-form');
const fileInput = document.getElementById('skin-file-input');
const dropZone = document.getElementById('drop-zone');
const fileSelectedInfo = document.getElementById('file-selected-info');
const selectedFileName = document.getElementById('selected-file-name');
const clearFileBtn = document.getElementById('clear-file-btn');
const accountCard = document.getElementById('account-card');
const profileLoading = document.getElementById('profile-loading-indicator');
const profileSignedOut = document.getElementById('profile-signed-out');
const profileSignedIn = document.getElementById('profile-signed-in');
const loginButton = document.getElementById('login-button');
const playerName = document.getElementById('player-name');
const playerAvatar = document.getElementById('player-avatar');
const accountsDropdown = document.getElementById('accounts-dropdown');
const accountsList = document.getElementById('accounts-list');
const addAccountButton = document.getElementById('add-account-button');
const previewPanel = document.getElementById('preview-panel');
const canvasContainer = document.getElementById('canvas-container');
const skinViewerCanvas = document.getElementById('skin-viewer-canvas');
const viewerSkinName = document.getElementById('viewer-skin-name');
const controlRotate = document.getElementById('control-rotate');
const controlAnimation = document.getElementById('control-animation');
const selectedVariantTag = document.getElementById('selected-variant-tag');
const applyToMinecraftBtn = document.getElementById('apply-to-minecraft-btn');
const applyStatusText = document.getElementById('apply-status-text');
const deviceModal = document.getElementById('device-login-modal');
const modalCloseBtn = document.getElementById('close-modal-btn');
const modalDeviceCode = document.getElementById('modal-device-code');
const modalLinkBtn = document.getElementById('modal-link-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
let skins = [];
let selectedSkin = null;
let currentProfile = null;
let savedAccounts = [];
let activeUuid = null;
let isLoggedIn = false;
let skinViewerInstance = null;
let activePollingInterval = null;
const DEFAULT_SKIN_URL = 'https://textures.minecraft.net/texture/3b60a1f4d3c6059d4d2f17bc842913e2fec49f3e098862cfec1c19b0d19f5'; 
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  if (type === 'success') {
    toast.querySelector('.toast-content').style.borderColor = 'var(--accent-green)';
    toastMessage.style.color = 'var(--accent-green)';
  } else if (type === 'error') {
    toast.querySelector('.toast-content').style.borderColor = 'var(--accent-red)';
    toastMessage.style.color = 'var(--accent-red)';
  } else {
    toast.querySelector('.toast-content').style.borderColor = '#ffffff';
    toastMessage.style.color = '#ffffff';
  }
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
async function isElectronPlatform() {
  return typeof window.electronAPI !== 'undefined' && await window.electronAPI.isElectron();
}
tabGallery.addEventListener('click', () => {
  tabGallery.classList.add('active');
  tabCapes.classList.remove('active');
  tabNamemc.classList.remove('active');
  tabUpload.classList.remove('active');
  sectionGallery.classList.remove('hidden');
  sectionCapes.classList.add('hidden');
  sectionNamemc.classList.add('hidden');
  sectionUpload.classList.add('hidden');
  if (selectedSkin) {
    previewPanel.classList.remove('hidden');
    setTimeout(resizeCanvas, 0);
  }
});
tabCapes.addEventListener('click', () => {
  tabCapes.classList.add('active');
  tabGallery.classList.remove('active');
  tabNamemc.classList.remove('active');
  tabUpload.classList.remove('active');
  sectionCapes.classList.remove('hidden');
  sectionGallery.classList.add('hidden');
  sectionNamemc.classList.add('hidden');
  sectionUpload.classList.add('hidden');
  previewPanel.classList.add('hidden');
  renderCapes();
});
tabNamemc.addEventListener('click', () => {
  tabNamemc.classList.add('active');
  tabGallery.classList.remove('active');
  tabCapes.classList.remove('active');
  tabUpload.classList.remove('active');
  sectionNamemc.classList.remove('hidden');
  sectionGallery.classList.add('hidden');
  sectionCapes.classList.add('hidden');
  sectionUpload.classList.add('hidden');
  previewPanel.classList.add('hidden');
  loadNamemcTrending();
});
tabUpload.addEventListener('click', () => {
  tabUpload.classList.add('active');
  tabGallery.classList.remove('active');
  tabCapes.classList.remove('active');
  tabNamemc.classList.remove('active');
  sectionUpload.classList.remove('hidden');
  sectionGallery.classList.add('hidden');
  sectionCapes.classList.add('hidden');
  sectionNamemc.classList.add('hidden');
  previewPanel.classList.add('hidden');
});
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
  }, false);
});
['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
  }, false);
});
dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length) {
    fileInput.files = files;
    updateFileDisplay();
  }
});
fileInput.addEventListener('change', updateFileDisplay);
function updateFileDisplay() {
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    if (file.type !== 'image/png') {
      showToast('Please select a valid PNG image file.', 'error');
      fileInput.value = '';
      return;
    }
    selectedFileName.textContent = file.name;
    fileSelectedInfo.classList.remove('hidden');
    dropZone.classList.add('hidden');
  }
}
clearFileBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileSelectedInfo.classList.add('hidden');
  dropZone.classList.remove('hidden');
});
const radioButtons = document.querySelectorAll('input[name="variant"]');
radioButtons.forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.variant-card').forEach(card => {
      card.classList.remove('active');
    });
    radio.parentElement.classList.add('active');
  });
});
const resizeCanvas = () => {
  if (!canvasContainer) return;
  const rect = canvasContainer.getBoundingClientRect();
  if (skinViewerInstance) {
    skinViewerInstance.setSize(rect.width, rect.height);
  }
};
function init3DSkinViewer() {
  skinViewerInstance = new skinview3d.SkinViewer({
    canvas: skinViewerCanvas,
    width: canvasContainer.clientWidth,
    height: canvasContainer.clientHeight,
    skin: DEFAULT_SKIN_URL
  });
  skinViewerInstance.autoRotate = controlRotate.checked;
  skinViewerInstance.autoRotateSpeed = 0.6;
  skinViewerInstance.fov = 70;
  skinViewerInstance.zoom = 0.9;
  updateViewerAnimation();
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 100);
}
controlAnimation.addEventListener('change', updateViewerAnimation);
controlRotate.addEventListener('change', () => {
  if (skinViewerInstance) {
    skinViewerInstance.autoRotate = controlRotate.checked;
  }
});
function updateViewerAnimation() {
  if (!skinViewerInstance) return;
  const animType = controlAnimation.value;
  if (animType === 'walk') {
    skinViewerInstance.animation = new skinview3d.WalkingAnimation();
  } else if (animType === 'run') {
    skinViewerInstance.animation = new skinview3d.RunningAnimation();
  } else if (animType === 'idle') {
    skinViewerInstance.animation = new skinview3d.IdleAnimation();
  } else if (animType === 'fly') {
    skinViewerInstance.animation = new skinview3d.FlyingAnimation();
  } else {
    skinViewerInstance.animation = null;
  }
}
function drawSkin2D(canvas, imageUrl, isSlim) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;
  img.onload = () => {
    const isOldLayout = img.height === 32;
    canvas.width = 100;
    canvas.height = 130;
    const scale = 3.5;
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    const xOff = 22;
    const yOff = 9;
    ctx.drawImage(img, 4, 20, 4, 12, xOff + (4 * scale), yOff + (20 * scale), 4 * scale, 12 * scale);
    if (!isOldLayout) {
      ctx.drawImage(img, 4, 36, 4, 12, xOff + (4 * scale), yOff + (20 * scale), 4 * scale, 12 * scale);
    }
    if (isOldLayout) {
      ctx.drawImage(img, 4, 20, 4, 12, xOff + (8 * scale), yOff + (20 * scale), 4 * scale, 12 * scale);
    } else {
      ctx.drawImage(img, 20, 52, 4, 12, xOff + (8 * scale), yOff + (20 * scale), 4 * scale, 12 * scale);
      ctx.drawImage(img, 4, 52, 4, 12, xOff + (8 * scale), yOff + (20 * scale), 4 * scale, 12 * scale);
    }
    ctx.drawImage(img, 20, 20, 8, 12, xOff + (4 * scale), yOff + (8 * scale), 8 * scale, 12 * scale);
    if (!isOldLayout) {
      ctx.drawImage(img, 20, 36, 8, 12, xOff + (4 * scale), yOff + (8 * scale), 8 * scale, 12 * scale);
    }
    const armW = isSlim ? 3 : 4;
    const armXOff = isSlim ? 1 : 0;
    ctx.drawImage(img, 44, 20, 4, 12, xOff + (4 * scale) - (armW * scale), yOff + (8 * scale), armW * scale, 12 * scale);
    if (!isOldLayout) {
      ctx.drawImage(img, 44, 36, 4, 12, xOff + (4 * scale) - (armW * scale), yOff + (8 * scale), armW * scale, 12 * scale);
    }
    if (isOldLayout) {
      ctx.drawImage(img, 44, 20, 4, 12, xOff + (12 * scale) - armXOff, yOff + (8 * scale), armW * scale, 12 * scale);
    } else {
      ctx.drawImage(img, 36, 52, 4, 12, xOff + (12 * scale) - armXOff, yOff + (8 * scale), armW * scale, 12 * scale);
      ctx.drawImage(img, 52, 52, 4, 12, xOff + (12 * scale) - armXOff, yOff + (8 * scale), armW * scale, 12 * scale);
    }
    ctx.drawImage(img, 8, 8, 8, 8, xOff + (4 * scale), yOff, 8 * scale, 8 * scale);
    ctx.drawImage(img, 40, 8, 8, 8, xOff + (4 * scale), yOff, 8 * scale, 8 * scale);
  };
  img.onerror = () => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
}
function drawCape2D(canvas, imageUrl) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;
  img.onload = () => {
    canvas.width = 60;
    canvas.height = 96;
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    const srcX = (img.width === 22) ? 1 : 2;
    ctx.drawImage(img, srcX, 1, 10, 16, 0, 0, canvas.width, canvas.height);
  };
  img.onerror = () => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
}
async function fetchSkins() {
  try {
    const res = await fetch('/api/skins');
    if (!res.ok) throw new Error('Failed to load skin database');
    skins = await res.json();
    renderSkins();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function renderSkins() {
  skinsGrid.innerHTML = '';
  if (skins.length === 0) {
    skinsEmptyState.classList.remove('hidden');
    return;
  }
  skinsEmptyState.classList.add('hidden');
  skins.forEach(skin => {
    const card = document.createElement('div');
    card.className = 'skin-card';
    if (selectedSkin && selectedSkin.id === skin.id) {
      card.classList.add('selected');
    }
    card.innerHTML = `
      <div class="skin-card-canvas-container">
        <canvas class="skin-card-canvas" id="canvas-${skin.id}"></canvas>
      </div>
      <div class="skin-name">${escapeHTML(skin.name)}</div>
      <div class="skin-variant-badge">${skin.variant.toUpperCase()}</div>
      <div class="skin-card-actions">
        <button class="card-action-btn select-btn" data-id="${skin.id}">SELECT</button>
        <button class="card-action-btn card-delete-btn" data-id="${skin.id}" title="Delete">
          &times;
        </button>
      </div>
    `;
    setTimeout(() => {
      const c = document.getElementById(`canvas-${skin.id}`);
      if (c) drawSkin2D(c, skin.url, skin.variant === 'slim');
    }, 20);
    const selectBtn = card.querySelector('.select-btn');
    selectBtn.addEventListener('click', () => selectSkin(skin));
    const deleteBtn = card.querySelector('.card-delete-btn');
    deleteBtn.addEventListener('click', () => deleteSkin(skin.id));
    skinsGrid.appendChild(card);
  });
}
function renderCapes() {
  capesGrid.innerHTML = '';
  if (!isLoggedIn || !currentProfile) {
    capesEmptyState.classList.remove('hidden');
    capesEmptyState.querySelector('h3').textContent = 'Not logged in';
    capesEmptyState.querySelector('p').textContent = 'Please log in with a Premium account to view your capes.';
    return;
  }
  const capes = currentProfile.capes || [];
  capesEmptyState.classList.add('hidden');
  const noneActive = !capes.some(c => c.state === 'ACTIVE');
  const noneCard = document.createElement('div');
  noneCard.className = 'cape-card';
  if (noneActive) {
    noneCard.classList.add('selected');
  }
  noneCard.innerHTML = `
    <div class="cape-card-canvas-container">
      <canvas class="cape-card-canvas" id="canvas-cape-none"></canvas>
    </div>
    <div class="cape-name">No Cape</div>
    <div class="cape-card-actions">
      <button class="card-action-btn select-cape-btn" data-id="none" ${noneActive ? 'disabled' : ''}>
        ${noneActive ? 'ACTIVE' : 'SELECT'}
      </button>
    </div>
  `;
  setTimeout(() => {
    const c = document.getElementById('canvas-cape-none');
    if (c) {
      c.width = 60;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = 'rgba(255, 77, 109, 0.7)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const cx = c.width / 2;
      const cy = c.height / 2;
      const r = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      const angle = Math.PI / 4;
      const dx = r * Math.cos(angle);
      const dy = r * Math.sin(angle);
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    }
  }, 20);
  noneCard.querySelector('.select-cape-btn').addEventListener('click', () => equipCape('none'));
  capesGrid.appendChild(noneCard);
  capes.forEach(cape => {
    const card = document.createElement('div');
    card.className = 'cape-card';
    const isActive = cape.state === 'ACTIVE';
    if (isActive) {
      card.classList.add('selected');
    }
    card.innerHTML = `
      <div class="cape-card-canvas-container">
        <canvas class="cape-card-canvas" id="canvas-cape-${cape.id}"></canvas>
      </div>
      <div class="cape-name">${escapeHTML(cape.alias)}</div>
      <div class="cape-card-actions">
        <button class="card-action-btn select-cape-btn" data-id="${cape.id}" ${isActive ? 'disabled' : ''}>
          ${isActive ? 'ACTIVE' : 'SELECT'}
        </button>
      </div>
    `;
    setTimeout(() => {
      const c = document.getElementById(`canvas-cape-${cape.id}`);
      if (c) drawCape2D(c, cape.url);
    }, 20);
    const selectBtn = card.querySelector('.select-cape-btn');
    selectBtn.addEventListener('click', () => equipCape(cape.id));
    capesGrid.appendChild(card);
  });
}
async function equipCape(capeId) {
  if (!isLoggedIn) return;
  const selectBtn = document.querySelector(`.select-cape-btn[data-id="${capeId}"]`);
  if (selectBtn) {
    selectBtn.disabled = true;
    selectBtn.textContent = 'EQUIPPING...';
  }
  try {
    const res = await fetch('/api/capes/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capeId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to equip cape.');
    }
    const data = await res.json();
    currentProfile = data.profile;
    updateAuthDisplay();
    if (skinViewerInstance && selectedSkin) {
      const activeCape = currentProfile?.capes?.find(c => c.state === 'ACTIVE');
      if (activeCape) {
        skinViewerInstance.loadCape(activeCape.url);
      } else {
        skinViewerInstance.loadCape(null);
      }
    }
    showToast('Cape equipped successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    updateAuthDisplay();
  }
}
function selectSkin(skin) {
  selectedSkin = skin;
  document.querySelectorAll('.skin-card').forEach(card => {
    card.classList.remove('selected');
  });
  const selectedCard = document.querySelector(`.select-btn[data-id="${skin.id}"]`);
  if (selectedCard) {
    selectedCard.closest('.skin-card').classList.add('selected');
  }
  viewerSkinName.textContent = skin.name;
  selectedVariantTag.textContent = skin.variant.toUpperCase();
  previewPanel.classList.remove('hidden');
  setTimeout(resizeCanvas, 0);
  if (skinViewerInstance) {
    skinViewerInstance.loadSkin(skin.url, {
      model: skin.variant === 'slim' ? 'slim' : 'default'
    });
    const activeCape = currentProfile?.capes?.find(c => c.state === 'ACTIVE');
    if (activeCape) {
      skinViewerInstance.loadCape(activeCape.url);
    } else {
      skinViewerInstance.loadCape(null);
    }
  }
  updateApplyBtnState();
}
async function deleteSkin(id) {
  if (!confirm('Are you sure you want to delete this skin from the project?')) return;
  try {
    const res = await fetch(`/api/skins/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete skin');
    const data = await res.json();
    skins = data.skins;
    if (selectedSkin && selectedSkin.id === id) {
      resetToDefaultPreview();
    }
    renderSkins();
    showToast('Skin deleted successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function resetToDefaultPreview() {
  selectedSkin = null;
  viewerSkinName.textContent = 'Default Steve';
  selectedVariantTag.textContent = 'CLASSIC';
  if (skinViewerInstance) {
    skinViewerInstance.loadSkin(DEFAULT_SKIN_URL, { model: 'default' });
    skinViewerInstance.loadCape(null);
  }
  previewPanel.classList.add('hidden');
  updateApplyBtnState();
}
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('skin-name-input').value;
  const variant = document.querySelector('input[name="variant"]:checked').value;
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a file to upload.', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('skin', file);
  formData.append('name', name);
  formData.append('variant', variant);
  const uploadBtn = document.getElementById('upload-submit-btn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'UPLOADING...';
  try {
    const res = await fetch('/api/skins/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to upload skin');
    }
    const data = await res.json();
    skins = data.skins;
    uploadForm.reset();
    fileSelectedInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
    document.querySelectorAll('.variant-card').forEach(card => card.classList.remove('active'));
    document.querySelector('input[name="variant"][value="classic"]').parentElement.classList.add('active');
    tabGallery.click();
    renderSkins();
    const newlyAdded = skins[skins.length - 1];
    if (newlyAdded) selectSkin(newlyAdded);
    showToast('Skin added to library!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'UPLOAD';
  }
});
function updateApplyBtnState() {
  if (!isLoggedIn) {
    applyToMinecraftBtn.disabled = true;
    applyToMinecraftBtn.classList.add('disabled');
    applyStatusText.textContent = 'Log in to update your Minecraft premium skin';
  } else if (!selectedSkin) {
    applyToMinecraftBtn.disabled = true;
    applyToMinecraftBtn.classList.add('disabled');
    applyStatusText.textContent = 'Select a custom skin from the library to apply';
  } else {
    applyToMinecraftBtn.disabled = false;
    applyToMinecraftBtn.classList.remove('disabled');
    applyStatusText.textContent = '';
  }
}
applyToMinecraftBtn.addEventListener('click', async () => {
  if (!isLoggedIn || !selectedSkin) return;
  applyToMinecraftBtn.disabled = true;
  applyToMinecraftBtn.textContent = 'APPLYING SKIN...';
  try {
    const res = await fetch(`/api/skins/apply/${selectedSkin.id}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to apply skin');
    }
    const data = await res.json();
    currentProfile = data.profile;
    updateAuthDisplay();
    showToast('Skin successfully applied! Restart Minecraft to see it.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    applyToMinecraftBtn.textContent = 'APPLY SKIN TO MINECRAFT';
    updateApplyBtnState();
  }
});
accountCard.addEventListener('click', (e) => {
  if (e.target.id === 'login-button' || e.target.closest('#login-button')) return;
  accountsDropdown.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!accountCard.contains(e.target) && !accountsDropdown.contains(e.target)) {
    accountsDropdown.classList.add('hidden');
  }
});
function renderAccountsList() {
  accountsList.innerHTML = '';
  if (savedAccounts.length === 0) {
    accountsList.innerHTML = '<div style="font-size: 8px; color: var(--text-muted); text-align: center; padding: 10px 0;">No accounts saved</div>';
    return;
  }
  savedAccounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-item';
    if (acc.uuid === activeUuid) {
      item.classList.add('active');
    }
    item.innerHTML = `
      <div class="account-item-info">
        <img class="account-item-avatar" src="https://mc-heads.net/avatar/${acc.uuid}/24" alt="${escapeHTML(acc.name)}">
        <span class="account-item-name">${escapeHTML(acc.name)}</span>
      </div>
      <button class="account-item-remove" data-uuid="${acc.uuid}" title="Remove Account">&times;</button>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('account-item-remove')) return;
      switchAccount(acc.uuid);
    });
    const removeBtn = item.querySelector('.account-item-remove');
    removeBtn.addEventListener('click', () => removeAccount(acc.uuid));
    accountsList.appendChild(item);
  });
}
async function switchAccount(uuid) {
  if (uuid === activeUuid) return;
  profileLoading.classList.remove('hidden');
  profileSignedIn.classList.add('hidden');
  profileSignedOut.classList.add('hidden');
  accountsDropdown.classList.add('hidden');
  try {
    const res = await fetch('/api/auth/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to switch profile');
    }
    const data = await res.json();
    isLoggedIn = true;
    currentProfile = data.profile;
    savedAccounts = data.accounts;
    activeUuid = data.activeUuid;
    updateAuthDisplay();
    resetToDefaultPreview(); 
    fetchSkins(); 
    showToast(`Switched account to: ${currentProfile.name}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    checkAuthStatus();
  }
}
async function removeAccount(uuid) {
  if (!confirm('Are you sure you want to remove this account from the launcher?')) return;
  try {
    const res = await fetch('/api/auth/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });
    if (!res.ok) throw new Error('Failed to remove account');
    const data = await res.json();
    savedAccounts = data.accounts;
    activeUuid = data.activeUuid;
    if (uuid === currentProfile?.id) {
      isLoggedIn = activeUuid !== null;
      currentProfile = isLoggedIn ? savedAccounts.find(a => a.uuid === activeUuid).profile : null;
      resetToDefaultPreview();
      fetchSkins();
    }
    updateAuthDisplay();
    showToast('Account removed successfully', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
addAccountButton.addEventListener('click', () => {
  accountsDropdown.classList.add('hidden');
  triggerLogin();
});
async function checkAuthStatus() {
  profileLoading.classList.remove('hidden');
  profileSignedOut.classList.add('hidden');
  profileSignedIn.classList.add('hidden');
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    isLoggedIn = data.loggedIn;
    currentProfile = data.profile || null;
    savedAccounts = data.accounts || [];
    activeUuid = data.activeUuid || null;
    updateAuthDisplay();
  } catch (err) {
    console.error('Failed to check auth status:', err);
    isLoggedIn = false;
    currentProfile = null;
    updateAuthDisplay();
  }
}
function updateAuthDisplay() {
  profileLoading.classList.add('hidden'); 
  if (isLoggedIn && currentProfile) {
    profileSignedOut.classList.add('hidden');
    profileSignedIn.classList.remove('hidden');
    playerName.textContent = currentProfile.name;
    playerAvatar.src = `https://mc-heads.net/avatar/${currentProfile.id}/40`;
  } else {
    profileSignedIn.classList.add('hidden');
    profileSignedOut.classList.remove('hidden');
  }
  renderAccountsList();
  updateApplyBtnState();
  renderCapes();
}
async function triggerLogin() {
  const isElectron = await isElectronPlatform();
  if (isElectron) {
    try {
      showToast('Opening Microsoft Sign In...', 'info');
      const code = await window.electronAPI.loginMicrosoft();
      profileLoading.classList.remove('hidden');
      profileSignedOut.classList.add('hidden');
      profileSignedIn.classList.add('hidden');
      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Authentication handshake failed.');
      }
      const data = await res.json();
      isLoggedIn = true;
      currentProfile = data.profile;
      savedAccounts = data.accounts;
      activeUuid = data.activeUuid;
      updateAuthDisplay();
      resetToDefaultPreview();
      fetchSkins(); 
      showToast(`Welcome, ${currentProfile.name}!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
      checkAuthStatus();
    }
  } else {
    try {
      const res = await fetch('/api/auth/device-code');
      if (!res.ok) throw new Error('Could not initiate device code flow.');
      const data = await res.json();
      modalDeviceCode.textContent = data.userCode;
      modalLinkBtn.href = data.verificationUri;
      deviceModal.classList.remove('hidden');
      startDevicePolling(data.deviceCode, data.interval);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
loginButton.addEventListener('click', triggerLogin);
function startDevicePolling(deviceCode, intervalSeconds) {
  if (activePollingInterval) clearInterval(activePollingInterval);
  const pollInterval = intervalSeconds * 1000 || 5000;
  activePollingInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/auth/device-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode })
      });
      const data = await res.json();
      if (res.status === 400) {
        clearInterval(activePollingInterval);
        deviceModal.classList.add('hidden');
        showToast(data.error || 'Authentication timed out.', 'error');
        return;
      }
      if (data.success) {
        clearInterval(activePollingInterval);
        deviceModal.classList.add('hidden');
        isLoggedIn = true;
        currentProfile = data.profile;
        savedAccounts = data.accounts;
        activeUuid = data.activeUuid;
        updateAuthDisplay();
        resetToDefaultPreview();
        fetchSkins();
        showToast(`Logged in successfully as ${currentProfile.name}!`, 'success');
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, pollInterval);
}
modalCloseBtn.addEventListener('click', () => {
  if (activePollingInterval) clearInterval(activePollingInterval);
  deviceModal.classList.add('hidden');
});
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
let namemcTrendingSkins = [];
let namemcCategory = 'popular';
let namemcTime = 'day';
let namemcPage = 1;
const sideButtons = document.querySelectorAll('.namemc-side-btn');
const timeButtons = document.querySelectorAll('.namemc-time-btn');
sideButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    sideButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    namemcCategory = btn.dataset.category;
    namemcPage = 1;
    if (namemcCategory === 'popular') {
      namemcTimeFilters.classList.remove('hidden');
    } else {
      namemcTimeFilters.classList.add('hidden');
    }
    updatePaginatorUI();
    loadNamemcTrending();
  });
});
timeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    timeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    namemcTime = btn.dataset.time;
    namemcPage = 1;
    updatePaginatorUI();
    loadNamemcTrending();
  });
});
namemcPrevPage.addEventListener('click', () => {
  if (namemcPage > 1) {
    namemcPage--;
    updatePaginatorUI();
    loadNamemcTrending();
  }
});
namemcNextPage.addEventListener('click', () => {
  namemcPage++;
  updatePaginatorUI();
  loadNamemcTrending();
});
function updatePaginatorUI() {
  namemcCurrentPage.textContent = `Page ${namemcPage}`;
  namemcPrevPage.disabled = (namemcPage <= 1);
  if (namemcCategory === 'random') {
    namemcPrevPage.disabled = true;
    namemcNextPage.disabled = true;
    namemcCurrentPage.textContent = 'Randomizer';
  } else {
    namemcNextPage.disabled = false;
  }
}
async function loadNamemcTrending() {
  namemcTrendingGrid.innerHTML = '<div class="profile-loading" style="grid-column: 1/-1; text-align: center;">LOADING SKINS...</div>';
  namemcTrendingEmptyState.classList.add('hidden');
  try {
    const res = await fetch(`/api/namemc/trending?category=${namemcCategory}&time=${namemcTime}&page=${namemcPage}`);
    if (!res.ok) throw new Error('Failed to load skins from database');
    namemcTrendingSkins = await res.json();
    renderNamemcTrending();
  } catch (err) {
    namemcTrendingGrid.innerHTML = '';
    namemcTrendingEmptyState.classList.remove('hidden');
  }
}
function renderNamemcTrending() {
  namemcTrendingGrid.innerHTML = '';
  if (namemcTrendingSkins.length === 0) {
    namemcTrendingEmptyState.classList.remove('hidden');
    return;
  }
  namemcTrendingSkins.forEach(skin => {
    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
      <div class="skin-card-canvas-container">
        <canvas class="skin-card-canvas" width="80" height="110"></canvas>
      </div>
      <div class="skin-name">${escapeHTML(skin.name)}</div>
      <div class="skin-card-actions" style="opacity: 1;">
        <button class="glass-btn import-btn" data-id="${skin.id}" style="width: 100%;">UPLOAD TO GALLERY</button>
      </div>
    `;
    const importBtn = card.querySelector('.import-btn');
    importBtn.addEventListener('click', () => importSkin(skin.name, skin.downloadUrl));
    namemcTrendingGrid.appendChild(card);
    const canvas = card.querySelector('.skin-card-canvas');
    drawSkin2D(canvas, `/api/namemc/texture/${skin.id}`, false);
  });
}
async function searchNamemcPlayer() {
  const username = namemcSearchInput.value.trim();
  if (!username) {
    showToast('Please enter a username to search.', 'error');
    return;
  }
  namemcSearchResult.innerHTML = '<div class="profile-loading" style="text-align: center; padding: 20px;">LOOKING UP PLAYER PROFILE...</div>';
  try {
    const res = await fetch(`/api/namemc/search?username=${encodeURIComponent(username)}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Player profile not found.');
      }
      throw new Error('Mojang API lookup failed.');
    }
    const player = await res.json();
    namemcSearchResult.innerHTML = `
      <div class="namemc-player-card glass-panel">
        <div class="namemc-player-card-image">
          <img src="${player.previewUrl}" alt="${player.username}">
        </div>
        <div class="namemc-player-card-info">
          <div class="namemc-player-card-name">${escapeHTML(player.username)}</div>
          <div class="namemc-player-card-details">Active skin texture verified on official Mojang servers.</div>
          <button class="glass-btn namemc-import-btn">UPLOAD TO GALLERY</button>
        </div>
      </div>
    `;
    const importBtn = namemcSearchResult.querySelector('.namemc-import-btn');
    importBtn.addEventListener('click', () => importSkin(`${player.username}'s Skin`, player.downloadUrl));
  } catch (err) {
    namemcSearchResult.innerHTML = `
      <div class="glass-panel" style="padding: 20px; text-align: center; color: var(--accent-red); font-family: var(--font-pixel); font-size: 11px;">
        ${escapeHTML(err.message)}
      </div>
    `;
  }
}
async function importSkin(name, url) {
  showToast(`Importing skin: ${name}...`, 'info');
  try {
    const res = await fetch('/api/namemc/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, variant: 'classic', url })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to import skin file.');
    }
    const data = await res.json();
    skins = data.skins;
    renderSkins();
    showToast(`Skin "${name}" successfully added to your project!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
namemcSearchBtn.addEventListener('click', searchNamemcPlayer);
namemcSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchNamemcPlayer();
  }
});
document.addEventListener('DOMContentLoaded', () => {
  init3DSkinViewer();
  fetchSkins();
  checkAuthStatus();
});