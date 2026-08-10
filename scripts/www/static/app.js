// ==================== 存储工具（使用 localStorage） ====================

function setStorage(key, value) {
    try {
        localStorage.setItem(key, value || '');
        // 同步到 Cookie（可选）
        try {
            var expires = new Date();
            expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000);
            document.cookie = key + '=' + encodeURIComponent(value || '') + ';expires=' + expires.toUTCString() + ';path=/';
        } catch (e) {}
    } catch (e) {
        console.warn('存储失败:', e);
    }
}

function getStorage(key) {
    try {
        var val = localStorage.getItem(key);
        if (val !== null) return val;
    } catch (e) {}
    try {
        var name = key + '=';
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i].trim();
            if (c.indexOf(name) === 0) {
                var val = c.substring(name.length);
                try { localStorage.setItem(key, val); } catch (e) {}
                return val;
            }
        }
    } catch (e) {}
    return null;
}

// ==================== 工具函数 ====================

function $(id) { return document.getElementById(id); }

var charaMap = null;
var customCharaImg = null;
var customCharaName = '';
var charaAliases = {};
var isMobile = window.innerWidth <= 768;
var drawerOpen = false;

// ==================== 路径修复（普通网页版本） ====================

function fixResourcePath(path) {
    if (!path) return path;
    if (/^(data:|blob:|http:|https:|ms-appx:)/i.test(path)) return path;

    // 普通网页环境，使用相对路径
    if (path.startsWith('/static/')) {
        return '.' + path;
    }
    if (path.startsWith('static/')) {
        return './' + path;
    }
    if (!path.startsWith('./') && !path.startsWith('../')) {
        return './' + path;
    }
    return path;
}

// ==================== setImg ====================

function setImg(el, path) {
    if (!el) return;
    if (path) {
        if (path.startsWith('data:') || path.startsWith('blob:') ||
            path.startsWith('http://') || path.startsWith('https://') ||
            path.startsWith('ms-appx:')) {
            el.src = path;
            el.style.display = 'block';
            return;
        }

        var fixedPath = fixResourcePath(path);
        el.src = fixedPath;
        el.style.display = 'block';

        var retryCount = 0;
        el.onerror = function () {
            if (retryCount < 2) {
                retryCount++;
                var altPaths = [
                    path.replace('/static/', 'static/'),
                    path.replace('static/', ''),
                    path.replace('/', '')
                ];
                var altPath = altPaths[retryCount - 1] || path;
                el.src = fixResourcePath(altPath);
            } else {
                console.error('图片加载失败:', fixedPath);
                el.style.display = 'none';
                var parent = el.parentNode;
                if (parent && !parent.querySelector('.img-placeholder')) {
                    var ph = document.createElement('span');
                    ph.textContent = '🖼️';
                    ph.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;color:#666;background:rgba(0,0,0,0.3);z-index:0;';
                    ph.className = 'img-placeholder';
                    parent.appendChild(ph);
                }
            }
        };
        el.onload = function () {
            var parent = el.parentNode;
            if (parent) {
                var ph = parent.querySelector('.img-placeholder');
                if (ph) ph.remove();
            }
        };
    } else {
        el.src = '';
        el.style.display = 'none';
        var parent = el.parentNode;
        if (parent) {
            var ph = parent.querySelector('.img-placeholder');
            if (ph) ph.remove();
        }
    }
}

// ==================== 角色数据加载 ====================

function loadCharaOptions() {
    return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', fixResourcePath('/static/chara/meta.json'), true);
        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) {
                try {
                    var map = JSON.parse(xhr.responseText);
                    charaMap = map;
                    var versionSel = $('chara-version');
                    var seriesOrder = ['Splash', 'Splash Plus', 'Deluxe', 'Deluxe Plus', 'Universe', 'Universe Plus', 'Festival', 'Festival Plus', 'Buddies', 'Buddies Plus', 'Prism', 'Prism Plus'];
                    seriesOrder.forEach(function (series) {
                        var has = Object.keys(map).some(function (k) { return k.indexOf(series + '/') === 0; });
                        if (!has) return;
                        var opt = document.createElement('option');
                        opt.value = series;
                        opt.textContent = series;
                        versionSel.appendChild(opt);
                    });
                } catch (e) {
                    console.error('解析角色列表失败', e);
                }
            } else {
                console.error('加载角色列表失败: HTTP ' + xhr.status);
            }
            resolve();
        };
        xhr.onerror = function () {
            console.error('加载角色列表失败: 网络错误');
            resolve();
        };
        xhr.send();
    });
}

