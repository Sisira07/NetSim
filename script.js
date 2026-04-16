// ─── STATE ────────────────────────────────────────────────────────────────
const COLORS = ['#00d4b4','#4a9eff','#ffb340','#ff5f6d','#9d7eff','#39d353','#ff8c42','#c084fc'];
let nodes = [], edges = [], algo = 'dvr', mode = 'view';
let routingTables = {}, iterHistory = [], currentStep = 0, converged = false;
let selectedPacketPath = [], animatingPacket = false;
let dragNode = null, dragOffX = 0, dragOffY = 0;
let modalEdge = null, selectedNode = null;
let canvas, ctx;
let hoveredNode = null, hoveredEdge = null;
let options = {
  splitHorizon: false,
  poisonReverse: false,
  maxCost: 16
};

let brokenLinks = new Set(); // for failure simulation

// ─── CANVAS SETUP ────────────────────────────────────────────────────────
function breakModalLink() {
  if (!modalEdge) return;
  brokenLinks.add(modalEdge.id);
  resetAlgoState();
  draw();
  log('Link failed (used to trigger count-to-infinity)', 'coral');
}

function restoreModalLink() {
  if (!modalEdge) return;
  brokenLinks.delete(modalEdge.id);
  resetAlgoState();
  draw();
  log('Link restored', 'green');
}

function initCanvas() {
  canvas = document.getElementById('canvas');
  const area = document.getElementById('canvas-area');
  canvas.width = area.clientWidth;
  canvas.height = area.clientHeight;
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onDblClick);
  window.addEventListener('resize', () => {
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
    draw();
  });
}

function getNodeAt(x, y) { return nodes.find(n => Math.hypot(n.x - x, n.y - y) < 24); }
function getEdgeAt(x, y) {
  for (let e of edges) {
    const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to);
    if (!f || !t) continue;
    const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
    if (Math.hypot(mx - x, my - y) < 16) return e;
  }
}

function onMouseDown(e) {
  const { x, y } = getPos(e);
  const n = getNodeAt(x, y);
  if (n && mode === 'move') { dragNode = n; dragOffX = x - n.x; dragOffY = y - n.y; return; }
  if (n) { selectedNode = selectedNode === n ? null : n; renderNodeList(); draw(); return; }
  const ed = getEdgeAt(x, y);
  if (ed) openModal(ed);
}

function onMouseMove(e) {
  const { x, y } = getPos(e);
  if (dragNode) { dragNode.x = x - dragOffX; dragNode.y = y - dragOffY; draw(); return; }
  hoveredNode = getNodeAt(x, y);
  hoveredEdge = !hoveredNode ? getEdgeAt(x, y) : null;
  canvas.style.cursor = (hoveredNode || hoveredEdge) ? 'pointer' : 'default';
  const tip = document.getElementById('tooltip');
  if (hoveredEdge) {
    const f = nodes.find(n => n.id === hoveredEdge.from), t = nodes.find(n => n.id === hoveredEdge.to);
    tip.textContent = `${f.name} ↔ ${t.name}  cost: ${hoveredEdge.cost}  [double-click to edit]`;
    tip.style.left = (e.offsetX + 10) + 'px'; tip.style.top = (e.offsetY - 30) + 'px';
    tip.classList.add('show');
  } else if (hoveredNode) {
    const rt = routingTables[hoveredNode.id];
    const routes = rt ? Object.keys(rt).length : 0;
    tip.textContent = `${hoveredNode.name}  routes: ${routes}  [click to select, drag in Move mode]`;
    tip.style.left = (e.offsetX + 10) + 'px'; tip.style.top = (e.offsetY - 30) + 'px';
    tip.classList.add('show');
  } else {
    tip.classList.remove('show');
  }
  draw();
}

function onMouseUp() { dragNode = null; }
function onDblClick(e) {
  const { x, y } = getPos(e);
  const ed = getEdgeAt(x, y);
  if (ed) openModal(ed);
}
function getPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ─── DRAWING ─────────────────────────────────────────────────────────────
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  edges.forEach(drawEdge);
  nodes.forEach(drawNode);
}

