// ===== DOM =====
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: true });

const startEl = document.getElementById('start');
const startBtn = document.getElementById('startBtn');

const audio = document.getElementById('audio');
const vol = document.getElementById('vol');
const muteBtn = document.getElementById('muteBtn');
const hintEl = document.getElementById('hint');

function hint(msg) { if (hintEl) hintEl.textContent = msg || ''; }

window.addEventListener('error', (e) => {
  hint('JS Error: ' + (e?.message || 'unknown'));
});

// ===== Audio =====
audio.loop = true;
audio.volume = Number(vol.value || 0.7);

function updateMuteIcon() {
  muteBtn.textContent = (audio.muted || audio.volume === 0) ? '🔇' : '🔊';
}
updateMuteIcon();

vol.addEventListener('input', () => {
  audio.volume = Number(vol.value);
  audio.muted = (audio.volume === 0);
  updateMuteIcon();
});

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateMuteIcon();
});

audio.addEventListener('error', () => hint('Không thấy music.mp3'));

function tryPlayMusic() {
  audio.load();
  audio.play()
    .then(() => hint('Music ON'))
    .catch(() => hint('Nhạc bị chặn/thiếu file'));
}

// ===== HiDPI resize =====
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, Math.floor(window.innerWidth));
  H = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  buildSceneGeometry();
}
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resize, 200);
});

// ===== Timeline (loop) =====
const T_DRAW = 4.4;
const T_HOLD1 = 2.0;
const T_TRANS = 1.0;
const T_HOLD2 = 2.4;
const T_TRANS2 = 1.0;
const T_TOTAL = T_DRAW + T_HOLD1 + T_TRANS + T_HOLD2 + T_TRANS2;

let started = false;
let t0 = 0;
let lastNow = 0;

// ===== Auto Firework Logic =====
let nextFireworkTime = 0;
const FW_MIN_INTERVAL = 0.3;
const FW_MAX_INTERVAL = 1.5;

// ===== Constants =====
const TOP_Y = -0.65;
const BOT_Y = 0.48;
const STAR_R_OUT = 0.085;
const STAR_R_IN = 0.037;
const LAYER_COUNT = 7;

