// World-space GPS (GTA-style): pulsing chevrons painted along the next ~90 m of the A* route, and a tall light beam + ground ring
// at the destination. One thin-instanced chevron mesh + two small meshes; nothing is created per frame.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';

export function createGps3D(scene) {
  const chM = new StandardMaterial('gpsChev', scene); chM.disableLighting = true; chM.emissiveColor = new Color3(1, 0.16, 0.24); chM.alpha = 0.85; chM.backFaceCulling = false;
  const vd = new VertexData(); // flat chevron pointing +z, 1.1 m wide
  vd.positions = [-0.55, 0, -0.25, -0.41, 0, -0.39, 0, 0, 0.1, 0.41, 0, -0.39, 0.55, 0, -0.25, 0, 0, 0.3];
  vd.indices = [0, 2, 1, 2, 4, 3, 0, 5, 2, 2, 5, 4]; vd.normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const ch = new Mesh('gpsChevrons', scene); vd.applyToMesh(ch); ch.material = chM; ch.isPickable = false; ch.alwaysSelectAsActiveMesh = true; ch.setEnabled(false);
  const bM = new StandardMaterial('gpsBeam', scene); bM.disableLighting = true; bM.emissiveColor = new Color3(1, 0.17, 0.25); bM.alpha = 0.32; bM.backFaceCulling = false;
  const beam = CreateCylinder('gpsBeam', { height: 70, diameterTop: 0.5, diameterBottom: 1.4, tessellation: 12, cap: 0 }, scene); beam.material = bM; beam.isPickable = false; beam.setEnabled(false);
  const ring = CreateTorus('gpsRing', { diameter: 4, thickness: 0.18, tessellation: 32 }, scene); ring.material = chM; ring.isPickable = false; ring.parent = beam; ring.position.y = -34.9;
  let last = null; const buf = new Float32Array(16 * 40); const M = new Matrix(), q = new Quaternion(), s1 = new Vector3(1.9, 1, 1.9), tp = new Vector3();
  const layout = (route, px, pz) => { // walk the polyline from the segment nearest the player, one chevron every 3.5 m
    let best = 0, bd = 1e9; for (let i = 0; i < route.length - 1; i++) { const a = route[i], b = route[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2)), d = Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz); if (d < bd) { bd = d; best = i; } }
    let n = 0, carry = 2.5, run = 0;
    for (let i = best; i < route.length - 1 && n < 40 && run < 95; i++) { const a = route[i], b = route[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.01) continue;
      const h = Math.atan2(dx, dz); Quaternion.FromEulerAnglesToRef(0, h, 0, q);
      for (let s = carry; s < L && n < 40; s += 3.2) { const x = a[0] + dx * s / L, z = a[1] + dz * s / L; if (i === best && ((x - px) * dx + (z - pz) * dz) < 0) continue;
        tp.set(x, 0.07, z); Matrix.ComposeToRef(s1, q, tp, M); M.copyToArray(buf, n * 16); n++; }
      carry = ((carry - L) % 3.2 + 3.2) % 3.2; run += L; }
    ch.thinInstanceSetBuffer('matrix', buf.subarray(0, n * 16), 16, false); ch.setEnabled(n > 0); };
  let lx = 1e9, lz = 1e9;
  return {
    update(route, dest, P, t, inside) {
      const on = !!(dest && !inside); beam.setEnabled(on); if (!on) { ch.setEnabled(false); last = null; return; }
      beam.position.set(dest.x, 35, dest.z); bM.alpha = 0.24 + 0.1 * Math.sin(t * 3); ring.scaling.setAll(1 + 0.12 * Math.sin(t * 4));
      chM.alpha = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 5));
      if (route && route.length > 1 && (route !== last || Math.hypot(P.x - lx, P.z - lz) > 2.5)) { last = route; lx = P.x; lz = P.z; layout(route, P.x, P.z); }
      if (!route || route.length < 2) ch.setEnabled(false);
    },
  };
}