function populatePartners(series) {
    var select = $('friend-select');
    select.innerHTML = '';
    if (!series || !charaMap) {
        var ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = true;
        ph.textContent = '请先选择版本';
        select.appendChild(ph);
        return;
    }
    Object.keys(charaMap)
        .filter(function (k) { return k.indexOf(series + '/') === 0; })
        .sort()
        .forEach(function (k) {
            var opt = document.createElement('option');
            opt.value = k;
            opt.textContent = charaMap[k];
            select.appendChild(opt);
        });
    filterPartners();
}

function loadAliases() {
    try {
        var raw = localStorage.getItem('chara_aliases');
        charaAliases = raw ? JSON.parse(raw) : {};
    } catch (e) {
        charaAliases = {};
    }
}

function filterPartners() {
    var q = $('chara-search').value.trim().toLowerCase();
    var sel = $('friend-select');
    if (!sel) return;
    Array.prototype.forEach.call(sel.options, function (opt) {
        if (!opt.value) return;
        var name = opt.text.toLowerCase();
        var alias = (charaAliases[opt.value] || '').toLowerCase();
        var match = !q || name.indexOf(q) >= 0 || alias.indexOf(q) >= 0;
        opt.style.display = match ? '' : 'none';
    });
}

// ==================== 设置加载与保存 ====================

async function loadSettings() {
    var dfSwitch = await getStorage('df_username_switch');
    if (dfSwitch === '1') $('df_username_switch').checked = true;

    var name = await getStorage('name');
    if (name) $('name').value = name;

    var rating = await getStorage('rating');
    if (rating) $('score-input').value = rating;

    var dfUsername = await getStorage('df_username');
    if (dfUsername) $('df_username').value = dfUsername;

    var savedFriend = await getStorage('friend');
    if (savedFriend) {
        var savedSeries = savedFriend.split('/')[0];
        var versionSel = $('chara-version');
        var versionMatch = Array.prototype.some.call(versionSel.options, function (o) {
            return o.value === savedSeries;
        });
        if (savedSeries && versionMatch) {
            versionSel.value = savedSeries;
            populatePartners(savedSeries);
        }
        $('friend-select').value = savedFriend;
    }

    var friendCode = await getStorage('friend_code');
    if (friendCode) $('friend_code_input').value = friendCode;

    var cardNumber = await getStorage('card_number');
    if (cardNumber) $('card_number_input').value = cardNumber;

    var cv = await getStorage('card_version');
    if (cv) {
        var parts = cv.split(/[.-]/);
        if (parts.length === 3) {
            $('card_version_part1').value = parts[1] || '';
            $('card_version_part2').value = parts[2] || '';
        }
    }

    var savedType = await getStorage('dxpass_type');
    if (savedType === 'GOLD') savedType = 'GOLD_OLD';
    if (savedType) $('dxpass_type').value = savedType;

    var dxpassBg = await getStorage('dxpass_bg');
    if (dxpassBg) $('dxpass_bg').value = dxpassBg;

    var ts = parseInt(await getStorage('timestamp'), 10);
    if (ts && !isNaN(ts)) {
        var d = new Date(ts * 1000);
        $('year-input').value = d.getFullYear();
        $('month-input').value = String(d.getMonth() + 1).padStart(2, '0');
        $('day-input').value = String(d.getDate()).padStart(2, '0');
    }

    var maid = await getStorage('MAID');
    if (maid) $('maid-input').value = maid.replace(/^SGWCMAID/, '');

    var customImg = await getStorage('custom_chara_img');
    if (customImg) customCharaImg = customImg;

    var customName = await getStorage('custom_chara_name');
    if (customName) customCharaName = customName;

    loadCustomCharaUI();
    toggleDf();
}

async function saveAll() {
    await setStorage('name', $('name').value);
    await setStorage('rating', $('score-input').value);
    await setStorage('df_username', $('df_username').value);
    await setStorage('friend_code', $('friend_code_input').value);
    await setStorage('card_number', $('card_number_input').value);
    await setStorage('card_version', '1.' + $('card_version_part1').value + '-' + $('card_version_part2').value);
    await setStorage('dxpass_type', $('dxpass_type').value);
    await setStorage('dxpass_bg', $('dxpass_bg').value);

    var sel = $('friend-select');
    await setStorage('friend', sel.value);
    if (customCharaImg) {
        customCharaName = $('custom-name-input').value.trim();
        await setStorage('custom_chara_name', customCharaName);
        await setStorage('friend_name', customCharaName);
    } else {
        var opt = sel.value && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        await setStorage('friend_name', opt ? opt.text : '');
    }

    var y = parseInt($('year-input').value, 10);
    var m = parseInt($('month-input').value, 10);
    var d = parseInt($('day-input').value, 10);
    if (y && m && d) {
        var date = new Date(y, m - 1, d);
        if (date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d) {
            await setStorage('timestamp', Math.floor(date.getTime() / 1000));
        }
    }
    var maid = $('maid-input').value.trim();
    if (maid) await setStorage('MAID', maid);

    if (customCharaImg) {
        await setStorage('custom_chara_img', customCharaImg);
    }
}