// ===== Background stars =====
const bgStars = new Float32Array(240 * 4);
for (let i = 0; i < 240; i++) {
  bgStars[i * 4 + 0] = Math.random();
  bgStars[i * 4 + 1] = Math.random();
  bgStars[i * 4 + 2] = 0.6 + Math.random() * 1.6;
  bgStars[i * 4 + 3] = 0.20 + Math.random() * 0.55;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOutCubic(x) {
  x = clamp(x, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}
function fillBackground(t) {
  const g = ctx.createRadialGradient(W * 0.30, H * 0.20, 0, W * 0.30, H * 0.20, Math.max(W, H) * 0.95);
  g.addColorStop(0, 'rgba(27,37,80,1)');
  g.addColorStop(0.35, 'rgba(10,16,48,1)');
  g.addColorStop(1, 'rgba(5,8,20,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 240; i++) {
    const x = bgStars[i * 4 + 0] * W;
    const y = bgStars[i * 4 + 1] * H;
    const s = bgStars[i * 4 + 2];
    const a = bgStars[i * 4 + 3];
    const tw = 0.45 + 0.55 * Math.sin(t * 1.15 + bgStars[i * 4 + 0] * 10);
    ctx.globalAlpha = a * tw;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

// ===== Fireworks =====
const fireworks = [];
function rand(a, b) { return a + Math.random() * (b - a); }

function spawnFirework(x, y) {
  const count = rand(80, 140);
  const hue = Math.floor(Math.random() * 360);
  const parts = new Array(Math.floor(count));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(150, 400);
    parts[i] = {
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: rand(1.1, 2.5),
      life: rand(0.6, 1.2),
      age: 0,
      hue
    };
  }
  fireworks.push({ parts });
}

function updateFireworks(dt) {
  for (let k = fireworks.length - 1; k >= 0; k--) {
    const fw = fireworks[k];
    let alive = 0;
    for (const p of fw.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      alive++;
      p.vy += 400 * dt;
      p.vx *= (1 - 0.8 * dt);
      p.vy *= (1 - 0.8 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (alive === 0) fireworks.splice(k, 1);
  }
}

function drawFireworks() {
  for (const fw of fireworks) {
    for (const p of fw.parts) {
      if (p.age >= p.life) continue;
      const k = p.age / p.life;
      const a = (1 - k);
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ===== Seamless Tree Geometry =====

function getTreeWidth(t) {
  // Hàm độ rộng cơ bản (hình nón cong)
  return 0.02 + 0.38 * Math.pow(t, 0.85);
}

function buildStarPoints(cx, cy, rOuter, rInner, spikes = 5) {
  const pts = [];
  const step = Math.PI / spikes;
  let a = -Math.PI / 2;
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 === 0) ? rOuter : rInner;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    a += step;
  }
  pts.push(pts[0]);
  return pts;
}

// Global Geometry Variables
let leftProfile = [];  // Toàn bộ đường viền trái (gồm cả các vết cắt)
let rightProfile = []; // Toàn bộ đường viền phải
let bottomProfile = [];
let internalCurves = []; // Các đường cong mờ bên trong gợi ý tầng
let starX = null, starY = null, starN = 0;
let baseScale = 1;
let cx = 0, cy = 0;
let baubles = [];
const BAUBLE_COUNT = 60;

// Hàm tạo đường răng cưa
function createJaggedSegment(x1, y1, x2, y2, steps, noiseAmt) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = x1 + (x2 - x1) * t;
    let y = y1 + (y2 - y1) * t;
    if (i > 0 && i < steps) {
      x += (Math.random() - 0.5) * noiseAmt;
      y += (Math.random() - 0.5) * noiseAmt * 0.4;
    }
    pts.push({ x, y });
  }
  return pts;
}

function buildSceneGeometry() {
  const topMargin = 40;
  const bottomMargin = 220;
  const normHeight = (BOT_Y - TOP_Y) + STAR_R_OUT;
  const maxScaleByHeight = (H - topMargin - bottomMargin) / normHeight;
  const scaleByMinSide = Math.min(W, H) * 0.55;

  baseScale = Math.max(220, Math.min(scaleByMinSide, maxScaleByHeight));

  const bottomTarget = H * 0.65;
  const cyFromBottom = bottomTarget - BOT_Y * baseScale;
  const cyMinFromTop = topMargin - TOP_Y * baseScale + (STAR_R_OUT * baseScale);

  cy = Math.max(cyFromBottom, cyMinFromTop);
  cx = W * 0.5;

  // --- 1. Xây dựng đường viền liền mạch (Silhouette) ---
  leftProfile = [];
  rightProfile = [];
  internalCurves = []; // Reset internal curves

  const totalH = BOT_Y - TOP_Y;

  // Đỉnh cây
  const tipX = cx;
  const tipY = cy + TOP_Y * baseScale;
  leftProfile.push({ x: tipX, y: tipY });
  rightProfile.push({ x: tipX, y: tipY });

  // Tạo các tầng nối tiếp nhau
  for (let i = 0; i < LAYER_COUNT; i++) {
    const tStart = i / LAYER_COUNT;
    const tEnd = (i + 1) / LAYER_COUNT;

    // Tính Y chuẩn hóa
    const yTopNorm = TOP_Y + totalH * tStart;
    const yBotNorm = TOP_Y + totalH * tEnd;

    const yTop = cy + yTopNorm * baseScale;
    const yBot = cy + yBotNorm * baseScale;

    // Tính độ rộng:
    // wOut: độ rộng đáy tầng (xòe ra)
    // wIn: độ rộng đỉnh tầng tiếp theo (thụt vào) - tạo nếp gấp
    const wTop = (i === 0) ? 0 : getTreeWidth(tStart) * 0.6; // Đỉnh tầng hơi thụt vào
    const wBot = getTreeWidth(tEnd) * 1.05; // Đáy tầng xòe ra

    // Toạ độ mép ngoài của đáy tầng hiện tại
    const xBotL = cx - wBot * baseScale;
    const xBotR = cx + wBot * baseScale;

    // Toạ độ mép trong của đỉnh tầng tiếp theo (để tạo notch)
    // Nếu là tầng cuối thì không thụt vào nữa mà nối xuống đáy
    const wNextIn = getTreeWidth(tEnd) * 0.6;
    const xNextInL = cx - wNextIn * baseScale;
    const xNextInR = cx + wNextIn * baseScale;

    const noise = baseScale * 0.02 * (1 - i * 0.05);

    // Điểm bắt đầu của tầng này là điểm cuối của tầng trước (đã push rồi)
    // Vẽ cạnh bên đi xuống xòe ra
    const lastL = leftProfile[leftProfile.length - 1];
    const lastR = rightProfile[rightProfile.length - 1];

    // Thêm các điểm răng cưa cho cạnh bên
    const segL = createJaggedSegment(lastL.x, lastL.y, xBotL, yBot, 10, noise);
    // Bỏ điểm đầu vì trùng
    for (let k = 1; k < segL.length; k++) leftProfile.push(segL[k]);

    const segR = createJaggedSegment(lastR.x, lastR.y, xBotR, yBot, 10, noise);
    for (let k = 1; k < segR.length; k++) rightProfile.push(segR[k]);

    // Nếu chưa phải tầng cuối, thêm điểm "thụt vào" để tạo ngấn
    if (i < LAYER_COUNT - 1) {
      // Notch đi ngang/hơi lên vào trong
      leftProfile.push({ x: xNextInL, y: yBot - baseScale * 0.01 });
      rightProfile.push({ x: xNextInR, y: yBot - baseScale * 0.01 });

      // Thêm đường cong mờ (Internal Curve) để gợi ý đáy tầng
      // Vẽ từ trái sang phải
      const curvePts = [];
      const midY = yBot + baseScale * 0.03;
      for (let s = 0; s <= 10; s++) {
        const u = s / 10;
        const xx = xBotL + (xBotR - xBotL) * u;
        const yy = yBot + (midY - yBot) * Math.sin(u * Math.PI);
        curvePts.push({ x: xx, y: yy });
      }
      internalCurves.push(curvePts);
    }
  }

  // --- 2. Đường đáy cây ---
  bottomProfile = [];
  const finalL = leftProfile[leftProfile.length - 1];
  const finalR = rightProfile[rightProfile.length - 1];
  const yBotBase = cy + BOT_Y * baseScale;
  const yBotMid = yBotBase + baseScale * 0.05;

  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const x = finalL.x + (finalR.x - finalL.x) * t;
    const y = finalL.y + (yBotMid - finalL.y) * Math.sin(t * Math.PI); // Parabol
    // Nhiễu nhẹ đáy
    const nX = x + (Math.random() - 0.5) * baseScale * 0.01;
    const nY = y + (Math.random() - 0.5) * baseScale * 0.01;
    bottomProfile.push({ x: nX, y: nY });
  }

  // --- 3. Sao ---
  const starCx = cx;
  const starCy = cy + TOP_Y * baseScale;
  const starPts = buildStarPoints(starCx, starCy, baseScale * STAR_R_OUT, baseScale * STAR_R_IN, 5);
  starN = starPts.length;
  starX = new Float32Array(starN);
  starY = new Float32Array(starN);
  for (let i = 0; i < starN; i++) {
    starX[i] = starPts[i].x;
    starY[i] = starPts[i].y;
  }

  // --- 4. Quả châu ---
  baubles = [];
  for (let i = 0; i < BAUBLE_COUNT; i++) {
    const t = 0.08 + Math.random() * 0.85;
    const yRel = TOP_Y + (BOT_Y - TOP_Y) * t;
    const wAtT = getTreeWidth(t);
    // Phân bố ngẫu nhiên nhưng tập trung vào giữa hơn chút
    const xRel = (Math.random() * 2 - 1) * wAtT * 0.75;

    baubles.push({
      x: cx + xRel * baseScale,
      y: cy + yRel * baseScale,
      color: Math.random() > 0.6 ? `hsl(${rand(40, 60)}, 100%, 60%)` : `hsl(${rand(0, 360)}, 85%, 60%)`,
      phase: Math.random() * Math.PI * 2,
      sizeVar: rand(0.9, 1.4)
    });
  }
}

// Vẽ cây liền mạch
function drawSeamlessTree(progress, now) {
  if (progress <= 0) return;

  // --- 1. Tạo Path tổng hợp (Silhouette) ---
  // Kết nối: Left Profile -> Bottom -> Right Profile (reversed)
  // Tính toán số điểm cần vẽ dựa trên progress
  const totalPts = leftProfile.length + bottomProfile.length + rightProfile.length;
  // Giả lập vẽ từ đỉnh trái -> xuống đáy -> lên đỉnh phải

  // Vẽ FILL (Tô màu) - Luôn tô full shape nhưng fade in
  const fillAlpha = clamp((progress - 0.2) * 1.5, 0, 1);
  if (fillAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = fillAlpha;
    ctx.beginPath();
    ctx.moveTo(leftProfile[0].x, leftProfile[0].y);
    for (let p of leftProfile) ctx.lineTo(p.x, p.y);
    for (let p of bottomProfile) ctx.lineTo(p.x, p.y);
    for (let i = rightProfile.length - 1; i >= 0; i--) ctx.lineTo(rightProfile[i].x, rightProfile[i].y);
    ctx.closePath();

    // Gradient xanh mượt mà toàn thân cây
    const grad = ctx.createLinearGradient(cx, cy + TOP_Y * baseScale, cx, cy + BOT_Y * baseScale);
    grad.addColorStop(0, '#0f3d0f');
    grad.addColorStop(0.5, '#1f661f');
    grad.addColorStop(1, '#0f3d0f');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // --- 2. Vẽ OUTLINE (Neon) ---
  // Vẽ chạy dần theo chu vi
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(80, 255, 80, 0.8)';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#66ff66';
  ctx.lineWidth = baseScale * 0.008;

  const currentIdx = Math.floor(totalPts * progress);

  ctx.beginPath();
  let drawnCount = 0;

  // Trái
  if (leftProfile.length > 0) ctx.moveTo(leftProfile[0].x, leftProfile[0].y);

  for (let i = 1; i < leftProfile.length; i++) {
    if (drawnCount > currentIdx) break;
    ctx.lineTo(leftProfile[i].x, leftProfile[i].y);
    drawnCount++;
  }

  // Đáy
  if (drawnCount < currentIdx) {
    for (let i = 0; i < bottomProfile.length; i++) {
      if (drawnCount > currentIdx) break;
      ctx.lineTo(bottomProfile[i].x, bottomProfile[i].y);
      drawnCount++;
    }
  }

  // Phải (vẽ từ dưới lên)
  if (drawnCount < currentIdx) {
    for (let i = rightProfile.length - 1; i >= 0; i--) {
      if (drawnCount > currentIdx) break;
      ctx.lineTo(rightProfile[i].x, rightProfile[i].y);
      drawnCount++;
    }
  }

  ctx.stroke();
  ctx.restore();

  // --- 3. Vẽ Internal Curves (Gân lá mờ) ---
  // Chỉ vẽ khi cây đã hiện ra tương đối
  if (progress > 0.6) {
    const curveAlpha = (progress - 0.6) / 0.4;
    ctx.save();
    ctx.globalAlpha = curveAlpha * 0.3; // Rất mờ
    ctx.strokeStyle = '#a3ffa3';
    ctx.lineWidth = baseScale * 0.003;
    ctx.shadowBlur = 0; // Không glow

    for (let curve of internalCurves) {
      ctx.beginPath();
      ctx.moveTo(curve[0].x, curve[0].y);
      for (let i = 1; i < curve.length; i++) ctx.lineTo(curve[i].x, curve[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- 4. Baubles ---
  if (progress > 0.7) {
    const bulbAlpha = (progress - 0.7) / 0.3;
    for (let b of baubles) {
      const blink = 0.7 + 0.3 * Math.sin(now * 3 + b.phase);
      ctx.save();
      ctx.globalAlpha = bulbAlpha * blink;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, baseScale * 0.012 * b.sizeVar, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = bulbAlpha * blink * 0.8;
      ctx.beginPath();
      ctx.arc(b.x - baseScale * 0.003, b.y - baseScale * 0.003, baseScale * 0.003, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawStar(progress) {
  const n = Math.max(2, Math.floor((starN - 1) * progress) + 1);
  if (n < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#fffaca';
  ctx.lineWidth = baseScale * 0.010;

  ctx.beginPath();
  ctx.moveTo(starX[0], starY[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(starX[i], starY[i]);
  ctx.closePath();
  ctx.stroke();

  if (progress >= 0.95) {
    const grad = ctx.createRadialGradient(cx, cy + TOP_Y * baseScale, baseScale * STAR_R_IN * 0.5, cx, cy + TOP_Y * baseScale, baseScale * STAR_R_OUT);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#ffd700');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

function drawWipe(alpha, dir) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = W * 1.2;
  const x = (dir === 1) ? (-w + alpha * w) : (W - alpha * w);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(5,8,20,0)');
  g.addColorStop(0.45, 'rgba(5,8,20,0.9)');
  g.addColorStop(1, 'rgba(5,8,20,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawCenteredText(line1, line2, alpha, yPx) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(245,195,122,0.8)';
  ctx.shadowBlur = 25;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const baseSize = Math.max(32, Math.min(90, Math.min(W, H) * 0.09));
  ctx.font = `700 ${baseSize}px "Mountains of Christmas", Georgia, serif`;
  ctx.fillText(line1, W / 2, yPx);

  if (line2) {
    ctx.shadowBlur = 15;
    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = '#f0f0f0';
    ctx.font = `600 ${Math.max(16, baseSize * 0.45)}px system-ui`;
    ctx.fillText(line2, W / 2, yPx + baseSize * 0.75);
  }
  ctx.restore();
}

// ===== Main loop =====
function loop(now) {
  if (!started) {
    requestAnimationFrame(loop);
    return;
  }
  if (!lastNow) lastNow = now;
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;

  const t = (now - t0) / 1000;
  const tc = ((t % T_TOTAL) + T_TOTAL) % T_TOTAL;

  if (tc > T_DRAW * 0.3 && tc < T_TOTAL - T_TRANS2) {
    nextFireworkTime -= dt;
    if (nextFireworkTime <= 0) {
      const fx = rand(W * 0.1, W * 0.9);
      const fy = rand(H * 0.05, H * 0.45);
      spawnFirework(fx, fy);
      nextFireworkTime = rand(FW_MIN_INTERVAL, FW_MAX_INTERVAL);
    }
  }

  fillBackground(t);

  let drawP = 0, merryA = 0, wishA = 0, wipeA = 0;
  if (tc < T_DRAW) {
    drawP = easeOutCubic(tc / T_DRAW);
  } else if (tc < T_DRAW + T_HOLD1) {
    drawP = 1;
    const u = (tc - T_DRAW) / T_HOLD1;
    merryA = clamp(u * 1.3, 0, 1);
  } else if (tc < T_DRAW + T_HOLD1 + T_TRANS) {
    drawP = 1;
    merryA = 1 - (tc - (T_DRAW + T_HOLD1)) / T_TRANS;
    wipeA = (tc - (T_DRAW + T_HOLD1)) / T_TRANS;
  } else if (tc < T_DRAW + T_HOLD1 + T_TRANS + T_HOLD2) {
    drawP = 1;
    const u = (tc - (T_DRAW + T_HOLD1 + T_TRANS)) / T_HOLD2;
    wishA = clamp(u * 1.3, 0, 1);
  } else {
    drawP = 1;
    wishA = 1 - (tc - (T_DRAW + T_HOLD1 + T_TRANS + T_HOLD2)) / T_TRANS2;
    wipeA = (tc - (T_DRAW + T_HOLD1 + T_TRANS + T_HOLD2)) / T_TRANS2;
  }

  drawSeamlessTree(drawP, t);
  const starProg = clamp(drawP * 1.15 - 0.1, 0, 1);
  drawStar(starProg);

  const baseLineY = cy + BOT_Y * baseScale;
  if (drawP > 0.85) {
    const u = (drawP - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.7 * u;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2.5, baseScale * 0.007);
    ctx.beginPath();
    const y = baseLineY + 0.12 * baseScale;
    ctx.arc(cx, y, baseScale * 0.11, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();
  }

  const yText = Math.min(H - 110, baseLineY + 0.32 * baseScale);
  if (merryA > 0) drawCenteredText('Merry Christmas!!', '', merryA, yText);
  if (wishA > 0) drawCenteredText('Wish you...', 'Happiness • Health • Success', wishA, yText);

  if (tc >= T_DRAW + T_HOLD1 && tc < T_DRAW + T_HOLD1 + T_TRANS) drawWipe(wipeA, 1);
  if (tc >= T_DRAW + T_HOLD1 + T_TRANS + T_HOLD2) drawWipe(wipeA, -1);

  updateFireworks(dt);
  drawFireworks();

  requestAnimationFrame(loop);
}

// ===== Start =====
startBtn.addEventListener('click', () => {
  started = true;
  t0 = performance.now();
  lastNow = 0;
  canvas.style.pointerEvents = 'auto';
  tryPlayMusic();
  updateMuteIcon();
  startEl.classList.add('hide');
  requestAnimationFrame(loop);
});

canvas.addEventListener('pointerdown', (e) => {
  if (!started) return;
  const rect = canvas.getBoundingClientRect();
  spawnFirework(e.clientX - rect.left, e.clientY - rect.top);
});

setTimeout(() => {
  resize();
  hint('');
}, 100);