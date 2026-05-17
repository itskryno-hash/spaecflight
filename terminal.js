// terminal.js - NASA mission control terminal readout

class MissionTerminal {
  constructor(containerEl) {
    this.container = containerEl;
    this.logLines = [];
    this.maxLogLines = 18;
    this.tickCount = 0;
    this.lastPhase = null;
    this.graphCanvas = null;
    this.graphCtx = null;
    this.rocketCanvas = null;
    this.rocketCtx = null;
    this.missionElapsed = 0;

    this.build();
  }

  build() {
    this.container.innerHTML = `
      <div class="terminal-header">
        <div class="terminal-title-row">
          <span class="terminal-badge">◉ LIVE</span>
          <span class="terminal-title">MISSION CONTROL &mdash; FLIGHT COMPUTER v1.0</span>
          <span class="terminal-clock" id="t-clock">T+00:00:00</span>
        </div>
        <div class="terminal-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      </div>

      <div class="terminal-body">
        <div class="terminal-left">
          <div class="readout-block" id="readout-main">
            <div class="readout-label">// PRIMARY FLIGHT DATA</div>
            <div id="t-altitude"   class="readout-row">ALTITUDE     : <span class="readout-val">---</span></div>
            <div id="t-velocity"   class="readout-row">VELOCITY     : <span class="readout-val">---</span></div>
            <div id="t-accel"      class="readout-row">ACCELERATION : <span class="readout-val">---</span></div>
            <div id="t-zone"       class="readout-row zone-row">ZONE         : <span class="readout-val zone-val">---</span></div>
          </div>

          <div class="readout-block" id="readout-engine">
            <div class="readout-label">// PROPULSION STATUS</div>
            <div id="t-fuel"       class="readout-row">FUEL         : <span class="readout-val">---</span></div>
            <div id="t-fuel-bar"   class="readout-row">FUEL LEVEL   : <span class="readout-val fuel-bar">----------</span></div>
            <div id="t-thrust"     class="readout-row">THRUST       : <span class="readout-val">---</span></div>
            <div id="t-engine"     class="readout-row">ENGINE       : <span class="readout-val">---</span></div>
            <div id="t-phase"      class="readout-row">PHASE        : <span class="readout-val phase-val">---</span></div>
          </div>

          <div class="readout-block" id="readout-stability">
            <div class="readout-label">// ATTITUDE & STABILITY</div>
            <div id="t-drift"      class="readout-row">DRIFT ANGLE  : <span class="readout-val">---</span></div>
            <div id="t-drift-bar"  class="readout-row">HEADING      : <span class="readout-val drift-bar">---</span></div>
            <div id="t-maxalt"     class="readout-row">MAX ALT      : <span class="readout-val">---</span></div>
            <div id="t-mass"       class="readout-row">TOTAL MASS   : <span class="readout-val">---</span></div>
          </div>

          <div class="readout-block log-block">
            <div class="readout-label">// FLIGHT EVENT LOG</div>
            <div id="t-log" class="flight-log"></div>
          </div>
        </div>

        <div class="terminal-right">
          <div class="readout-label">// ALTITUDE PROFILE</div>
          <canvas id="alt-graph" width="320" height="200"></canvas>

          <div class="readout-label" style="margin-top:12px">// VEHICLE TELEMETRY</div>
          <canvas id="rocket-view" width="320" height="280"></canvas>
        </div>
      </div>

      <div class="terminal-footer">
        <div class="terminal-divider">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div class="status-bar">
          <span id="t-statusleft">STANDING BY</span>
          <span id="t-statusright">TELEMETRY LINK: NOMINAL</span>
        </div>
      </div>
    `;

    // grab canvases
    this.graphCanvas = this.container.querySelector('#alt-graph');
    this.graphCtx = this.graphCanvas ? this.graphCanvas.getContext('2d') : null;
    this.rocketCanvas = this.container.querySelector('#rocket-view');
    this.rocketCtx = this.rocketCanvas ? this.rocketCanvas.getContext('2d') : null;

    this.drawEmptyGraph();
    this.drawRocketIdle();
  }

  update(state, rocketParts) {
    this.tickCount++;
    this.missionElapsed = state.time;

    this.updateClock(state.time);
    this.updateReadouts(state);
    this.updateFuelBar(state);
    this.updateDriftBar(state);
    this.updatePhaseEvents(state);
    this.updateGraph(state);
    this.updateRocketView(state, rocketParts);
    this.updateStatusBar(state);
  }

  updateClock(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const str = `T+${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const el = this.container.querySelector('#t-clock');
    if (el) el.textContent = str;
  }

  updateReadouts(state) {
    const set = (id, text, cls) => {
      const el = this.container.querySelector(`#${id} .readout-val`);
      if (el) {
        el.textContent = text;
        if (cls) el.className = `readout-val ${cls}`;
      }
    };