// ==================== 水鱼功能 ====================

function toggleDf() {
    var on = $('df_username_switch').checked;
    $('manualFields').style.display = on ? 'none' : 'block';
    $('dfFields').style.display = on ? 'block' : 'none';
    setStorage('df_username_switch', on ? '1' : '0');
    updatePreview();
    if (on) {
        var u = $('df_username').value.trim();
        if (u) getPlayerData(u);
    }
}

var dfTimer = null;

function fetchPlayerData() {
    var u = $('df_username').value.trim();
    if (u) getPlayerData(u);
}

async function getPlayerData(username) {
    $('nickname').textContent = '获取中...';
    $('rating').textContent = '获取中...';
    try {
        var res = await fetch('https://www.diving-fish.com/api/maimaidxprober/query/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ b50: true, username: username })
        });
        if (res.ok) {
            var result = await res.json();
            var rating = result.rating != null ? result.rating : 'N/A';
            var nickname = result.nickname || 'N/A';
            await setStorage('rating', String(rating));
            await setStorage('name', nickname);
            $('rating').textContent = rating;
            $('nickname').textContent = nickname;
            updateRatingImage(rating);
        } else {
            $('rating').textContent = 'Error';
            $('nickname').textContent = 'Error';
        }
    } catch (e) {
        console.error('获取玩家数据失败', e);
        $('rating').textContent = '发生错误';
        $('nickname').textContent = '发生错误';
    }
}

// ==================== 预览更新 ====================

function updateRatingImage(rating) {
    var img = $('ratingImage');
    var r = parseInt(rating, 10);
    if (isNaN(r)) {
        img.style.display = 'none';
        img.src = '';
        return;
    }
    var imageIndex;
    if (r < 1000) imageIndex = 1;
    else if (r < 2000) imageIndex = 2;
    else if (r < 4000) imageIndex = 3;
    else if (r < 7000) imageIndex = 4;
    else if (r < 10000) imageIndex = 5;
    else if (r < 12000) imageIndex = 6;
    else if (r < 13000) imageIndex = 7;
    else if (r < 14000) imageIndex = 8;
    else if (r < 14500) imageIndex = 9;
    else if (r < 15000) imageIndex = 10;
    else imageIndex = 11;

    var path = '/static/rating/' + imageIndex + '.webp';
    var fixedPath = fixResourcePath(path);
    img.src = fixedPath;
    img.style.display = 'block';
}

function headerFile(type) {
    if (type === 'GOLD_OLD' || type === 'GOLD_NEW' || type === 'GOLD') return 'GOLD';
    return type;
}

function updateFunctionIcons(type) {
    var container = document.getElementById('function_icons');
    if (!container) return;
    container.innerHTML = '';
    var iconMap = {
        BRONZE: ['UI_CMA_Icon_PowerUp_02'],
        SILVER: ['UI_CMA_Icon_PowerUp_01'],
        GOLD_OLD: ['UI_CMA_Icon_PowerUp_00', 'UI_CMA_Icon_Master_00', 'UI_CMA_Icon_Rating_00'],
        GOLD_NEW: ['UI_CMA_Icon_LevelUp_00', 'UI_CMA_Icon_Master_00', 'UI_CMA_Icon_Rating_00'],
        FREEDOM: ['UI_CMA_Icon_Freedom_00', 'UI_CMA_Icon_Master_00', 'UI_CMA_Icon_Rating_00'],
    };
    var icons = iconMap[type] || [];
    icons.forEach(function (name) {
        var img = document.createElement('img');
        var path = '/static/function/' + name + '.webp';
        var fixedPath = fixResourcePath(path);
        img.src = fixedPath;
        img.alt = name;
        container.appendChild(img);
    });
}

