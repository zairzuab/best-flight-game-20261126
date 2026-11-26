// MERPATI-7, the player's aircraft: a low-poly single-prop plane built from
// Three.js primitives — fuselage, wings, tail, a spinning propeller, cockpit
// glass, landing gear and navigation lights. No model files, no textures.
import * as THREE from 'three';

const WHITE = 0xf2f0ea;
const RED = 0xc23b2e;
const GLASS = 0x1d3a4a;

/**
 * Build the plane. The group faces -Z (its nose points to -Z) so the flight
 * model's forward vector and the mesh agree; render.js turns the group by the
 * plane's heading, pitch and roll each frame.
 */
export function createAircraft() {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: WHITE });
  const red = new THREE.MeshLambertMaterial({ color: RED });
  const glass = new THREE.MeshPhongMaterial({ color: GLASS, shininess: 120, specular: 0x88bbdd });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });

  // Fuselage: a tapered cylinder lying along Z, nose at -Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 10), white);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  group.add(fuselage);
  // Red cheatline stripe down the fuselage.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.57, 2.2, 10), red);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.6;
  group.add(stripe);
  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 10), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.6;
  group.add(nose);
  // Cockpit glass: a flattened dome on top of the nose.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), glass);
  canopy.scale.set(0.85, 0.62, 1.5);
  canopy.position.set(0, 0.62, -1.2);
  group.add(canopy);
  // Main wings, low-mounted, with red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.16, 1.9), white);
  wing.position.set(0, -0.15, -0.3);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.9), red);
    tip.position.set(side * 5.1, -0.15, -0.3);
    group.add(tip);
  }
  // Tail: horizontal stabiliser and a red vertical fin.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.1), white);
  stabiliser.position.set(0, 0.1, 3.4);
  group.add(stabiliser);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.3), red);
  fin.position.set(0, 0.85, 3.4);
  group.add(fin);
  // Tail cone.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 8), white);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 3.9;
  group.add(tail);

  // Propeller: a hub, two blades and a spinner, spinning around Z.
  const propeller = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.08), dark);
    blade.position.set(0, 0, 0);
    blade.rotation.z = angle;
    propeller.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), red);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.45;
  propeller.add(spinner);
  propeller.position.z = -4.5;
  group.add(propeller);

  // Landing gear: two mains and a nose wheel, retractable as one group.
  const gear = new THREE.Group();
  const strutMat = new THREE.MeshLambertMaterial({ color: 0x555a60 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181a1c });
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), strutMat);
    strut.position.set(side * 1.1, -0.9, -0.6);
    gear.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.45, -0.6);
    gear.add(wheel);
  }
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), strutMat);
  noseStrut.position.set(0, -0.85, -2.9);
  gear.add(noseStrut);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), wheelMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.35, -2.9);
  gear.add(noseWheel);
  group.add(gear);

  // Navigation lights: red port, green starboard, white tail.
  const lights = new THREE.Group();
  const portLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  portLight.position.set(-5.5, -0.15, -0.3);
  lights.add(portLight);
  const starboardLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  starboardLight.position.set(5.5, -0.15, -0.3);
  lights.add(starboardLight);
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 0.15, 4.5);
  lights.add(tailLight);
  group.add(lights);

  return {
    group,
    propeller,
    gear,
    setGearDown(down) {
      gear.visible = down;
    },
  };
}
