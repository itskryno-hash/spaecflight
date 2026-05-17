// physics.js - all physics calculations

class PhysicsEngine {
  constructor(rocketConfig) {
    this.config = rocketConfig;

    // state
    this.altitude = 0;         // meters
    this.velocity = 0;         // m/s (positive = up)
    this.acceleration = 0;     // m/s^2
    this.fuelRemaining = rocketConfig.totalFuel;
    this.totalMass = rocketConfig.dryMass + rocketConfig.totalFuel;
    this.time = 0;             // seconds
    this.isRunning = false;
    this.engineActive = true;
    this.maxAltitude = 0;
    this.driftAngle = 0;       // degrees from vertical
    this.driftRate = 0;        // degrees/second
    this.crashed = false;
    this.inOrbit = false;
    this.phase = 'IGNITION';   // IGNITION, POWERED, COAST, FALLING, LANDED, CRASHED

    // history for graph
    this.altitudeHistory = [];
    this.velocityHistory = [];
    this.timeHistory = [];
    this.historyInterval = 0;
    this.historyStep = 2; // log every N seconds

    // stability
    this.hasStability = rocketConfig.hasStability;
    this.stabilityRating = rocketConfig.stabilityRating;

    // precompute rocket cross section area (approx based on stack size)
    this.crossSectionArea = 1.5 + rocketConfig.partCount * 0.1; // m^2

    // max drag coeff
    this.rocketDragCoeff = rocketConfig.dragCoeff;
  }

  // compute thrust available at this moment
  getThrust() {
    if (!this.engineActive || this.fuelRemaining <= 0) return 0;
    return this.config.totalThrust;
  }

  // compute drag force
  getDrag() {
    const rho = getAtmosphericDensity(this.altitude);
    const v = this.velocity;
    const absV = Math.abs(v);
    // F_drag = 0.5 * rho * v^2 * Cd * A
    const drag = 0.5 * rho * absV * absV * this.rocketDragCoeff * this.crossSectionArea;
    // drag always opposes motion
    return v >= 0 ? -drag : drag;
  }

  // compute gravity
  getGravity() {
    // simple inverse square, but negligible change at LEO scale
    const earthRadius = 6371000; // m
    const r = earthRadius + this.altitude;
    return -G * (earthRadius / r) * (earthRadius / r);
  }

  // burn fuel
  burnFuel(dt) {
    if (this.fuelRemaining <= 0) {
      this.fuelRemaining = 0;
      this.engineActive = false;
      return;
    }
    const burned = this.config.fuelBurnRate * dt;
    this.fuelRemaining = Math.max(0, this.fuelRemaining - burned);
    this.totalMass = this.config.dryMass + this.fuelRemaining;
  }

  // drift simulation - gets worse without fins, worse with top-heavy config
  updateDrift(dt) {
    if (this.altitude <= 0) {
      this.driftAngle = 0;
      this.driftRate = 0;
      return;
    }

    if (this.hasStability) {
      // small random jitter, quickly corrected
      const jitter = (Math.random() - 0.5) * 0.01;
      this.driftRate += jitter;
      this.driftRate *= 0.95; // dampen
    } else {
      // no fins = bad day
      // drift accumulates with altitude and instability
      const instabilityFactor = (1 - this.stabilityRating);
      const atmosphericForcing = getAtmosphericDensity(this.altitude) * Math.abs(this.velocity) * 0.00001;
      const jitter = (Math.random() - 0.5) * 0.5 * instabilityFactor;
      this.driftRate += jitter + atmosphericForcing * (Math.random() - 0.5);

      // drift rate grows over time without stabilization
      this.driftRate = Math.max(-5, Math.min(5, this.driftRate));
    }

    this.driftAngle += this.driftRate * dt;
    this.driftAngle = Math.max(-90, Math.min(90, this.driftAngle));
  }

  // main physics step
  step(dt) {
    if (this.crashed || this.inOrbit) return;

    this.time += dt;

    // burn fuel if engine active
    if (this.engineActive && this.fuelRemaining > 0) {
      this.burnFuel(dt);
    }

    const thrust = this.getThrust();
    const gravity = this.getGravity();
    const drag = this.getDrag();

    // effective thrust reduced by drift angle
    const driftRad = Math.abs(this.driftAngle) * Math.PI / 180;
    const thrustEfficiency = Math.cos(driftRad);
    const effectiveThrust = thrust * thrustEfficiency;

    // F = ma
    const netForce = effectiveThrust + (gravity * this.totalMass) + drag;
    this.acceleration = netForce / this.totalMass;

    // integrate
    this.velocity += this.acceleration * dt;
    this.altitude += this.velocity * dt;

    // update phase
    if (this.altitude <= 0 && this.velocity < 0) {
      this.altitude = 0;
      this.velocity = 0;
      this.acceleration = 0;
      if (Math.abs(this.velocity) > 10) {
        this.crashed = true;
        this.phase = 'CRASHED';
      } else {
        this.phase = 'LANDED';
      }
      this.isRunning = false;
      return;
    }

    if (thrust > 0) {
      this.phase = 'POWERED';
    } else if (this.velocity > 0) {
      this.phase = 'COAST';
    } else {
      this.phase = 'FALLING';
    }

    // check orbit (simplified - sustain altitude > 100km with velocity)
    if (this.altitude >= 100000 && this.velocity > 7800) {
      this.inOrbit = true;
      this.phase = 'ORBIT';
    }

    this.maxAltitude = Math.max(this.maxAltitude, this.altitude);

    // update drift
    this.updateDrift(dt);

    // log history
    this.historyInterval += dt;
    if (this.historyInterval >= this.historyStep) {
      this.altitudeHistory.push(this.altitude / 1000); // km
      this.velocityHistory.push(this.velocity);
      this.timeHistory.push(Math.round(this.time));
      this.historyInterval = 0;
      if (this.altitudeHistory.length > 80) {
        this.altitudeHistory.shift();
        this.velocityHistory.shift();
        this.timeHistory.shift();
      }
    }
  }

