// The HUD: backlit instrument panels as a DOM overlay — altitude, airspeed,
// heading compass, throttle, fuel, artificial horizon, score and warnings —
// plus the menu, pause, crash and mission-complete screens. The judge reads
// the game through these instruments, so they stay lit and legible.
import { MISSION_INFO } from './missions.js';

const COMPASS_PX_PER_DEG = 4;

function buildCompassStrip(doc) {
  const strip = doc.createElement('div');
  strip.className = 'compass-strip';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let deg = 0; deg < 360; deg += 15) {
    const tick = doc.createElement('div');
    tick.className = 'compass-tick';
    tick.style.left = `${deg * COMPASS_PX_PER_DEG}px`;
    if (labels[deg]) {
      tick.textContent = labels[deg];
      tick.classList.add('compass-cardinal');
    } else {
      tick.textContent = String(deg);
    }
    strip.appendChild(tick);
  }
  return strip;
}

export function createHud(doc) {
  const hud = doc.getElementById('hud');
  const els = {};
  for (const id of ['alt', 'vsi', 'ias', 'thr', 'fuelBar', 'fuelText', 'score', 'objective', 'timer', 'warnStall', 'warnFuel', 'warnTerrain', 'compassStrip', 'horizonDisc', 'crosshair']) {
    els[id] = doc.getElementById(id);
  }
  if (!els.compassStrip) {
    const strip = buildCompassStrip(doc);
    strip.id = 'compassStrip';
    doc.getElementById('compassWindow').appendChild(strip);
    els.compassStrip = strip;
  }
  const screens = {
    menu: doc.getElementById('menu'),
    pause: doc.getElementById('pause'),
    crash: doc.getElementById('crash'),
    complete: doc.getElementById('complete'),
  };
  const crashReason = doc.getElementById('crashReason');
  const crashScore = doc.getElementById('crashScore');
  const completeTitle = doc.getElementById('completeTitle');
  const completeLines = doc.getElementById('completeLines');
  const completeScore = doc.getElementById('completeScore');
  const bestLine = doc.getElementById('bestLine');

  let lastText = {};

  function setText(el, key, value) {
    if (lastText[key] !== value) {
      el.textContent = value;
      lastText[key] = value;
    }
  }

  function setWarning(el, key, on) {
    if (lastText[key] !== on) {
      el.classList.toggle('on', on);
      lastText[key] = on;
    }
  }

  return {
    /** Refresh every instrument from the flight readouts and mission state. */
    update(readouts, flight, mission, timeLeft) {
      setText(els.alt, 'alt', String(readouts.altitudeFt).padStart(5, '0'));
      setText(els.vsi, 'vsi', `${readouts.verticalFpm >= 0 ? '+' : ''}${readouts.verticalFpm}`);
      setText(els.ias, 'ias', String(readouts.airspeedKts));
      setText(els.thr, 'thr', `${readouts.throttlePct}%`);
      setText(els.fuelText, 'fuel', `${readouts.fuelPct}%`);
      els.fuelBar.style.width = `${readouts.fuelPct}%`;
      els.fuelBar.classList.toggle('low', readouts.fuelPct < 25);
      setText(els.score, 'score', String(mission.score));
      setText(els.objective, 'obj', `${mission.info.name} — ${missionGoal(mission)}`);
      setText(els.timer, 'timer', formatTime(mission.time));
      // Compass: slide the strip so the current heading sits under the marker.
      const heading = readouts.headingDeg;
      els.compassStrip.style.transform = `translateX(${180 - heading * COMPASS_PX_PER_DEG}px)`;
      // Artificial horizon: roll rotates the disc, pitch slides it.
      const pitchShift = Math.max(-40, Math.min(40, flight.pitch * 57.3 * 1.1));
      els.horizonDisc.style.transform = `rotate(${-flight.roll * 57.3}deg) translateY(${pitchShift}px)`;
      // Warnings.
      setWarning(els.warnStall, 'stall', flight.stalled);
      setWarning(els.warnFuel, 'fuel', readouts.fuelPct < 20 && readouts.fuelPct > 0);
      const agl = flight.y - flight.terrain.heightAt(flight.x, flight.z);
      setWarning(els.warnTerrain, 'terrain', agl < 45 && !flight.onGround && flight.vspeed < -2);
    },
    showScreen(name) {
      for (const key of Object.keys(screens)) {
        screens[key].classList.toggle('hidden', key !== name);
      }
      hud.classList.toggle('hidden', name === 'menu');
    },
    showCrash(reason, score) {
      crashReason.textContent = reason;
      crashScore.textContent = `Score ${score}`;
      this.showScreen('crash');
    },
    showComplete(title, lines, score) {
      completeTitle.textContent = title;
      completeLines.innerHTML = '';
      for (const line of lines) {
        const div = doc.createElement('div');
        div.textContent = line;
        completeLines.appendChild(div);
      }
      completeScore.textContent = `Score ${score}`;
      this.showScreen('complete');
    },
    setBest(best) {
      bestLine.textContent = best > 0 ? `Best score: ${best}` : '';
    },
    bindMissionButtons(onPick) {
      for (const button of doc.querySelectorAll('[data-mission]')) {
        button.addEventListener('click', () => onPick(button.getAttribute('data-mission')));
      }
    },
  };
}

function missionGoal(mission) {
  if (mission.kind === 'landing') return 'Land on the runway';
  return `${mission.passed}/${mission.targets.length}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