    const altKm = state.altitudeKm;
    const altStr = altKm >= 1
      ? `${altKm.toFixed(3)} km`
      : `${state.altitude.toFixed(1)} m`;

    set('t-altitude', altStr);
    set('t-velocity', `${state.velocity.toFixed(1)} m/s ${state.velocity >= 0 ? '↑' : '↓'}`);
    set('t-accel',    `${state.acceleration.toFixed(2)} m/s²`);

    const zoneEl = this.container.querySelector('#t-zone .zone-val');
    if (zoneEl) {
      zoneEl.textContent = state.zone.label;
      // color by zone
      const zoneColors = {
        'GROUND': '#aaaaaa',
        'LOW_ATMO': '#88ffaa',
        'HIGH_ATMO': '#44ddff',
        'MESOSPHERE': '#8888ff',
        'KARMAN': '#ffff44',
        'LOW_ORBIT': '#ff8844',
        'DEEP_SPACE': '#ff44ff',
      };
      zoneEl.style.color = zoneColors[state.zone.name] || '#00ff88';
    }

    set('t-fuel',   `${state.fuelRemaining.toFixed(1)} kg (${state.fuelPercent.toFixed(1)}%)`);
    set('t-thrust', state.thrust > 0 ? `${(state.thrust / 1000).toFixed(1)} kN` : '0.0 kN');

    const engineEl = this.container.querySelector('#t-engine .readout-val');
    if (engineEl) {
      if (state.engineActive) {
        engineEl.textContent = '█ FIRING';
        engineEl.style.color = '#ff6600';
      } else {
        engineEl.textContent = '░ OFFLINE';
        engineEl.style.color = '#444444';
      }
    }

    const phaseEl = this.container.querySelector('#t-phase .phase-val');
    if (phaseEl) {
      const phaseColors = {
        IGNITION: '#ffff00',
        POWERED:  '#ff8800',
        COAST:    '#00ffff',
        FALLING:  '#ff4444',
        LANDED:   '#00ff88',
        CRASHED:  '#ff0000',
        ORBIT:    '#ff44ff',
      };
      phaseEl.textContent = state.phase;
      phaseEl.style.color = phaseColors[state.phase] || '#00ff88';
    }