  getState() {
    return {
      altitude: this.altitude,
      altitudeKm: this.altitude / 1000,
      velocity: this.velocity,
      acceleration: this.acceleration,
      fuelRemaining: this.fuelRemaining,
      fuelPercent: this.fuelRemaining / this.config.totalFuel * 100,
      totalMass: this.totalMass,
      thrust: this.getThrust(),
      engineActive: this.engineActive,
      time: this.time,
      phase: this.phase,
      driftAngle: this.driftAngle,
      zone: getZone(this.altitude),
      maxAltitude: this.maxAltitude,
      crashed: this.crashed,
      inOrbit: this.inOrbit,
      altitudeHistory: this.altitudeHistory,
      velocityHistory: this.velocityHistory,
      timeHistory: this.timeHistory,
    };
  }
}

// validate rocket config and compute derived stats
function computeRocketStats(parts) {
  let dryMass = 0;
  let totalFuel = 0;
  let totalThrust = 0;
  let fuelBurnRate = 0;
  let totalDragCoeff = 0;
  let hasEngine = false;
  let hasCommand = false;
  let hasStability = false;
  let hasFuel = false;

  for (const part of parts) {
    dryMass += part.mass;
    totalFuel += part.fuelCapacity || 0;
    totalThrust += part.thrust || 0;
    fuelBurnRate += part.fuelBurnRate || 0;
    totalDragCoeff += part.dragCoeff || 0;
    if (part.type === 'engine') hasEngine = true;
    if (part.type === 'command') hasCommand = true;
    if (part.type === 'fins') hasStability = true;
    if (part.type === 'tank') hasFuel = true;
  }

  // nose cone reduces drag
  const hasNose = parts.some(p => p.type === 'nose');
  if (hasNose) totalDragCoeff *= 0.6;

  // average drag coeff
  const dragCoeff = totalDragCoeff / parts.length;

  // stability rating 0-1
  let stabilityRating = 0.3; // base
  if (hasStability) stabilityRating += 0.5;
  if (hasNose) stabilityRating += 0.1;
  // penalize top-heavy (command pod on top of many tanks)
  const topHalfMass = parts.slice(0, Math.floor(parts.length / 2)).reduce((s, p) => s + p.mass, 0);
  const bottomHalfMass = parts.slice(Math.floor(parts.length / 2)).reduce((s, p) => s + p.mass, 0);
  if (topHalfMass > bottomHalfMass * 1.5) stabilityRating -= 0.2;
  stabilityRating = Math.max(0, Math.min(1, stabilityRating));

  const warnings = [];
  if (!hasEngine) warnings.push('NO ENGINE DETECTED');
  if (!hasCommand) warnings.push('NO COMMAND MODULE');
  if (!hasFuel && hasEngine) warnings.push('NO FUEL - ENGINE USELESS');
  if (!hasStability) warnings.push('NO FINS - DRIFT RISK HIGH');
  if (totalThrust < (dryMass + totalFuel) * G * 1000 && hasEngine) {
    warnings.push('TWR < 1.0 - MAY NOT LAUNCH');
  }

  const twr = hasEngine ? totalThrust / ((dryMass * 1000 + totalFuel) * G) : 0;
  const deltaV = hasEngine && fuelBurnRate > 0
    ? 9.81 * 300 * Math.log((dryMass * 1000 + totalFuel) / (dryMass * 1000))
    : 0;

  return {
    dryMass: dryMass * 1000,       // convert to kg
    totalFuel,
    totalThrust,
    fuelBurnRate,
    dragCoeff,
    hasEngine,
    hasCommand,
    hasStability,
    stabilityRating,
    warnings,
    twr,
    deltaV,
    partCount: parts.length,
    isLaunchable: hasEngine && (twr > 1.0 || warnings.includes('TWR < 1.0 - MAY NOT LAUNCH')),
  };
}
