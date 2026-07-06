const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const userDataPath = process.env.USER_DATA_PATH || __dirname;
const skinsDir = path.join(userDataPath, 'skins');
if (!fs.existsSync(skinsDir)) {
  fs.mkdirSync(skinsDir, { recursive: true });
}
const configPath = path.join(userDataPath, 'config.json');
const dbPath = path.join(userDataPath, 'skins.json');
function readSkinsDB() {
  try {
    if (!fs.existsSync(dbPath)) return [];
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    console.error('Error reading skins.json:', err);
    return [];
  }
}
function writeSkinsDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing skins.json:', err);
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, skinsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'skin-' + uniqueSuffix + '.png');
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed.'));
    }
  }
});
let activeAccountUuid = null;
let accounts = []; 
function loadSavedSession() {
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.accounts && Array.isArray(data.accounts)) {
        accounts = data.accounts.map(acc => ({
          uuid: acc.uuid,
          name: acc.name,
          refreshToken: acc.refreshToken,
          msToken: null,
          mcToken: null,
          profile: { id: acc.uuid, name: acc.name }, 
          tokenExpiresAt: 0
        }));
        activeAccountUuid = data.activeAccountUuid || (accounts[0] ? accounts[0].uuid : null);
        console.log(`Loaded ${accounts.length} saved accounts. Active Account: ${activeAccountUuid}`);
      }
    }
  } catch (err) {
    console.error('Failed to load saved config.json:', err);
  }
}
loadSavedSession();
function saveSession() {
  try {
    const listToSave = accounts.map(acc => ({
      uuid: acc.uuid,
      name: acc.name,
      refreshToken: acc.refreshToken
    }));
    fs.writeFileSync(configPath, JSON.stringify({
      activeAccountUuid: activeAccountUuid,
      accounts: listToSave
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save session to config.json:', err);
  }
}
function getActiveAccount() {
  if (!activeAccountUuid) return null;
  return accounts.find(acc => acc.uuid === activeAccountUuid) || null;
}
function removeAccount(uuid) {
  const index = accounts.findIndex(a => a.uuid === uuid);
  if (index !== -1) {
    const name = accounts[index].name;
    accounts.splice(index, 1);
    console.log(`Removed account: ${name} (${uuid})`);
    if (activeAccountUuid === uuid) {
      activeAccountUuid = accounts[0] ? accounts[0].uuid : null;
    }
    saveSession();
  }
}
function getSafeAccountsList() {
  return accounts.map(acc => ({
    uuid: acc.uuid,
    name: acc.name,
    profile: acc.profile || { id: acc.uuid, name: acc.name }
  }));
}
function updateAccountTokens(uuid, name, refreshToken, msToken, mcToken, profile, expires_in) {
  let acc = accounts.find(a => a.uuid === uuid);
  if (!acc) {
    acc = { uuid };
    accounts.push(acc);
  }
  acc.name = name;
  acc.refreshToken = refreshToken;
  acc.msToken = msToken;
  acc.mcToken = mcToken;
  acc.profile = profile;
  acc.tokenExpiresAt = Date.now() + (expires_in * 1000);
  activeAccountUuid = uuid;
  saveSession();
  return acc;
}
const CLIENT_ID = '00000000402b5328';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const SCOPES = 'XboxLive.signin offline_access';
async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES
  });
  const res = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Microsoft token exchange failed: ${errorText}`);
  }
  return await res.json();
}
async function authenticateXboxLive(msAccessToken) {
  const res = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Xbox Live authentication failed: ${errorText}`);
  }
  const json = await res.json();
  return {
    token: json.Token,
    userHash: json.DisplayClaims.xui[0].uhs
  };
}
async function authenticateXSTS(xblToken) {
  const res = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });
  if (res.status === 401) {
    const json = await res.json();
    const xerr = json.XErr;
    if (xerr === 2148916233) {
      throw new Error('This Microsoft Account does not have an Xbox Live profile. Please create one on xbox.com.');
    } else if (xerr === 2148916238) {
      throw new Error('This Microsoft Account is a child account and requires parental consent to play Minecraft.');
    } else {
      throw new Error(`XSTS Authentication failed. Code: ${xerr}. Make sure you have signed up for Xbox Live.`);
    }
  }
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`XSTS authentication failed: ${errorText}`);
  }
  const json = await res.json();
  return {
    token: json.Token,
    userHash: json.DisplayClaims.xui[0].uhs
  };
}
async function loginWithMinecraft(userHash, xstsToken) {
  const res = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Minecraft login failed: ${errorText}`);
  }
  const json = await res.json();
  return json.access_token;
}
async function getMinecraftProfile(mcToken) {
  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${mcToken}`
    }
  });
  if (res.status === 404) {
    throw new Error('You do not own Minecraft Premium on this Microsoft Account.');
  }
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Minecraft profile (Status ${res.status} ${res.statusText}): ${errorText}`);
  }
  return await res.json();
}
async function ensureAuthenticated() {
  const acc = getActiveAccount();
  if (!acc) {
    throw new Error('Not authenticated.');
  }
  if (acc.mcToken && acc.profile && Date.now() < acc.tokenExpiresAt) {
    return acc.mcToken;
  }
  console.log(`Token expired or not initialized for ${acc.name}. Re-authenticating...`);
  if (acc.refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: acc.refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES
      });
      const res = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      if (!res.ok) {
        removeAccount(acc.uuid);
        throw new Error(`Session expired for ${acc.name}. Plase log in again.`);
      }
      const json = await res.json();
      const xbl = await authenticateXboxLive(json.access_token);
      const xsts = await authenticateXSTS(xbl.token);
      const mcToken = await loginWithMinecraft(xsts.userHash, xsts.token);
      const profile = await getMinecraftProfile(mcToken);
      acc.name = profile.name;
      acc.refreshToken = json.refresh_token;
      acc.msToken = json.access_token;
      acc.mcToken = mcToken;
      acc.profile = profile;
      acc.tokenExpiresAt = Date.now() + (json.expires_in * 1000);
      saveSession();
      return mcToken;
    } catch (err) {
      console.warn(`Auto-refresh failed for ${acc.name}:`, err.message);
      if (err.message.includes('expired') || err.message.includes('invalid')) {
        removeAccount(acc.uuid);
      }
      throw err;
    }
  }
  throw new Error('Not authenticated.');
}
app.get('/api/auth/status', async (req, res) => {
  try {
    const activeAcc = getActiveAccount();
    if (!activeAcc) {
      return res.json({
        loggedIn: false,
        accounts: getSafeAccountsList()
      });
    }
    const mcToken = await ensureAuthenticated();
    res.json({
      loggedIn: true,
      profile: activeAcc.profile,
      accounts: getSafeAccountsList(),
      activeUuid: activeAccountUuid
    });
  } catch (err) {
    res.json({
      loggedIn: false,
      error: err.message,
      accounts: getSafeAccountsList()
    });
  }
});
app.get('/api/auth/login-url', (req, res) => {
  const loginUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&prompt=select_account`;
  res.json({ url: loginUrl });
});
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required.' });
  }
  try {
    console.log('Exchanging auth code...');
    const msaTokens = await exchangeCodeForTokens(code);
    console.log('Authenticating with Xbox Live...');
    const xbl = await authenticateXboxLive(msaTokens.access_token);
    console.log('Authenticating with XSTS...');
    const xsts = await authenticateXSTS(xbl.token);
    console.log('Logging in to Minecraft...');
    const mcToken = await loginWithMinecraft(xsts.userHash, xsts.token);
    console.log('Fetching Minecraft profile...');
    const profile = await getMinecraftProfile(mcToken);
    const acc = updateAccountTokens(
      profile.id,
      profile.name,
      msaTokens.refresh_token,
      msaTokens.access_token,
      mcToken,
      profile,
      msaTokens.expires_in
    );
    res.json({
      success: true,
      profile: profile,
      accounts: getSafeAccountsList(),
      activeUuid: activeAccountUuid
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/auth/switch', async (req, res) => {
  const { uuid } = req.body;
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required.' });
  }
  const acc = accounts.find(a => a.uuid === uuid);
  if (!acc) {
    return res.status(404).json({ error: 'Account not found.' });
  }
  try {
    activeAccountUuid = uuid;
    saveSession();
    const mcToken = await ensureAuthenticated();
    res.json({
      success: true,
      profile: acc.profile,
      accounts: getSafeAccountsList(),
      activeUuid: activeAccountUuid
    });
  } catch (err) {
    console.error('Switch account error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/auth/remove', (req, res) => {
  const { uuid } = req.body;
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required.' });
  }
  removeAccount(uuid);
  res.json({
    success: true,
    accounts: getSafeAccountsList(),
    activeUuid: activeAccountUuid
  });
});
let activeDeviceCodes = new Map();
app.get('/api/auth/device-code', async (req, res) => {
  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES
    });
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    if (!response.ok) {
      throw new Error('Failed to request Microsoft device code.');
    }
    const data = await response.json();
    activeDeviceCodes.set(data.device_code, {
      expires: Date.now() + (data.expires_in * 1000),
      interval: data.interval
    });
    res.json({
      userCode: data.user_code,
      deviceCode: data.device_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/auth/device-poll', async (req, res) => {
  const { deviceCode } = req.body;
  if (!deviceCode) {
    return res.status(400).json({ error: 'deviceCode is required.' });
  }
  const stored = activeDeviceCodes.get(deviceCode);
  if (!stored) {
    return res.status(400).json({ error: 'Device code flow not found or expired.' });
  }
  if (Date.now() > stored.expires) {
    activeDeviceCodes.delete(deviceCode);
    return res.status(400).json({ error: 'Device code expired. Please restart login.' });
  }
  try {
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: CLIENT_ID,
      device_code: deviceCode
    });
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await response.json();
    if (response.status === 400 && data.error === 'authorization_pending') {
      return res.json({ success: false, status: 'pending' });
    }
    if (!response.ok) {
      throw new Error(data.error_description || 'Device authentication failed.');
    }
    activeDeviceCodes.delete(deviceCode);
    console.log('Device code complete. Fetching Minecraft credentials...');
    const xbl = await authenticateXboxLive(data.access_token);
    const xsts = await authenticateXSTS(xbl.token);
    const mcToken = await loginWithMinecraft(xsts.userHash, xsts.token);
    const profile = await getMinecraftProfile(mcToken);
    updateAccountTokens(
      profile.id,
      profile.name,
      data.refresh_token,
      data.access_token,
      mcToken,
      profile,
      data.expires_in
    );
    res.json({
      success: true,
      profile: profile,
      accounts: getSafeAccountsList(),
      activeUuid: activeAccountUuid
    });
  } catch (err) {
    console.error('Device code polling error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/auth/logout', (req, res) => {
  if (activeAccountUuid) {
    removeAccount(activeAccountUuid);
  }
  res.json({
    success: true,
    accounts: getSafeAccountsList(),
    activeUuid: activeAccountUuid
  });
});
app.post('/api/capes/apply', async (req, res) => {
  const { capeId } = req.body;
  const activeAcc = getActiveAccount();
  if (!activeAcc) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  try {
    const mcToken = await ensureAuthenticated();
    if (!capeId || capeId === 'none') {
      const deleteRes = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${mcToken}`
        }
      });
      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        throw new Error(`Mojang API error (Status ${deleteRes.status} ${deleteRes.statusText}): ${errText}`);
      }
    } else {
      const applyRes = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${mcToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ capeId })
      });
      if (!applyRes.ok) {
        const errText = await applyRes.text();
        throw new Error(`Mojang API error (Status ${applyRes.status} ${applyRes.statusText}): ${errText}`);
      }
    }
    if (activeAcc.profile && activeAcc.profile.capes) {
      activeAcc.profile.capes.forEach(c => {
        c.state = (c.id === capeId) ? 'ACTIVE' : 'INACTIVE';
      });
    }
    saveSession();
    res.json({
      success: true,
      message: (!capeId || capeId === 'none') ? 'Cape unequipped successfully!' : 'Cape successfully equipped!',
      profile: activeAcc.profile
    });
  } catch (err) {
    console.error('Failed to update cape status:', err);
    res.status(500).json({ error: err.message });
  }
});
function scrapeUrlViaElectron(url) {
  return new Promise((resolve, reject) => {
    const { BrowserWindow, app } = require('electron');
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    const handleCert = (event, webContents, url, list, callback) => {
      event.preventDefault();
      callback(null);
    };
    app.on('select-client-certificate', handleCert);
    win.loadURL(url)
      .then(async () => {
        const html = await win.webContents.executeJavaScript('document.body.innerHTML');
        win.destroy();
        app.off('select-client-certificate', handleCert);
        resolve(html);
      })
      .catch((err) => {
        win.destroy();
        app.off('select-client-certificate', handleCert);
        reject(err);
      });
  });
}
app.get('/api/namemc/trending', async (req, res) => {
  const category = req.query.category || 'popular';
  const time = req.query.time || 'day';
  const page = parseInt(req.query.page) || 1;
  const pageSize = 8;
  const skinsPerWebPage = 30;
  if (category === 'random') {
    try {
      const html = await scrapeUrlViaElectron('https://namemc.com/minecraft-skins/random');
      const regex = /\/skin\/([a-f0-9]{16})/g;
      let match;
      const hashes = new Set();
      while ((match = regex.exec(html)) !== null) {
        hashes.add(match[1]);
      }
      const arr = Array.from(hashes);
      let shuffled = arr.sort(() => 0.5 - Math.random()).slice(0, pageSize);
      let list = shuffled.map((hash) => {
        const rank = Math.floor(Math.random() * 10000) + 1;
        return {
          id: hash,
          name: `#${rank}`,
          previewUrl: `https://mc-heads.net/player/${hash}/150.png`,
          downloadUrl: `https://namemc.com/texture/${hash}.png`
        };
      });
      return res.json(list);
    } catch (err) {
      console.error('Failed to fetch random skins:', err);
      return res.status(500).json({ error: err.message });
    }
  }
  const globalStartIndex = (page - 1) * pageSize;
  const targetWebPage = Math.floor(globalStartIndex / skinsPerWebPage) + 1;
  const webStartIndex = globalStartIndex % skinsPerWebPage;
  function getUrlForPageIndex(idx) {
    let url = 'https://namemc.com/minecraft-skins/';
    if (category === 'popular') {
      if (time === 'day') {
        url += `trending/daily?page=${idx}`;
      } else if (time === 'week') {
        url += `trending/weekly?page=${idx}`;
      } else if (time === 'month') {
        url += `trending/monthly?page=${idx}`;
      } else {
        url = `https://namemc.com/minecraft-skins/popular?page=${idx}`;
      }
    } else if (category === 'new') {
      url += `new?page=${idx}`;
    }
    return url;
  }
  function parseSkinsFromHtml(html, startRankIndex) {
    const regex = /\/skin\/([a-f0-9]{16})/g;
    let match;
    const hashes = new Set();
    while ((match = regex.exec(html)) !== null) {
      hashes.add(match[1]);
    }
    const arr = Array.from(hashes);
    return arr.map((hash, index) => {
      const rank = startRankIndex + index + 1;
      return {
        id: hash,
        name: `#${rank}`,
        previewUrl: `https://mc-heads.net/player/${hash}/150.png`,
        downloadUrl: `https://namemc.com/texture/${hash}.png`
      };
    });
  }
  try {
    let list = [];
    let currentPageIndex = targetWebPage;
    while (list.length < webStartIndex + pageSize) {
      const pageUrl = getUrlForPageIndex(currentPageIndex);
      const html = await scrapeUrlViaElectron(pageUrl);
      const startRankIndex = (currentPageIndex - 1) * skinsPerWebPage;
      const pageSkins = parseSkinsFromHtml(html, startRankIndex);
      list = list.concat(pageSkins);
      if (pageSkins.length === 0) break;
      currentPageIndex++;
    }
    list = list.slice(webStartIndex, webStartIndex + pageSize);
    res.json(list);
  } catch (err) {
    console.error('Failed to fetch skins:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/namemc/texture/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const response = await fetch(`https://namemc.com/texture/${hash}.png`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) return res.status(404).send('Texture not found');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (err) {
    console.error('Failed to proxy NameMC texture:', err);
    res.status(500).send(err.message);
  }
});
app.get('/api/namemc/search', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required.' });
  }
  try {
    const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
    if (mojangRes.status === 204 || mojangRes.status === 404) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    if (!mojangRes.ok) {
      throw new Error(`Mojang API error: ${mojangRes.statusText}`);
    }
    const data = await mojangRes.json();
    res.json({
      username: data.name,
      uuid: data.id,
      previewUrl: `https://mc-heads.net/body/${data.name}/150.png`,
      downloadUrl: `https://mc-heads.net/skin/${data.name}`
    });
  } catch (err) {
    console.error('Failed to search player skin:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/namemc/import', async (req, res) => {
  const { name, variant, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required.' });
  }
  const activeAcc = getActiveAccount();
  const playerUuid = activeAcc ? activeAcc.uuid : 'guest';
  try {
    const pngRes = await fetch(url);
    if (!pngRes.ok) {
      throw new Error(`Failed to download skin file: ${pngRes.statusText}`);
    }
    const fileBuffer = Buffer.from(await pngRes.arrayBuffer());
    if (!fs.existsSync(skinsDir)) {
      fs.mkdirSync(skinsDir, { recursive: true });
    }
    const filename = `skin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`;
    const filePath = path.join(skinsDir, filename);
    fs.writeFileSync(filePath, fileBuffer);
    const skins = readSkinsDB();
    const newSkin = {
      id: 'skin_' + Date.now() + '_' + Math.round(Math.random() * 1000),
      playerUuid,
      name,
      filename,
      variant: (variant === 'slim') ? 'slim' : 'classic',
      createdAt: new Date().toISOString()
    };
    skins.push(newSkin);
    writeSkinsDB(skins);
    const filtered = skins.filter(s => s.playerUuid === playerUuid);
    const mapped = filtered.map(s => ({
      ...s,
      url: `/skins/${s.filename}`
    }));
    res.json({
      success: true,
      message: 'Skin successfully imported to your project!',
      skins: mapped
    });
  } catch (err) {
    console.error('Failed to import skin:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/skins', (req, res) => {
  const activeAcc = getActiveAccount();
  const playerUuid = activeAcc ? activeAcc.uuid : 'guest';
  const skins = readSkinsDB();
  const filtered = skins.filter(s => s.playerUuid === playerUuid);
  const mapped = filtered.map(s => ({
    ...s,
    url: `/skins/${s.filename}`
  }));
  res.json(mapped);
});
app.post('/api/skins/upload', upload.single('skin'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded, or file is not a valid PNG.' });
  }
  const { name, variant } = req.body;
  if (!name) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Skin name is required.' });
  }
  const resolvedVariant = (variant === 'slim') ? 'slim' : 'classic';
  const activeAcc = getActiveAccount();
  const playerUuid = activeAcc ? activeAcc.uuid : 'guest';
  const skins = readSkinsDB();
  const newSkin = {
    id: 'skin_' + Date.now() + '_' + Math.round(Math.random() * 1000),
    name: name,
    filename: req.file.filename,
    variant: resolvedVariant,
    createdAt: new Date().toISOString(),
    playerUuid: playerUuid 
  };
  skins.push(newSkin);
  writeSkinsDB(skins);
  const filtered = skins.filter(s => s.playerUuid === playerUuid);
  const mapped = filtered.map(s => ({
    ...s,
    url: `/skins/${s.filename}`
  }));
  res.json({
    success: true,
    skins: mapped
  });
});
app.delete('/api/skins/:id', (req, res) => {
  const { id } = req.params;
  const activeAcc = getActiveAccount();
  const playerUuid = activeAcc ? activeAcc.uuid : 'guest';
  const skins = readSkinsDB();
  const index = skins.findIndex(s => s.id === id && s.playerUuid === playerUuid);
  if (index === -1) {
    return res.status(404).json({ error: 'Skin not found under this account.' });
  }
  const skin = skins[index];
  const filePath = path.join(skinsDir, skin.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete skin file: ${filePath}`, err);
    }
  }
  skins.splice(index, 1);
  writeSkinsDB(skins);
  const filtered = skins.filter(s => s.playerUuid === playerUuid);
  const mapped = filtered.map(s => ({
    ...s,
    url: `/skins/${s.filename}`
  }));
  res.json({
    success: true,
    skins: mapped
  });
});
app.post('/api/skins/apply/:id', async (req, res) => {
  const { id } = req.params;
  const activeAcc = getActiveAccount();
  if (!activeAcc) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const skins = readSkinsDB();
  const skin = skins.find(s => s.id === id && s.playerUuid === activeAcc.uuid);
  if (!skin) {
    return res.status(404).json({ error: 'Skin not found under this account.' });
  }
  try {
    const mcToken = await ensureAuthenticated();
    const filePath = path.join(skinsDir, skin.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Skin file missing from local storage.' });
    }
    console.log(`Applying skin: ${skin.name} (${skin.variant}) to Minecraft profile: ${activeAcc.name}...`);
    const formData = new FormData();
    formData.append('variant', skin.variant);
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    formData.append('file', fileBlob, skin.filename);
    const applyRes = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcToken}`
      },
      body: formData
    });
    if (!applyRes.ok) {
      const errText = await applyRes.text();
      throw new Error(`Mojang API error: ${errText}`);
    }
    if (activeAcc.profile) {
      activeAcc.profile.skins = [{
        id: skin.id,
        state: 'ACTIVE',
        url: `/skins/${skin.filename}`,
        variant: skin.variant
      }];
    }
    saveSession();
    res.json({
      success: true,
      message: 'Skin successfully applied to Minecraft Premium!',
      profile: activeAcc.profile
    });
  } catch (err) {
    console.error('Failed to apply skin:', err);
    res.status(500).json({ error: err.message });
  }
});
app.use('/skins', express.static(skinsDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => {
  console.log(`Backend server active on http://localhost:${PORT}`);
});