function updatePreview() {
    if (customCharaImg) {
        customCharaName = $('custom-name-input').value.trim();
    }

    var bgValue = $('dxpass_bg').value;
    var bgPath = bgValue ? '/static/background/' + bgValue + '.webp' : '';
    setImg(document.querySelector('img[alt="bg"]'), bgPath);

    var typeVal = $('dxpass_type').value;
    var headerPath = typeVal ? '/static/header/' + headerFile(typeVal) + '.webp' : '';
    setImg(document.querySelector('img[alt="header"]'), headerPath);

    var friendVal = $('friend-select').value;
    var charaPath = customCharaImg ? customCharaImg :
        (friendVal ? '/static/chara/' + friendVal + '.webp' : '');
    setImg($('chara-img'), charaPath);

    updateFunctionIcons(typeVal);

    var name = $('name').value.trim();
    var score = $('score-input').value.trim();
    if (!$('df_username_switch').checked) {
        $('nickname').textContent = name || '未设置昵称';
        $('rating').textContent = score || '0';
        updateRatingImage(score);
    }

    var sel = $('friend-select');
    var friendName = customCharaImg ? customCharaName : (sel.value ? sel.options[sel.selectedIndex].text : '');
    $('friend_name').textContent = friendName;
    $('friend_code').textContent = $('friend_code_input').value;
    $('card_number').textContent = $('card_number_input').value.replace(/(.{4})/g, '$1 ').trim();

    var p1 = $('card_version_part1').value;
    var p2 = $('card_version_part2').value;
    $('card_version').textContent = (p1 || p2) ? '1.' + p1 + '-' + p2 : '';

    var y = $('year-input').value;
    var m = $('month-input').value;
    var d = $('day-input').value;
    $('formatted-time').textContent = (y && m && d) ? y + '/' + String(m).padStart(2, '0') + '/' + String(d).padStart(2, '0') : '';

    var qrEl = $('qrcode');
    qrEl.innerHTML = '';
    var maid = $('maid-input').value.trim();
    if (maid) {
        new QRCode(qrEl, {
            text: maid,
            width: 98,
            height: 98,
            correctLevel: QRCode.CorrectLevel.L,
            version: 3,
        });
    }

    var charaImg = document.getElementById('chara-img');
    if (charaImg && charaImg.src && !charaImg.src.startsWith('data:') && !charaImg.src.startsWith('blob:')) {
        var sep = charaImg.src.indexOf('?') > -1 ? '&' : '?';
        charaImg.src = charaImg.src + sep + 't=' + Date.now();
    }
}

// ==================== 缩放适配 ====================

function fitPreview() {
    var area = document.getElementById('preview-area');
    var card = document.getElementById('DX_Pass');
    var wrapper = document.getElementById('card-wrapper');
    if (!area || !card || !wrapper) return;

    requestAnimationFrame(function () {
        var areaW = area.clientWidth;
        var areaH = area.clientHeight;
        if (areaW < 10 || areaH < 10) {
            setTimeout(fitPreview, 200);
            return;
        }

        var CARD_W = 770;
        var CARD_H = 1054;
        var PADDING = isMobile ? 6 : 24;

        var scaleX = (areaW - PADDING * 2) / CARD_W;
        var scaleY = (areaH - PADDING * 2) / CARD_H;
        var maxScale = isMobile ? 1.08 : 1;
        var scale = Math.max(0.08, Math.min(scaleX, scaleY, maxScale));

        var scaledW = CARD_W * scale;
        var scaledH = CARD_H * scale;

        wrapper.style.width = scaledW + 'px';
        wrapper.style.height = scaledH + 'px';
        wrapper.style.position = 'relative';
        wrapper.style.margin = '0 auto';
        wrapper.style.flexShrink = '0';

        card.style.width = CARD_W + 'px';
        card.style.height = CARD_H + 'px';
        card.style.transformOrigin = 'center center';
        card.style.transform = 'scale(' + scale + ')';
        card.style.position = 'relative';
        card.style.margin = '0 auto';
        card.style.flexShrink = '0';

        if (isMobile) {
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.justifyContent = 'center';
        }
    });
}

// ==================== 自定义伙伴图片 ====================

function uploadCustomChara() {
    document.getElementById('chara-file-input').click();
}

function handleCharaFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        input.value = '';
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        alert('图片文件过大（超过20MB），请选择更小的图片');
        input.value = '';
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
            cropImg = img;
            openCropModal();
        };
        img.onerror = function () {
            alert('图片加载失败');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function loadCustomCharaUI() {
    var clearBtn = document.getElementById('clear-custom-btn');
    var uploadBtn = document.querySelector('.btn-upload');
    var nameField = document.getElementById('custom-name-field');
    var nameInput = document.getElementById('custom-name-input');
    if (clearBtn) clearBtn.style.display = customCharaImg ? 'block' : 'none';
    if (uploadBtn) uploadBtn.style.display = customCharaImg ? 'none' : 'inline-block';
    if (nameField) nameField.style.display = customCharaImg ? 'block' : 'none';
    if (nameInput) nameInput.value = customCharaName;
}

function clearCustomChara() {
    localStorage.removeItem('custom_chara_img');
    localStorage.removeItem('custom_chara_name');
    customCharaImg = null;
    customCharaName = '';
    var clearBtn = document.getElementById('clear-custom-btn');
    var uploadBtn = document.querySelector('.btn-upload');
    var nameField = document.getElementById('custom-name-field');
    var nameInput = document.getElementById('custom-name-input');
    if (clearBtn) clearBtn.style.display = 'none';
    if (uploadBtn) uploadBtn.style.display = 'inline-block';
    if (nameField) nameField.style.display = 'none';
    if (nameInput) nameInput.value = '';
    updatePreview();
    saveAll();
}

// ==================== 裁剪相关 ====================

var cropImg = null;
var cropCanvas = null;
var cropCtx = null;
var cropDispW = 0;
var cropDispH = 0;
var cropScale = 1;
var cropRect = { x: 0, y: 0, w: 0, h: 0 };
var cropDrag = { active: false, mode: '', sx: 0, sy: 0, ox: 0, oy: 0, ow: 0, oh: 0 };
var CROP_HANDLE = 10;
var CROP_MIN = 20;

function openCropModal() {
    if (!cropImg) return;
    openModal('cropModal');
    cropCanvas = $('cropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    var maxW = 552;
    cropScale = Math.min(1, maxW / cropImg.naturalWidth);
    cropDispW = Math.round(cropImg.naturalWidth * cropScale);
    cropDispH = Math.round(cropImg.naturalHeight * cropScale);
    var dpr = window.devicePixelRatio || 1;
    cropCanvas.width = cropDispW * dpr;
    cropCanvas.height = cropDispH * dpr;
    cropCanvas.style.width = cropDispW + 'px';
    cropCanvas.style.height = cropDispH + 'px';
    cropCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var aspect = 770 / 1054;
    var w, h;
    if (cropDispW / cropDispH > aspect) {
        h = cropDispH;
        w = h * aspect;
    } else {
        w = cropDispW;
        h = w / aspect;
    }
    cropRect = {
        x: (cropDispW - w) / 2,
        y: (cropDispH - h) / 2,
        w: w,
        h: h
    };
    drawCropCanvas();
    updateCropPreview();
}

function drawCropCanvas() {
    var ctx = cropCtx;
    ctx.clearRect(0, 0, cropDispW, cropDispH);
    ctx.drawImage(cropImg, 0, 0, cropDispW, cropDispH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cropDispW, cropDispH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.clip();
    ctx.drawImage(cropImg, 0, 0, cropDispW, cropDispH);
    ctx.restore();
    ctx.strokeStyle = '#39c5bb';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (var i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cropRect.x + cropRect.w * i / 3, cropRect.y);
        ctx.lineTo(cropRect.x + cropRect.w * i / 3, cropRect.y + cropRect.h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cropRect.x, cropRect.y + cropRect.h * i / 3);
        ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + cropRect.h * i / 3);
        ctx.stroke();
    }
    var hs = CROP_HANDLE;
    var pts = [
        [cropRect.x, cropRect.y],
        [cropRect.x + cropRect.w, cropRect.y],
        [cropRect.x, cropRect.y + cropRect.h],
        [cropRect.x + cropRect.w, cropRect.y + cropRect.h],
        [cropRect.x + cropRect.w / 2, cropRect.y],
        [cropRect.x + cropRect.w / 2, cropRect.y + cropRect.h],
        [cropRect.x, cropRect.y + cropRect.h / 2],
        [cropRect.x + cropRect.w, cropRect.y + cropRect.h / 2]
    ];
    ctx.fillStyle = '#39c5bb';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    pts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], hs / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

function cropMousePos(e) {
    var rect = cropCanvas.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
}

function cropHandleMode(x, y) {
    var cx = cropRect.x,
        cy = cropRect.y,
        cw = cropRect.w,
        ch = cropRect.h,
        hs = CROP_HANDLE;
    if (Math.abs(x - cx) < hs && Math.abs(y - cy) < hs) return 'nw';
    if (Math.abs(x - (cx + cw)) < hs && Math.abs(y - cy) < hs) return 'ne';
    if (Math.abs(x - cx) < hs && Math.abs(y - (cy + ch)) < hs) return 'sw';
    if (Math.abs(x - (cx + cw)) < hs && Math.abs(y - (cy + ch)) < hs) return 'se';
    if (Math.abs(y - cy) < hs && x > cx + hs && x < cx + cw - hs) return 'n';
    if (Math.abs(y - (cy + ch)) < hs && x > cx + hs && x < cx + cw - hs) return 's';
    if (Math.abs(x - cx) < hs && y > cy + hs && y < cy + ch - hs) return 'w';
    if (Math.abs(x - (cx + cw)) < hs && y > cy + hs && y < cy + ch - hs) return 'e';
    if (x > cx && x < cx + cw && y > cy && y < cy + ch) return 'move';
    return 'new';
}

function cropCursor(m) {
    var map = {
        'nw': 'nwse-resize', 'se': 'nwse-resize', 'ne': 'nesw-resize', 'sw': 'nesw-resize',
        'n': 'ns-resize', 's': 'ns-resize', 'w': 'ew-resize', 'e': 'ew-resize',
        'move': 'move', 'new': 'crosshair'
    };
    return map[m] || 'default';
}

function onCropDown(e) {
    e.preventDefault();
    var p = cropMousePos(e);
    var mode = cropHandleMode(p.x, p.y);
    cropDrag.active = true;
    cropDrag.mode = mode;
    cropDrag.sx = p.x;
    cropDrag.sy = p.y;
    cropDrag.ox = cropRect.x;
    cropDrag.oy = cropRect.y;
    cropDrag.ow = cropRect.w;
    cropDrag.oh = cropRect.h;
    if (mode === 'new') {
        cropRect.x = p.x;
        cropRect.y = p.y;
        cropRect.w = 0;
        cropRect.h = 0;
    }
    cropCanvas.style.cursor = cropCursor(mode);
}

function onCropMove(e) {
    if (!cropImg) return;
    var p = cropMousePos(e);
    if (!cropDrag.active) {
        if (p.x >= 0 && p.x <= cropDispW && p.y >= 0 && p.y <= cropDispH) {
            cropCanvas.style.cursor = cropCursor(cropHandleMode(p.x, p.y));
        }
        return;
    }
    e.preventDefault();
    var dx = p.x - cropDrag.sx;
    var dy = p.y - cropDrag.sy;
    var aspect = 770 / 1054;

    if (cropDrag.mode === 'move') {
        var newX = Math.max(0, Math.min(cropDispW - cropRect.w, cropDrag.ox + dx));
        var newY = Math.max(0, Math.min(cropDispH - cropRect.h, cropDrag.oy + dy));
        cropRect.x = newX;
        cropRect.y = newY;
    } else {
        var nx = cropDrag.ox,
            ny = cropDrag.oy;
        var nw = cropDrag.ow,
            nh = cropDrag.oh;
        if (cropDrag.mode.indexOf('e') >= 0) {
            nw = Math.max(20, cropDrag.ow + dx);
            nh = nw / aspect;
        } else if (cropDrag.mode.indexOf('w') >= 0) {
            nw = Math.max(20, cropDrag.ow - dx);
            nh = nw / aspect;
            nx = cropDrag.ox + (cropDrag.ow - nw);
        } else if (cropDrag.mode.indexOf('s') >= 0) {
            nh = Math.max(20, cropDrag.oh + dy);
            nw = nh * aspect;
        } else if (cropDrag.mode.indexOf('n') >= 0) {
            nh = Math.max(20, cropDrag.oh - dy);
            nw = nh * aspect;
            ny = cropDrag.oy + (cropDrag.oh - nh);
        } else {
            var scaleX = (dx !== 0) ? (cropDrag.ow + dx) / cropDrag.ow : 1;
            var scaleY = (dy !== 0) ? (cropDrag.oh + dy) / cropDrag.oh : 1;
            var scale = Math.max(scaleX, scaleY);
            nw = cropDrag.ow * scale;
            nh = cropDrag.oh * scale;
            if (cropDrag.mode === 'se') { /* no move origin */ } else if (cropDrag.mode === 'sw') { nx = cropDrag.ox + (cropDrag.ow - nw); } else if (cropDrag.mode === 'ne') { ny = cropDrag.oy + (cropDrag.oh - nh); } else if (cropDrag.mode === 'nw') {
                nx = cropDrag.ox + (cropDrag.ow - nw);
                ny = cropDrag.oy + (cropDrag.oh - nh);
            }
        }
        nw = Math.min(nw, cropDispW);
        nh = Math.min(nh, cropDispH);
        if (nx + nw > cropDispW) nx = cropDispW - nw;
        if (ny + nh > cropDispH) ny = cropDispH - nh;
        if (nx < 0) nx = 0;
        if (ny < 0) ny = 0;
        cropRect.x = nx;
        cropRect.y = ny;
        cropRect.w = nw;
        cropRect.h = nh;
    }
    drawCropCanvas();
    updateCropPreview();
}

function onCropUp() {
    if (!cropDrag.active) return;
    cropDrag.active = false;
    if (cropDrag.mode === 'new' && (cropRect.w < CROP_MIN || cropRect.h < CROP_MIN)) {
        cropRect = { x: 0, y: 0, w: cropDispW, h: cropDispH };
        drawCropCanvas();
        updateCropPreview();
    }
}

function updateCropPreview() {
    var preview = $('cropPreview');
    if (cropRect.w < 1 || cropRect.h < 1) { preview.src = ''; return; }
    var pc = document.createElement('canvas');
    var pw = 120;
    var ph = Math.round(pw * cropRect.h / cropRect.w);
    pc.width = pw;
    pc.height = ph;
    var pctx = pc.getContext('2d');
    var sx = cropRect.x / cropScale,
        sy = cropRect.y / cropScale;
    var sw = cropRect.w / cropScale,
        sh = cropRect.h / cropScale;
    pctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, pw, ph);
    preview.src = pc.toDataURL('image/png');
}