function drawGrid() {
  const s = 40;
  ctx.strokeStyle = 'rgba(0,255,224,0.04)'; ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,255,224,0.13)';
  for (let x = 0; x < canvas.width; x += s) {
    for (let y = 0; y < canvas.height; y += s) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawEdge(e) {
  const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to);
  if (!f || !t) return;

  const isBroken = brokenLinks.has(e.id);
  const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;

  if (isBroken) {
    // 🔴 Broken link (red dashed glow)
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = 'rgba(255,60,90,0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8,6]);
    ctx.shadowColor = '#ff3d5a';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = '#ff3d5a';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('BROKEN', mx, my - 20);

  } else {
    // ✅ Normal bright link
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = 'rgba(0,255,224,0.35)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffe0';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Cost label
  ctx.fillStyle = '#2a5a78';
  ctx.font = '700 10px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.fillText(e.cost, mx, my + 12);
}

function drawNode(n) {
  const isSelected = n === selectedNode;
  const isSrc = selectedPacketPath[0] === n.id;
  const isDst = selectedPacketPath[selectedPacketPath.length - 1] === n.id;
  const isPath = selectedPacketPath.includes(n.id);
  const isHov = n === hoveredNode;
  const r = 22;
  const c = n.color;

  // Outer ambient glow bloom
  if (isSelected || isPath || isHov) {
    const glowR = isSelected ? r + 22 : r + 14;
    const glowColor = (isSrc || isDst) ? 'rgba(255,204,0,' : 'rgba(0,255,224,';
    ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glowColor + '0.06)'; ctx.fill();
    ctx.beginPath(); ctx.arc(n.x, n.y, glowR - 8, 0, Math.PI * 2);
    ctx.fillStyle = glowColor + '0.1)'; ctx.fill();
  }

  // Outer ring glow
  ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
  if (isSelected) {
    ctx.strokeStyle = 'rgba(0,255,224,0.4)'; ctx.lineWidth = 1;
    ctx.shadowColor = '#00ffe0'; ctx.shadowBlur = 20;
  } else if (isSrc || isDst) {
    ctx.strokeStyle = 'rgba(255,204,0,0.4)'; ctx.lineWidth = 1;
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 16;
  } else if (isPath) {
    ctx.strokeStyle = 'rgba(0,255,224,0.25)'; ctx.lineWidth = 1;
    ctx.shadowColor = '#00ffe0'; ctx.shadowBlur = 12;
  } else if (isHov) {
    ctx.strokeStyle = 'rgba(61,180,255,0.3)'; ctx.lineWidth = 1;
    ctx.shadowColor = '#3db4ff'; ctx.shadowBlur = 12;
  } else {
    ctx.strokeStyle = 'transparent'; ctx.lineWidth = 0;
  }
  ctx.stroke(); ctx.shadowBlur = 0;

  // Node fill
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.fillStyle = c + '18'; ctx.fill();

  // Node border with glow
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = isSelected ? '#00ffe0' : (isSrc || isDst) ? '#ffcc00' : isPath ? '#00ccb4' : isHov ? '#3db4ff' : c + '66';
  ctx.lineWidth = isSelected || isSrc || isDst ? 2 : 1.5;
  if (isSelected) { ctx.shadowColor = '#00ffe0'; ctx.shadowBlur = 20; }
  else if (isSrc || isDst) { ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 16; }
  else if (isPath) { ctx.shadowColor = '#00ffe0'; ctx.shadowBlur = 10; }
  else if (isHov) { ctx.shadowColor = '#3db4ff'; ctx.shadowBlur = 10; }
  ctx.stroke(); ctx.shadowBlur = 0;

  // Inner ring
  ctx.beginPath(); ctx.arc(n.x, n.y, r - 7, 0, Math.PI * 2);
  ctx.strokeStyle = c + '40'; ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = isSelected ? '#00ffe0' : (isSrc || isDst) ? '#ffcc00' : c;
  ctx.font = '700 12px JetBrains Mono';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (isSelected) { ctx.shadowColor = '#00ffe0'; ctx.shadowBlur = 12; }
  else if (isSrc || isDst) { ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 10; }
  else { ctx.shadowColor = c; ctx.shadowBlur = 6; }
  ctx.fillText(n.name, n.x, n.y);
  ctx.shadowBlur = 0;
}

function isOnPath(e) {
  for (let i = 0; i < selectedPacketPath.length - 1; i++) {
    const a = selectedPacketPath[i], b = selectedPacketPath[i + 1];
    if ((e.from === a && e.to === b) || (e.from === b && e.to === a)) return true;
  }
  return false;
}

// ─── CIRCULAR LAYOUT ──────────────────────────────────────────────────────
function arrangeCircular() {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) * 0.33;
  nodes.forEach((n, i) => {
    const a = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
    n.x = cx + r * Math.cos(a); n.y = cy + r * Math.sin(a);
  });
  draw();
}