    set('t-drift',  `${state.driftAngle.toFixed(1)}°`);
    set('t-maxalt', `${(state.maxAltitude / 1000).toFixed(3)} km`);
    set('t-mass',   `${(state.totalMass / 1000).toFixed(3)} t`);
  }

  updateFuelBar(state) {
    const el = this.container.querySelector('#t-fuel-bar .fuel-bar');
    if (!el) return;
    const pct = state.fuelPercent / 100;
    const filled = Math.round(pct * 20);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const color = pct > 0.5 ? '#00ff88' : pct > 0.2 ? '#ffff00' : '#ff4444';
    el.textContent = `[${bar}] ${state.fuelPercent.toFixed(0)}%`;
    el.style.color = color;
  }

  updateDriftBar(state) {
    const el = this.container.querySelector('#t-drift-bar .drift-bar');
    if (!el) return;
    const drift = Math.max(-90, Math.min(90, state.driftAngle));
    const pos = Math.round((drift + 90) / 180 * 20);
    let bar = Array(21).fill('─');
    bar[10] = '┼'; // center
    bar[Math.max(0, Math.min(20, pos))] = '●';
    const color = Math.abs(drift) < 5 ? '#00ff88' : Math.abs(drift) < 20 ? '#ffff00' : '#ff4444';
    el.textContent = `[${bar.join('')}]`;
    el.style.color = color;
  }

  updatePhaseEvents(state) {
    if (state.phase !== this.lastPhase) {
      const msgs = {
        IGNITION: '>>> IGNITION SEQUENCE INITIATED',
        POWERED:  '>>> ENGINE NOMINAL - ASCENT PHASE',
        COAST:    '>>> MECO - COASTING PHASE',
        FALLING:  '>>> APOGEE REACHED - FREE FALL',
        LANDED:   '>>> MISSION COMPLETE - SOFT LANDING',
        CRASHED:  '>>> VEHICLE LOST - IMPACT DETECTED',
        ORBIT:    '>>> ORBITAL INSERTION CONFIRMED <<<',
      };
      if (msgs[state.phase]) {
        this.log(msgs[state.phase], state.phase === 'CRASHED' ? 'err' : 'event');
      }
      this.lastPhase = state.phase;
    }

    // zone entry events
    if (this.tickCount % 5 === 0) {
      // log altitude milestones
    }

    // log every ~10 seconds
    if (this.tickCount % 60 === 0 && state.phase !== 'LANDED' && state.phase !== 'CRASHED') {
      this.log(`ALT: ${(state.altitudeKm).toFixed(2)}km VEL: ${state.velocity.toFixed(0)}m/s`);
    }
  }

  log(msg, type) {
    const el = this.container.querySelector('#t-log');
    if (!el) return;
    this.logLines.push({ msg, type: type || 'normal' });
    if (this.logLines.length > this.maxLogLines) this.logLines.shift();
    el.innerHTML = this.logLines.map((l, i) => {
      const opacity = 0.4 + (i / this.logLines.length) * 0.6;
      const color = l.type === 'err' ? '#ff4444' : l.type === 'event' ? '#ffff44' : '#00cc66';
      return `<div class="log-line" style="color:${color};opacity:${opacity}">› ${l.msg}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  updateGraph(state) {
    const ctx = this.graphCtx;
    const canvas = this.graphCanvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = '#000a00';
    ctx.fillRect(0, 0, w, h);

    // grid lines
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = h * i / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = w * i / 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const history = state.altitudeHistory;
    if (history.length < 2) {
      // label
      ctx.fillStyle = '#004400';
      ctx.font = '11px monospace';
      ctx.fillText('AWAITING DATA...', 10, h/2);
      return;
    }

    const maxAlt = Math.max(...history, 1);
    const points = history.map((alt, i) => ({
      x: (i / (history.length - 1)) * (w - 20) + 10,
      y: h - 10 - (alt / maxAlt) * (h - 20),
    }));

    // glow effect
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 6;

    // fill area under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 136, 0.07)';
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // current point dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // labels
    ctx.fillStyle = '#005500';
    ctx.font = '9px monospace';
    ctx.fillText(`${maxAlt.toFixed(1)} km`, 2, 12);
    ctx.fillText('0 km', 2, h - 2);
    ctx.fillStyle = '#007700';
    ctx.fillText(`T ${state.timeHistory[0] || 0}s`, 10, h - 2);
    ctx.fillText(`T ${Math.round(state.time)}s`, w - 40, h - 2);
  }

  updateRocketView(state, rocketParts) {
    const ctx = this.rocketCtx;
    const canvas = this.rocketCanvas;
    if (!ctx || !canvas || !rocketParts) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#000a00';
    ctx.fillRect(0, 0, w, h);

    // stars
    if (state.altitudeKm > 20) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, (state.altitudeKm - 20) / 80)})`;
      for (let i = 0; i < 30; i++) {
        const sx = (i * 37 + 11) % w;
        const sy = (i * 71 + 13) % (h * 0.7);
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    ctx.save();

    // center of canvas
    const cx = w / 2;
    const cy = h / 2;

    // apply drift angle
    const driftRad = state.driftAngle * Math.PI / 180;
    ctx.translate(cx, cy);
    ctx.rotate(driftRad);

    // draw rocket parts as blocks
    const partH = 22;
    const partW = 44;
    const totalH = rocketParts.length * partH;
    let startY = -totalH / 2;

    // flame effect (if engine on)
    if (state.engineActive && state.thrust > 0) {
      const flameY = startY + totalH + 4;
      const gradient = ctx.createLinearGradient(0, flameY, 0, flameY + 40);
      gradient.addColorStop(0, 'rgba(255, 150, 0, 0.9)');
      gradient.addColorStop(0.4, 'rgba(255, 80, 0, 0.7)');
      gradient.addColorStop(0.8, 'rgba(255, 0, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

      const flicker = 1 + (Math.random() - 0.5) * 0.3;
      ctx.beginPath();
      ctx.moveTo(-partW/3, flameY);
      ctx.lineTo(0, flameY + 45 * flicker);
      ctx.lineTo(partW/3, flameY);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // inner blue core
      const innerGrad = ctx.createLinearGradient(0, flameY, 0, flameY + 20);
      innerGrad.addColorStop(0, 'rgba(150, 200, 255, 0.8)');
      innerGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(-partW/6, flameY);
      ctx.lineTo(0, flameY + 22 * flicker);
      ctx.lineTo(partW/6, flameY);
      ctx.closePath();
      ctx.fillStyle = innerGrad;
      ctx.fill();
    }

    rocketParts.forEach((part, i) => {
      const py = startY + i * partH;

      // part body
      const typeColors = {
        nose:    { fill: '#1a1a2e', stroke: '#8888cc' },
        command: { fill: '#1a2a1a', stroke: '#88cc88' },
        tank:    { fill: '#0a1a2e', stroke: '#4488ff' },
        engine:  { fill: '#2a1a0a', stroke: '#ff8844' },
        fins:    { fill: '#0a2a0a', stroke: '#44ff88' },
      };
      const colors = typeColors[part.type] || { fill: '#111', stroke: '#555' };

      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1;

      if (part.type === 'nose') {
        // triangle
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(-partW/2, py + partH);
        ctx.lineTo(partW/2, py + partH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (part.type === 'fins') {
        // fins extend out
        ctx.fillRect(-partW/2, py, partW, partH);
        ctx.strokeRect(-partW/2, py, partW, partH);
        ctx.fillStyle = colors.stroke;
        // left fin
        ctx.beginPath();
        ctx.moveTo(-partW/2, py);
        ctx.lineTo(-partW/2 - 12, py + partH);
        ctx.lineTo(-partW/2, py + partH);
        ctx.closePath();
        ctx.fill();
        // right fin
        ctx.beginPath();
        ctx.moveTo(partW/2, py);
        ctx.lineTo(partW/2 + 12, py + partH);
        ctx.lineTo(partW/2, py + partH);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-partW/2, py, partW, partH);
        ctx.strokeRect(-partW/2, py, partW, partH);
      }

      // part symbol
      ctx.fillStyle = colors.stroke;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(part.symbol || part.name[0], 0, py + partH - 6);
    });

    ctx.restore();

    // altitude indicator bar on right side
    const maxDispAlt = Math.max(400000, state.altitude * 1.2);
    const pct = Math.min(1, state.altitude / maxDispAlt);
    const barH = h - 20;
    const barX = w - 18;

    ctx.fillStyle = '#001100';
    ctx.fillRect(barX, 10, 8, barH);

    const fillH = pct * barH;
    const altGrad = ctx.createLinearGradient(0, 10 + barH - fillH, 0, 10 + barH);
    altGrad.addColorStop(0, '#00ffff');
    altGrad.addColorStop(0.5, '#00ff88');
    altGrad.addColorStop(1, '#004400');
    ctx.fillStyle = altGrad;
    ctx.fillRect(barX, 10 + barH - fillH, 8, fillH);

    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 10, 8, barH);

    // zone markers on bar
    const zoneMarkers = [
      { alt: 12000,  label: '12k' },
      { alt: 50000,  label: '50k' },
      { alt: 100000, label: '100k' },
      { alt: 400000, label: '400k' },
    ];

    ctx.font = '7px monospace';
    ctx.fillStyle = '#003300';
    for (const zm of zoneMarkers) {
      const y = 10 + barH - (zm.alt / maxDispAlt) * barH;
      if (y > 10 && y < 10 + barH) {
        ctx.fillRect(barX - 3, y, 14, 1);
        ctx.fillStyle = '#004400';
        ctx.fillText(zm.label, barX - 22, y + 3);
        ctx.fillStyle = '#003300';
      }
    }
  }

  drawEmptyGraph() {
    const ctx = this.graphCtx;
    if (!ctx) return;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;
    ctx.fillStyle = '#000a00';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#002200';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = h * i / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = w * i / 8;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.fillStyle = '#003300';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('-- AWAITING LAUNCH --', w/2, h/2);
  }

  drawRocketIdle() {
    const ctx = this.rocketCtx;
    if (!ctx) return;
    const w = this.rocketCanvas.width;
    const h = this.rocketCanvas.height;
    ctx.fillStyle = '#000a00';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#002200';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('-- VEHICLE NOT LOADED --', w/2, h/2);
  }

  showResult(state) {
    const el = this.container.querySelector('#t-statusleft');
    if (!el) return;
    if (state.inOrbit) {
      el.textContent = '*** ORBITAL INSERTION COMPLETE - MISSION SUCCESS ***';
      el.style.color = '#ff44ff';
    } else if (state.crashed) {
      el.textContent = '*** VEHICLE LOST - MISSION FAILURE ***';
      el.style.color = '#ff4444';
    } else {
      el.textContent = `*** MISSION ENDED - MAX ALT: ${(state.maxAltitude / 1000).toFixed(2)} km ***`;
      el.style.color = '#ffff44';
    }
    this.log(`MISSION ENDED | MAX ALT: ${(state.maxAltitude / 1000).toFixed(2)} km`, 'event');
  }

  updateStatusBar(state) {
    const el = this.container.querySelector('#t-statusleft');
    if (!el) return;
    if (state.phase === 'POWERED') {
      el.textContent = 'NOMINAL ASCENT';
      el.style.color = '#00ff88';
    } else if (state.phase === 'COAST') {
      el.textContent = 'ENGINE CUTOFF - COASTING';
      el.style.color = '#00ffff';
    } else if (state.phase === 'FALLING') {
      el.textContent = 'FREE FALL - IMPACT INCOMING';
      el.style.color = '#ff8844';
    }

    const rightEl = this.container.querySelector('#t-statusright');
    if (rightEl) {
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      rightEl.textContent = blink ? 'TELEMETRY LINK: ██ NOMINAL' : 'TELEMETRY LINK: ░░ NOMINAL';
    }
  }
}