function resetCrop() {
    var aspect = 770 / 1054;
    var w, h;
    if (cropDispW / cropDispH > aspect) {
        h = cropDispH;
        w = h * aspect;
    } else {
        w = cropDispW;
        h = w / aspect;
    }
    cropRect = {
        x: (cropDispW - w) / 2,
        y: (cropDispH - h) / 2,
        w: w,
        h: h
    };
    drawCropCanvas();
    updateCropPreview();
}

function confirmCrop() {
    if (cropRect.w < CROP_MIN || cropRect.h < CROP_MIN) {
        alert('裁剪区域太小，请重新选择');
        return;
    }
    var sx = cropRect.x / cropScale,
        sy = cropRect.y / cropScale;
    var sw = cropRect.w / cropScale,
        sh = cropRect.h / cropScale;
    var maxOutW = 770;
    var outScale = Math.min(1, maxOutW / sw);
    var outW = Math.round(sw * outScale);
    var outH = Math.round(sh * outScale);
    var oc = document.createElement('canvas');
    oc.width = outW;
    oc.height = outH;
    var octx = oc.getContext('2d');
    octx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, outW, outH);
    var dataUrl = oc.toDataURL('image/png');
    if (dataUrl.length > 4 * 1024 * 1024) {
        var ratio = Math.sqrt(4 * 1024 * 1024 / dataUrl.length);
        outW = Math.max(1, Math.round(outW * ratio));
        outH = Math.max(1, Math.round(outH * ratio));
        oc.width = outW;
        oc.height = outH;
        octx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, outW, outH);
        dataUrl = oc.toDataURL('image/jpeg', 0.92);
    }
    try {
        localStorage.setItem('custom_chara_img', dataUrl);
    } catch (ex) {
        alert('图片太大，无法保存到本地存储，请裁剪更小的区域。');
        return;
    }
    customCharaImg = dataUrl;
    loadCustomCharaUI();
    closeCropModal();
    updatePreview();
    saveAll();
}

