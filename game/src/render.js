// The renderer: a Three.js scene over the valley, a chase camera that follows
// the plane without fighting it, and a cockpit camera for the view from the
// seat. The sky is a gradient dome, the light is one warm afternoon sun.
import * as THREE from 'three';
import { PALETTE, CAMERA } from './config.js';
import { forwardVector } from './flight.js';

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#2f6fd0');
  gradient.addColorStop(0.55, '#7fb2e0');
  gradient.addColorStop(0.78, '#cfe8f5');
  gradient.addColorStop(1, '#f5e8c8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRenderer(canvas, terrain, aircraft) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 720, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 700, 3400);

  // Sky dome: a big sphere with the gradient on its inside.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3800, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // One warm afternoon sun plus a soft sky fill.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(900, 1200, 400);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x5d7a4a, 1.1);
  scene.add(hemi);

  scene.add(terrain.group);
  scene.add(aircraft.group);

  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.5, 8000);
  const chasePos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let firstFrame = true;

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    resize,
    /**
     * Paint one frame. `mode` is 'chase' or 'cockpit'; `look` is the mouse-drag
     * offset; `dt` is the frame time in seconds. The chase camera closes on
     * its slot at a fixed rate per second, so it follows the same at any
     * frame rate and never lags behind a fast plane.
     */
    draw(flight, mission, mode, look, time, dt) {
      // Move the plane mesh to the flight state. The mesh is built nose-first
      // toward -Z, so a heading h needs rotateY(-h) to point the nose along
      // forwardVector(h), and rotateX(+pitch) to raise the nose.
      aircraft.group.position.set(flight.x, flight.y, flight.z);
      aircraft.group.rotation.set(0, 0, 0);
      aircraft.group.rotateY(-flight.heading);
      aircraft.group.rotateX(flight.pitch);
      aircraft.group.rotateZ(flight.roll);
      aircraft.propeller.rotation.z += 0.55 + flight.throttle * 0.9;
      aircraft.setGearDown(flight.gearDown);
      // Clouds drift with time.
      for (const cloud of terrain.clouds) {
        cloud.position.x += cloud.userData.speed * 0.016;
        if (cloud.position.x > 1900) cloud.position.x = -1900;
      }

      const fwd = forwardVector(flight.heading, flight.pitch);
      if (mode === 'cockpit') {
        camera.position.set(
          flight.x + fwd.x * 1.2,
          flight.y + 1.0,
          flight.z + fwd.z * 1.2,
        );
        lookTarget.set(
          flight.x + fwd.x * 60 + look.x * 30,
          flight.y + fwd.y * 60 + 1 - look.y * 20,
          flight.z + fwd.z * 60,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(lookTarget);
        camera.rotateZ(flight.roll);
      } else {
        const wanted = new THREE.Vector3(
          flight.x - fwd.x * CAMERA.chaseDistance + look.x * 6,
          flight.y - fwd.y * CAMERA.chaseDistance + CAMERA.chaseHeight + look.y * 4,
          flight.z - fwd.z * CAMERA.chaseDistance,
        );
        if (firstFrame) {
          chasePos.copy(wanted);
          firstFrame = false;
        } else {
          chasePos.lerp(wanted, 1 - Math.exp(-8 * Math.max(dt, 0.001)));
        }
        camera.position.copy(chasePos);
        lookTarget.set(
          flight.x + fwd.x * CAMERA.lookAhead,
          flight.y + fwd.y * CAMERA.lookAhead + 0.5,
          flight.z + fwd.z * CAMERA.lookAhead,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(lookTarget);
      }
      renderer.render(scene, camera);
    },
  };
}
