// builder.js - rocket builder UI

class RocketBuilder {
  constructor(containerEl, partsListEl, statsEl, warningsEl) {
    this.container = containerEl; // unused, kept for compat
    this.partsListEl = partsListEl;
    this.statsEl = statsEl;
    this.warningsEl = warningsEl;
    this.stack = []; // top to bottom
    this.onStackChange = null;

    this.renderPartsList();
    this.renderStack();
  }

  renderPartsList() {
    this.partsListEl.innerHTML = '';
    for (const [id, part] of Object.entries(PARTS)) {
      const btn = document.createElement('button');
      btn.className = 'part-btn';
      btn.dataset.partId = id;

      btn.innerHTML = `
        <span class="part-symbol">${part.symbol}</span>
        <span class="part-info">
          <span class="part-name">${part.name}</span>
          <span class="part-stats">${this.formatPartStats(part)}</span>
        </span>
      `;

      btn.addEventListener('click', () => this.addPart(id));
      btn.title = part.description;
      this.partsListEl.appendChild(btn);
    }
  }

  formatPartStats(part) {
    const stats = [];
    stats.push(`${part.mass}t`);
    if (part.fuelCapacity > 0) stats.push(`${part.fuelCapacity}kg fuel`);
    if (part.thrust > 0) stats.push(`${(part.thrust / 1000).toFixed(0)}kN`);
    return stats.join(' | ');
  }

  addPart(partId) {
    const part = PARTS[partId];
    if (!part) return;

    // enforce position rules loosely (just warn, don't block)
    this.stack.push({ ...part });
    this.renderStack();
    this.updateStats();
    this.triggerChange();

    // flash effect
    this.flashStack();
  }

  removePart(index) {
    this.stack.splice(index, 1);
    this.renderStack();
    this.updateStats();
    this.triggerChange();
  }

  movePart(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= this.stack.length) return;
    const part = this.stack.splice(fromIndex, 1)[0];
    this.stack.splice(toIndex, 0, part);
    this.renderStack();
    this.updateStats();
    this.triggerChange();
  }

  clearStack() {
    this.stack = [];
    this.renderStack();
    this.updateStats();
    this.triggerChange();
  }

  renderStack() {
    const stackEl = document.getElementById('rocket-stack');
    if (!stackEl) return;
    stackEl.innerHTML = '';

    if (this.stack.length === 0) {
      stackEl.innerHTML = `<div class="stack-empty">
        <span class="blink">_</span> ADD PARTS TO BUILD YOUR ROCKET
      </div>`;
      return;
    }

    this.stack.forEach((part, index) => {
      const item = document.createElement('div');
      item.className = `stack-item stack-item--${part.type}`;
      item.dataset.index = index;

      item.innerHTML = `
        <div class="stack-item-inner">
          <span class="stack-index">${String(index + 1).padStart(2, '0')}</span>
          <div class="stack-ascii">${this.getPartVisual(part)}</div>
          <div class="stack-info">
            <span class="stack-name">${part.name}</span>
            <span class="stack-detail">${this.formatPartStats(part)}</span>
          </div>
          <div class="stack-controls">
            <button class="ctrl-btn" onclick="window.builder.movePart(${index}, ${index - 1})" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="ctrl-btn" onclick="window.builder.movePart(${index}, ${index + 1})" ${index === this.stack.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="ctrl-btn ctrl-btn--remove" onclick="window.builder.removePart(${index})">✕</button>
          </div>
        </div>
      `;

      stackEl.appendChild(item);
    });

    // rocket visual preview (side)
    this.renderRocketPreview();
  }

  getPartVisual(part) {
    return `<span style="color: ${part.color}">${part.symbol}</span>`;
  }

  renderRocketPreview() {
    const previewEl = document.getElementById('rocket-preview');
    if (!previewEl) return;

    const lines = [];
    // build from top to bottom
    for (const part of this.stack) {
      for (const line of part.ascii) {
        lines.push(`<span style="color:${part.color}">${line}</span>`);
      }
    }

    if (lines.length === 0) {
      previewEl.innerHTML = '<span class="dim">NO PARTS</span>';
    } else {
      previewEl.innerHTML = lines.join('\n');
    }
  }

  updateStats() {
    if (!this.statsEl || !this.warningsEl) return;

    if (this.stack.length === 0) {
      this.statsEl.innerHTML = `<span class="dim">-- NO ROCKET --</span>`;
      this.warningsEl.innerHTML = '';
      return;
    }

    const stats = computeRocketStats(this.stack);

    const fuelTime = stats.fuelBurnRate > 0
      ? (stats.totalFuel / stats.fuelBurnRate).toFixed(1)
      : '--';

    this.statsEl.innerHTML = `
<span class="stat-line"><span class="stat-label">DRY MASS    </span><span class="stat-val">${(stats.dryMass / 1000).toFixed(2)} t</span></span>
<span class="stat-line"><span class="stat-label">WET MASS    </span><span class="stat-val">${((stats.dryMass + stats.totalFuel) / 1000).toFixed(2)} t</span></span>
<span class="stat-line"><span class="stat-label">TOTAL FUEL  </span><span class="stat-val">${stats.totalFuel.toFixed(0)} kg</span></span>
<span class="stat-line"><span class="stat-label">MAX THRUST  </span><span class="stat-val">${(stats.totalThrust / 1000).toFixed(1)} kN</span></span>
<span class="stat-line"><span class="stat-label">TWR         </span><span class="stat-val ${stats.twr >= 1 ? 'green' : 'red'}">${stats.twr.toFixed(2)}</span></span>
<span class="stat-line"><span class="stat-label">BURN TIME   </span><span class="stat-val">${fuelTime} s</span></span>
<span class="stat-line"><span class="stat-label">DELTA-V     </span><span class="stat-val">${stats.deltaV.toFixed(0)} m/s</span></span>
<span class="stat-line"><span class="stat-label">STABILITY   </span><span class="stat-val ${stats.hasStability ? 'green' : 'red'}">${stats.hasStability ? 'FINS OK' : 'NO FINS'}</span></span>
<span class="stat-line"><span class="stat-label">PARTS       </span><span class="stat-val">${stats.partCount}</span></span>
    `;

    if (stats.warnings.length > 0) {
      this.warningsEl.innerHTML = stats.warnings.map(w =>
        `<div class="warning-line">⚠ ${w}</div>`
      ).join('');
    } else {
      this.warningsEl.innerHTML = `<div class="warning-ok">✓ ALL SYSTEMS GO</div>`;
    }
  }

  flashStack() {
    const stackEl = document.getElementById('rocket-stack');
    if (!stackEl) return;
    stackEl.classList.add('flash');
    setTimeout(() => stackEl.classList.remove('flash'), 150);
  }

  triggerChange() {
    if (this.onStackChange) {
      this.onStackChange(this.stack);
    }
  }

  getStack() {
    return this.stack;
  }

  // load a preset rocket config
  loadPreset(presetName) {
    const presets = {
      minimal: ['nose_cone', 'command_pod', 'fuel_tank_small', 'engine_weak', 'fins'],
      heavy: ['nose_cone', 'command_pod', 'fuel_tank_large', 'fuel_tank_large', 'engine_strong', 'fins'],
      unstable: ['command_pod', 'fuel_tank_large', 'fuel_tank_large', 'engine_weak'],
      tiny: ['command_pod', 'fuel_tank_small', 'engine_weak'],
    };

    const preset = presets[presetName];
    if (!preset) return;

    this.stack = preset.map(id => ({ ...PARTS[id] }));
    this.renderStack();
    this.updateStats();
    this.triggerChange();
  }
}