// ─── ROUTER MANAGEMENT ────────────────────────────────────────────────────
function addRouter() {
  const nameEl = document.getElementById('router-name');
  let name = (nameEl.value.trim() || `R${nodes.length + 1}`).toUpperCase().slice(0, 4);
  if (nodes.find(n => n.name === name)) { log(`Router ${name} already exists`, 'coral'); return; }
  const id = 'r' + Date.now();
  const color = COLORS[nodes.length % COLORS.length];
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) * 0.33;
  const a = (2 * Math.PI * nodes.length / Math.max(nodes.length + 1, 1)) - Math.PI / 2;
  nodes.push({ id, name, color, x: cx + (nodes.length ? r * Math.cos(a) : 0), y: cy + (nodes.length ? r * Math.sin(a) : 0) });
  nameEl.value = '';
  document.getElementById('canvas-hint').style.display = 'none';
  updateSelects(); renderNodeList(); resetAlgoState(); draw();
  log(`Added router ${name}`, 'teal');
}

function deleteRouter(id) {
  const n = nodes.find(n => n.id === id); if (!n) return;
  nodes = nodes.filter(n => n.id !== id);
  edges = edges.filter(e => e.from !== id && e.to !== id);
  if (selectedNode && selectedNode.id === id) selectedNode = null;
  selectedPacketPath = [];
  updateSelects(); renderNodeList(); resetAlgoState(); draw();
  log(`Removed router ${n.name}`, 'coral');
}

// ─── LINK MANAGEMENT ──────────────────────────────────────────────────────
function addLink() {
  const f = document.getElementById('link-from').value;
  const t = document.getElementById('link-to').value;
  const c = parseInt(document.getElementById('link-cost').value) || 1;
  if (!f || !t || f === t) { log('Select two different routers', 'amber'); return; }
  if (edges.find(e => (e.from === f && e.to === t) || (e.from === t && e.to === f))) {
    log('Link already exists. Double-click it to edit.', 'amber'); return;
  }
  edges.push({ id: 'e' + Date.now(), from: f, to: t, cost: Math.max(1, Math.min(999, c)) });
  resetAlgoState(); draw();
  const fn = nodes.find(n => n.id === f), tn = nodes.find(n => n.id === t);
  log(`Connected ${fn.name} ↔ ${tn.name} (cost ${c})`, 'blue');
}

function openModal(e) {
  modalEdge = e;
  document.getElementById('modal-cost').value = e.cost;
  document.getElementById('modal').classList.add('open');
}