function closeCropModal() {
    closeModal('cropModal');
    cropImg = null;
}

// ==================== 模态框工具 ====================

function openModal(id) {
    var el = $(id);
    if (el) el.style.display = 'flex';
}

function closeModal(id) {
    var el = $(id);
    if (el) el.style.display = 'none';
}

function openCookieModal() {
    showCookies();
    openModal('cookieModal');
}

function showCookies() {
    var container = $('cookieContent');
    var items = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        items.push(key + ': ' + value);
    }
    container.innerHTML = items.length ? items.map(function (v) { return '<div class="cookie">' + v + '</div>'; }).join('') : '<div class="cookie">无本地存储数据</div>';
}

// ==================== 事件绑定 ====================

function wireEvents() {
    var fields = ['name', 'score-input', 'df_username', 'friend_code_input', 'card_number_input',
        'card_version_part1', 'card_version_part2', 'dxpass_type', 'dxpass_bg',
        'year-input', 'month-input', 'day-input', 'maid-input', 'custom-name-input'
    ];
    fields.forEach(function (id) {
        var el = $(id);
        if (el) {
            el.addEventListener('input', function () {
                saveAll();
                updatePreview();
            });
            el.addEventListener('change', function () {
                saveAll();
                updatePreview();
            });
        }
    });

    var cookieLink = document.getElementById('cookieLink');
    if (cookieLink) {
        cookieLink.addEventListener('click', function (e) {
            e.preventDefault();
            openCookieModal();
        });
    }

    var aliasesLink = document.getElementById('aliasesLink');
    if (aliasesLink) {
        aliasesLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = 'aliases.html';
        });
    }

    var dfSwitch = document.getElementById('df_username_switch');
    if (dfSwitch) {
        dfSwitch.addEventListener('change', toggleDf);
    }

    var charaSearch = document.getElementById('chara-search');
    if (charaSearch) {
        charaSearch.addEventListener('input', filterPartners);
    }

    var uploadBtn = document.getElementById('uploadCharaBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadCustomChara);
    }

    var fileInput = document.getElementById('chara-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            handleCharaFile(this);
        });
    }

    var clearBtn = document.getElementById('clear-custom-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCustomChara);
    }

    var closeBtns = document.querySelectorAll('.modal-close[data-modal]');
    closeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var modalId = this.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    var closeCropBtn = document.getElementById('closeCropModalBtn');
    if (closeCropBtn) {
        closeCropBtn.addEventListener('click', closeCropModal);
    }

    var resetBtn = document.getElementById('resetCropBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetCrop);
    }
    var confirmBtn = document.getElementById('confirmCropBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmCrop);
    }

    var versionSelect = $('chara-version');
    if (versionSelect) {
        versionSelect.addEventListener('change', function () {
            $('chara-search').value = '';
            populatePartners($('chara-version').value);
            saveAll();
            updatePreview();
        });
    }

    var friendSelect = $('friend-select');
    if (friendSelect) {
        friendSelect.addEventListener('change', function () {
            saveAll();
            updatePreview();
        });
    }

    var dfUsername = $('df_username');
    if (dfUsername) {
        dfUsername.addEventListener('input', function () {
            saveAll();
            updatePreview();
            if ($('df_username_switch').checked) {
                clearTimeout(dfTimer);
                dfTimer = setTimeout(fetchPlayerData, 600);
            }
        });
    }

    // ========== 移动端手势控制 ==========
    function initMobileGestures() {
        if (!isMobile) return;
        var sidebar = document.getElementById('sidebar');
        var trigger = document.getElementById('drawer-trigger');
        if (!sidebar || !trigger) return;

        // 点击小白条切换
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var newState = !drawerOpen;
            drawerOpen = newState;
            sidebar.classList.toggle('open', newState);
        });

        // 上滑展开
        var previewArea = document.getElementById('preview-area');
        var startY = 0;

        previewArea.addEventListener('touchstart', function (e) {
            startY = e.touches[0].clientY;
        }, { passive: true });

        previewArea.addEventListener('touchmove', function (e) {
            if (!startY) return;
            var deltaY = startY - e.touches[0].clientY;
            if (deltaY > 50 && startY > window.innerHeight * 0.5) {
                if (!drawerOpen) {
                    drawerOpen = true;
                    sidebar.classList.add('open');
                }
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        // 下滑关闭
        sidebar.addEventListener('touchstart', function (e) {
            startY = e.touches[0].clientY;
        }, { passive: true });

        sidebar.addEventListener('touchmove', function (e) {
            if (!startY) return;
            var deltaY = e.touches[0].clientY - startY;
            if (deltaY > 50 && drawerOpen) {
                drawerOpen = false;
                sidebar.classList.remove('open');
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        // 点击预览区关闭
        previewArea.addEventListener('click', function (e) {
            if (drawerOpen && e.target === previewArea) {
                drawerOpen = false;
                sidebar.classList.remove('open');
            }
        });
    }

    // ========== 窗口缩放 ==========
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var newIsMobile = window.innerWidth <= 768;
            if (newIsMobile !== isMobile) {
                isMobile = newIsMobile;
                if (!isMobile) {
                    var sidebar = document.getElementById('sidebar');
                    if (sidebar) sidebar.classList.remove('open');
                    drawerOpen = false;
                }
            }
            fitPreview();
        }, 150);
    });

    // 裁剪画布
    var cc = $('cropCanvas');
    if (cc) {
        cc.addEventListener('mousedown', onCropDown);
        window.addEventListener('mousemove', onCropMove);
        window.addEventListener('mouseup', onCropUp);
        cc.addEventListener('touchstart', onCropDown, { passive: false });
        window.addEventListener('touchmove', onCropMove, { passive: false });
        window.addEventListener('touchend', onCropUp);
    }

    // 初始化移动端手势
    if (isMobile) {
        setTimeout(initMobileGestures, 100);
    }
}

// ==================== 启动 ====================

window.addEventListener('DOMContentLoaded', function () {
    isMobile = window.innerWidth <= 768;

    loadAliases();
    loadCharaOptions().then(function () {
        loadSettings().then(function () {
            loadCustomCharaUI();
            updatePreview();
            fitPreview();
            setTimeout(fitPreview, 100);
            setTimeout(fitPreview, 300);
            setTimeout(fitPreview, 600);

            window.addEventListener('orientationchange', function () {
                setTimeout(fitPreview, 100);
                setTimeout(fitPreview, 400);
            });
        });
    });
    wireEvents();
});

// ===== 禁用右键菜单（可选） =====
document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName !== 'INPUT' && 
        e.target.tagName !== 'TEXTAREA' && 
        e.target.tagName !== 'SELECT') {
        e.preventDefault();
    }
});