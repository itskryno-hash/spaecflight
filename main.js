// main.js - ties everything together

let builder = null;
let terminal = null;
let physics = null;
let gameLoop = null;
let rocketStack = [];
let missionActive = false;

const SIM_SPEED = 1; // real-time multiplier
const FPS = 60;
const DT = 1 / FPS;
const SIM_STEPS = 6; // physics steps per frame

function init() {
  // setup builder
  const partsListEl = document.getElementById('parts-palette');
  const statsEl     = document.getElementById('rocket-stats');
  const warningsEl  = document.getElementById('rocket-warnings');

  builder = new RocketBuilder(null, partsListEl, statsEl, warningsEl);
  window.builder = builder; // expose for onclick handlers

  builder.onStackChange = (stack) => {
    rocketStack = stack;
    updateLaunchBtn();
  };

  // setup terminal container
  const terminalEl = document.getElementById('terminal-container');
  terminal = new MissionTerminal(terminalEl);

  // load a default preset so something is there
  builder.loadPreset('minimal');

  // button handlers
  document.getElementById('btn-launch').addEventListener('click', onLaunch);
  document.getElementById('btn-reset').addEventListener('click', onReset);
  document.getElementById('btn-clear').addEventListener('click', () => {
    builder.clearStack();
  });
  document.getElementById('btn-preset-minimal').addEventListener('click', () => builder.loadPreset('minimal'));
  document.getElementById('btn-preset-heavy').addEventListener('click', () => builder.loadPreset('heavy'));
  document.getElementById('btn-preset-unstable').addEventListener('click', () => builder.loadPreset('unstable'));
  document.getElementById('btn-preset-tiny').addEventListener('click', () => builder.loadPreset('tiny'));

  updateLaunchBtn();

  // scanline animation
  animateScanline();
}

function updateLaunchBtn() {
  const btn = document.getElementById('btn-launch');
  if (!btn) return;
  const hasEngine = rocketStack.some(p => p.type === 'engine');
  const hasFuel = rocketStack.some(p => p.type === 'tank' && p.fuelCapacity > 0);
  const hasCommand = rocketStack.some(p => p.type === 'command');
  const ready = hasEngine && hasFuel && hasCommand && rocketStack.length > 0;
  btn.disabled = !ready || missionActive;
  btn.textContent = missionActive ? '⚡ MISSION ACTIVE' : ready ? '🚀 LAUNCH' : '⚠ INCOMPLETE';
}

function onLaunch() {
  if (missionActive) return;
  if (rocketStack.length === 0) return;

  const stats = computeRocketStats(rocketStack);

  if (!stats.isLaunchable && stats.twr < 0.5) {
    showAlert('TWR TOO LOW - ROCKET CANNOT LIFT OFF');
    return;
  }

  // switch to flight view
  document.getElementById('view-builder').classList.add('hidden');
  document.getElementById('view-flight').classList.remove('hidden');

  // rebuild terminal with fresh state
  const terminalEl = document.getElementById('terminal-container');
  terminal = new MissionTerminal(terminalEl);
  terminal.log('LAUNCH SEQUENCE STARTED');
  terminal.log(`VEHICLE: ${rocketStack.length} PARTS | TWR: ${stats.twr.toFixed(2)}`);
  terminal.log(`FUEL LOAD: ${stats.totalFuel.toFixed(0)} kg`);
  if (!stats.hasStability) {
    terminal.log('WARNING: NO FINS - EXPECT DRIFT', 'err');
  }

  // init physics
  physics = new PhysicsEngine(stats);
  missionActive = true;

  // countdown
  let count = 3;
  const countdown = setInterval(() => {
    terminal.log(`T-MINUS ${count}...`, 'event');
    count--;
    if (count < 0) {
      clearInterval(countdown);
      terminal.log('IGNITION - MAIN ENGINE START', 'event');
      startGameLoop();
    }
  }, 400);
}

function startGameLoop() {
  let lastTime = performance.now();

  gameLoop = setInterval(() => {
    if (!physics || !missionActive) return;

    // multiple physics steps per frame for accuracy
    for (let i = 0; i < SIM_STEPS; i++) {
      physics.step(DT);
    }

    const state = physics.getState();
    terminal.update(state, rocketStack);

    // check mission end
    if (state.phase === 'LANDED' || state.phase === 'CRASHED' || state.inOrbit) {
      endMission(state);
    }
  }, 1000 / FPS);
}

function endMission(state) {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  missionActive = false;
  terminal.showResult(state);

  // show return button
  document.getElementById('btn-reset').style.display = 'block';
}

function onReset() {
  missionActive = false;
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  physics = null;

  document.getElementById('view-flight').classList.add('hidden');
  document.getElementById('view-builder').classList.remove('hidden');

  // reset terminal
  const terminalEl = document.getElementById('terminal-container');
  terminal = new MissionTerminal(terminalEl);

  document.getElementById('btn-reset').style.display = 'none';
  updateLaunchBtn();
}

function showAlert(msg) {
  const el = document.getElementById('launch-alert');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function animateScanline() {
  const scanline = document.querySelector('.scanline');
  if (!scanline) return;
  // CSS handles the animation, this just ensures it keeps running
}

// init when DOM ready
document.addEventListener('DOMContentLoaded', init);