function closeModal(ev) {
  if (ev.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
}

function saveModal() {
  if (!modalEdge) return;
  modalEdge.cost = Math.max(1, parseInt(document.getElementById('modal-cost').value) || 1);
  resetAlgoState(); draw();
  document.getElementById('modal').classList.remove('open');
  log(`Updated link cost to ${modalEdge.cost}`, 'blue');
}

function deleteModalLink() {
  if (!modalEdge) return;
  edges = edges.filter(e => e !== modalEdge);
  resetAlgoState(); draw();
  document.getElementById('modal').classList.remove('open');
  log('Link deleted', 'coral');
}

// ─── SELECTS ─────────────────────────────────────────────────────────────
function updateSelects() {
  ['link-from', 'link-to', 'pkt-src', 'pkt-dst', 'rt-select'].forEach(id => {
    const el = document.getElementById(id);
    const val = el.value;
    const isRt = id === 'rt-select';
    el.innerHTML = (isRt ? '<option value="">All Routers</option>' : '<option value="">Select router</option>') +
      nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
    if (nodes.find(n => n.id === val)) el.value = val;
  });
}

function renderNodeList() {
  const el = document.getElementById('node-list');
  el.innerHTML = nodes.length ? nodes.map(n => `
    <div class="node-item${selectedNode === n ? ' selected' : ''}" onclick="selectNode('${n.id}')">
      <div class="node-circle" style="background:${n.color}22;border:1.5px solid ${n.color};color:${n.color}">${n.name}</div>
      <div class="node-info">
        <div class="node-name" style="color:${n.color}">${n.name}</div>
        <div class="node-sub">${edges.filter(e => e.from === n.id || e.to === n.id).length} link(s)</div>
      </div>
      <button class="node-del" onclick="event.stopPropagation();deleteRouter('${n.id}')">✕</button>
    </div>`).join('') :
    '<div style="color:var(--text3);font-size:11px;text-align:center;padding:20px">No routers yet</div>';
}

function selectNode(id) {
  selectedNode = nodes.find(n => n.id === id) === selectedNode ? null : nodes.find(n => n.id === id);
  renderNodeList(); draw();
}

// ─── ALGORITHM ────────────────────────────────────────────────────────────
function setAlgo(a) {
  algo = a;
  document.querySelectorAll('.algo-tab').forEach((t, i) => t.classList.toggle('active', i === (a === 'dvr' ? 0 : 1)));
  document.getElementById('algo-badge').textContent = a === 'dvr' ? 'DVR' : 'LSA';
  resetAlgoState();
  log(`Switched to ${a === 'dvr' ? 'Distance Vector' : 'Link State'} algorithm`, 'purple');
}

function resetAlgoState() {
  routingTables = {}; iterHistory = []; currentStep = 0; converged = false; selectedPacketPath = [];
  document.getElementById('conv-badge').textContent = 'Not Converged';
  document.getElementById('conv-badge').className = 'badge badge-amber';
  document.getElementById('status-text').textContent = 'Ready';
  initRoutingTables(); renderRoutingTable(); updateStepInfo(); draw();
}

function initRoutingTables() {
  nodes.forEach(n => {
    routingTables[n.id] = {};
    routingTables[n.id][n.id] = { cost: 0, next: n.id };
    edges.forEach(e => {
      if (e.from === n.id) routingTables[n.id][e.to] = { cost: e.cost, next: e.to };
      if (e.to === n.id) routingTables[n.id][e.from] = { cost: e.cost, next: e.from };
    });
  });
}

function stepAlgo() {
  if (!nodes.length) { log('Add routers first', 'amber'); return; }
  if (converged) { log('Already converged!', 'teal'); return; }
  if (algo === 'dvr') stepDVR(); else stepLSA();
  renderRoutingTable(); updateStepInfo(); draw();
}

function stepDVR() {
  if (!Object.keys(routingTables).length) initRoutingTables();

  let changed = false;
  const newTables = JSON.parse(JSON.stringify(routingTables));

  nodes.forEach(n => {
    edges.forEach(e => {

     if (e.from === n.id || e.to === n.id) {
  const nbId = e.from === n.id ? e.to : e.from;

  const isBroken = brokenLinks.has(e.id);
  const linkCost = isBroken ? Infinity : e.cost;

  const nbTable = routingTables[nbId];
  if (!nbTable) return;

        Object.entries(nbTable).forEach(([dest, info]) => {

          if (dest === n.id) return;

          let advertisedCost = info.cost;

          // ✅ SPLIT HORIZON
          if (options.splitHorizon && info.next === n.id) {
            advertisedCost = Infinity;
          }

          // ✅ POISON REVERSE
          if (options.poisonReverse && info.next === n.id) {
            advertisedCost = Infinity;
          }

          const newCost =
            advertisedCost === Infinity
              ? Infinity
              : linkCost + advertisedCost;

          const current = routingTables[n.id][dest];

          // 🔥 CRITICAL FIX: allow BAD updates (count-to-infinity)
          if (
            !current ||
            current.next === nbId ||   // allow update via same neighbor
            newCost < current.cost
          ) {
            newTables[n.id][dest] = {
              cost: Math.min(newCost, options.maxCost),
              next: nbId
            };
            changed = true;
          }
        });
      }
    });
  });

  Object.assign(routingTables, newTables);
  currentStep++;
  iterHistory.push(JSON.parse(JSON.stringify(routingTables)));

  if (!changed) {
    converged = true;
    onConverge();
  } else {
    log(`DVR Step ${currentStep}: routes updated`, 'teal');
  }
}

function stepLSA() {
  if (!Object.keys(routingTables).length) initRoutingTables();
  nodes.forEach(src => {
    const dist = {}, prev = {}, visited = new Set();
    nodes.forEach(n => { dist[n.id] = n.id === src.id ? 0 : Infinity; prev[n.id] = null; });
    while (visited.size < nodes.length) {
      let u = null;
      nodes.forEach(n => { if (!visited.has(n.id) && (u === null || dist[n.id] < dist[u])) u = n.id; });
      if (u === null || dist[u] === Infinity) break;
      visited.add(u);
      edges.forEach(e => {
        const nb = e.from === u ? e.to : e.to === u ? e.from : null;
        if (!nb) return;
        const alt = dist[u] + e.cost;
        if (alt < dist[nb]) { dist[nb] = alt; prev[nb] = u; }
      });
    }
    routingTables[src.id] = {};
    nodes.forEach(dst => {
      if (dst.id === src.id) { routingTables[src.id][dst.id] = { cost: 0, next: src.id }; return; }
      if (dist[dst.id] === Infinity) return;
      let next = dst.id;
      while (prev[next] && prev[next] !== src.id) next = prev[next];
      if (prev[next] === src.id) routingTables[src.id][dst.id] = { cost: dist[dst.id], next };
    });
  });
  currentStep++;
  converged = true;
  onConverge();
}

function runToConverge() {
  if (!nodes.length) { log('Add routers first', 'amber'); return; }
  let maxIter = 100;
  while (!converged && maxIter-- > 0) stepAlgo();
  if (!converged) log('Max iterations reached', 'coral');
  renderRoutingTable(); updateStepInfo(); draw();
}

function onConverge() {
  document.getElementById('conv-badge').textContent = 'Converged ✓';
  document.getElementById('conv-badge').className = 'badge badge-teal';
  document.getElementById('status-text').textContent = 'Converged';
  log(`Network converged after ${currentStep} step(s) using ${algo === 'dvr' ? 'Distance Vector' : 'Link State'}`, 'green');
}

// ─── PACKET SIMULATION ────────────────────────────────────────────────────
function simulatePacket() {
  const src = document.getElementById('pkt-src').value;
  const dst = document.getElementById('pkt-dst').value;
  if (!src || !dst) { log('Select source and destination', 'amber'); return; }
  if (src === dst) { log('Source and destination are the same', 'amber'); return; }
  if (!converged) { log('Run algorithm to convergence first', 'amber'); return; }
  const path = getPath(src, dst);
  if (!path) { log('No path found between selected routers', 'coral'); return; }
  selectedPacketPath = path;
  const names = path.map(id => nodes.find(n => n.id === id).name);
  const totalCost = routingTables[src][dst]?.cost || '?';
  log(`Packet: ${names.join(' → ')}  total cost: ${totalCost}`, 'amber');
  animatePacket(path);
  draw();
}

function getPath(src, dst) {
  const path = [src]; let cur = src, limit = 20;
  while (cur !== dst && limit-- > 0) {
    const entry = routingTables[cur]?.[dst];
    if (!entry || entry.next === cur) return null;
    cur = entry.next; path.push(cur);
  }
  return cur === dst ? path : null;
}

function animatePacket(path) {
  if (animatingPacket) return;
  animatingPacket = true;
  let seg = 0;
  function nextSeg() {
    if (seg >= path.length - 1) { animatingPacket = false; return; }
    const f = nodes.find(n => n.id === path[seg]), t = nodes.find(n => n.id === path[seg + 1]);
    if (!f || !t) { seg++; nextSeg(); return; }
    let prog = 0;
    const dot = document.createElement('div');
    dot.className = 'packet';
    dot.style.left = (f.x - 5) + 'px'; dot.style.top = (f.y - 5) + 'px';
    document.getElementById('canvas-area').appendChild(dot);
    function anim() {
      prog = Math.min(1, prog + 0.025);
      const x = f.x + (t.x - f.x) * prog, y = f.y + (t.y - f.y) * prog;
      dot.style.left = (x - 5) + 'px'; dot.style.top = (y - 5) + 'px';
      if (prog < 1) requestAnimationFrame(anim);
      else { dot.remove(); seg++; setTimeout(nextSeg, 60); }
    }
    requestAnimationFrame(anim);
  }
  nextSeg();
}

function toggleSplitHorizon() {
  options.splitHorizon = !options.splitHorizon;
  log(`Split Horizon: ${options.splitHorizon ? 'ON' : 'OFF'}`, 'blue');
}

function togglePoisonReverse() {
  options.poisonReverse = !options.poisonReverse;
  log(`Poison Reverse: ${options.poisonReverse ? 'ON' : 'OFF'}`, 'purple');
}

// ─── ROUTING TABLE RENDER ─────────────────────────────────────────────────
function renderRoutingTable() {
  const sel = document.getElementById('rt-select').value;
  const el = document.getElementById('rt-container');
  if (!nodes.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:11px;text-align:center;padding:20px">No routers yet</div>';
    return;
  }
  const show = sel ? [nodes.find(n => n.id === sel)].filter(Boolean) : nodes;
  el.innerHTML = show.map(n => {
    const rt = routingTables[n.id] || {};
    const rows = Object.entries(rt).filter(([d]) => d !== n.id).sort((a, b) => a[1].cost - b[1].cost);
    return `<div class="rt-router-header${selectedNode === n ? ' active' : ''}" onclick="selectNode('${n.id}')" style="border-left:3px solid ${n.color}">
      <div style="width:8px;height:8px;border-radius:50%;background:${n.color}"></div>
      <span style="color:${n.color};font-size:11px">${n.name}</span>
      <span style="font-size:9px;color:var(--text3);margin-left:auto">${rows.length} routes</span>
    </div>
    <div class="rt-header"><span>DEST</span><span style="text-align:center">COST</span><span>NEXT HOP</span></div>
    ${rows.length ? rows.map(([dest, info]) => {
      const dn = nodes.find(x => x.id === dest);
      const nn = nodes.find(x => x.id === info.next);
      const isOnPkt = selectedPacketPath.includes(dest) && selectedPacketPath.includes(n.id);
      return `<div class="rt-row${isOnPkt ? ' highlight' : ''}">
        <span class="rt-dest" style="color:${dn?.color || 'var(--text)'}">${dn?.name || dest}</span>
        <span class="rt-cost">${info.cost === Infinity ? '∞' : info.cost}</span>
        <span class="rt-next" style="color:${nn?.color || 'var(--blue)'}">${nn?.name || info.next}</span>
      </div>`;
    }).join('') : '<div class="rt-row"><span style="color:var(--text3);font-size:10px">No routes yet</span></div>'}`;
  }).join('<div style="height:8px"></div>');
}

function updateStepInfo() {
  const el = document.getElementById('step-info');
  const fill = document.getElementById('step-fill');
  const maxSteps = nodes.length + 2;
  el.textContent = converged
    ? `Converged in ${currentStep} step(s) ✓`
    : `Step ${currentStep} — ${currentStep === 0 ? 'Run algorithm to compute routes' : 'Updating routing tables...'}`;
  fill.style.width = converged ? '100%' : Math.min(100, (currentStep / Math.max(maxSteps, 1)) * 100) + '%';
}

// ─── LOGGING ─────────────────────────────────────────────────────────────
function log(msg, cls = '') {
  const el = document.getElementById('log-area');
  const time = new Date().toTimeString().slice(0, 8);
  const div = document.createElement('div');
  div.className = `log-line${cls ? ' log-' + cls : ''}`;
  div.innerHTML = `<span style="color:var(--text3)">[${time}]</span> ${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (el.children.length > 200) el.removeChild(el.firstChild);
}

// ─── MODE & RESET ─────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('mode-view').classList.toggle('active', m === 'view');
  document.getElementById('mode-move').classList.toggle('active', m === 'move');
}

function resetAll() {
  nodes = []; edges = []; routingTables = {}; iterHistory = [];
  currentStep = 0; converged = false; selectedPacketPath = [];
  selectedNode = null; animatingPacket = false;
  document.getElementById('conv-badge').textContent = 'Not Converged';
  document.getElementById('conv-badge').className = 'badge badge-amber';
  document.getElementById('status-text').textContent = 'Ready';
  document.getElementById('canvas-hint').style.display = 'block';
  updateSelects(); renderNodeList(); renderRoutingTable(); updateStepInfo(); draw();
  log('Reset complete. Start a new simulation.', 'amber');
}

// ─── EXAMPLE INIT ────────────────────────────────────────────────────────
function initExample() {
  const pairs = [['R1','#00d4b4'],['R2','#4a9eff'],['R3','#ffb340'],['R4','#ff5f6d'],['R5','#9d7eff']];
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) * 0.33;
  pairs.forEach(([name, color], i) => {
    const a = (2 * Math.PI * i / pairs.length) - Math.PI / 2;
    nodes.push({ id: 'r' + (i + 1), name, color, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
  const links = [[0,1,4],[1,2,2],[2,3,3],[3,4,1],[4,0,5],[0,2,7],[1,3,6]];
  links.forEach(([f, t, c]) => edges.push({ id: 'e' + (f+1) + '_' + (t+1), from: 'r'+(f+1), to: 'r'+(t+1), cost: c }));
  document.getElementById('canvas-hint').style.display = 'none';
  updateSelects(); renderNodeList(); initRoutingTables(); renderRoutingTable(); draw();
  log('Loaded example: 5 routers, 7 links. Click Converge to compute routes!', 'teal');
}

// ─── BOOT ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  ctx = canvas.getContext('2d');
  initExample();
  log('NetSim ready. Algorithm: Distance Vector Routing', 'green');
  function loop() { draw(); requestAnimationFrame(loop); }
  loop();
});