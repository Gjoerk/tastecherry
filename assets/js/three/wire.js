// Fine-line wireframe builder for the hero models (same look as cherry.js):
// contour lines are collected as segments, solid "occluder" bodies that only
// write depth hide the lines behind them, and the hidden lines are drawn
// again faintly (`ghost`). Bounds are tracked for framing: r = distance from
// the spin (Y) axis.

import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const occluderMaterial = () => new THREE.MeshBasicMaterial({
  colorWrite: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
});

export class Wire {
  constructor() {
    this.segs = [];
    this.occluders = [];
    this.bounds = { yMin: Infinity, yMax: -Infinity, rMax: 0 };
  }

  // A polyline through `pts` (Vector3s)
  line(pts) {
    const b = this.bounds;
    for (const p of pts) {
      b.yMin = Math.min(b.yMin, p.y);
      b.yMax = Math.max(b.yMax, p.y);
      b.rMax = Math.max(b.rMax, Math.hypot(p.x, p.z));
    }
    for (let i = 0; i < pts.length - 1; i++) this.segs.push(...pts[i].toArray(), ...pts[i + 1].toArray());
  }

  occlude(geometry, matrix) {
    const mesh = new THREE.Mesh(geometry, occluderMaterial());
    if (matrix) mesh.applyMatrix4(matrix);
    mesh.renderOrder = 1;
    this.occluders.push(mesh);
  }

  // Surface of revolution around local Y. `profile`: Vector2(r, y) from bottom to top.
  lathe(profile, { rings = 10, meridians = 16, matrix = new THREE.Matrix4(), solid = true, ringsAt } = {}) {
    const curve = new THREE.SplineCurve(profile);
    const at = (v, phi) => {
      const p = curve.getPointAt(v);
      const r = p.x + 0.003;
      return new THREE.Vector3(r * Math.cos(phi), p.y, -r * Math.sin(phi)).applyMatrix4(matrix);
    };
    const vs = ringsAt ?? Array.from({ length: rings }, (_, k) => 0.04 + 0.92 * ((k + 0.5) / rings));
    for (const v of vs) {
      const ring = [];
      for (let i = 0; i <= 72; i++) ring.push(at(v, (i / 72) * Math.PI * 2));
      this.line(ring);
    }
    for (let j = 0; j < meridians; j++) {
      const phi = (j / meridians) * Math.PI * 2, mer = [];
      for (let i = 0; i <= 56; i++) mer.push(at(0.002 + 0.996 * (i / 56), phi));
      this.line(mer);
    }
    if (solid) this.occlude(new THREE.LatheGeometry(curve.getSpacedPoints(64), 64), matrix);
  }

  // A tube of varying radius along a 3D curve: rings across it, lines along it.
  // `closed` for loops (a lens rim): frames are made seamless around the loop.
  tube(curve, radius, { rings = 16, lines = 10, solid = true, ringsFrom = 0, ringsTo = 1, closed = false, segments = 64 } = {}) {
    const N = segments;
    const frames = curve.computeFrenetFrames(N, closed);
    const point = (i, a) => {
      const t = i / N, r = radius(t);
      return curve.getPointAt(t).clone()
        .addScaledVector(frames.normals[i], Math.cos(a) * r)
        .addScaledVector(frames.binormals[i], Math.sin(a) * r);
    };
    for (let k = 0; k < rings; k++) {
      const t = ringsFrom + (ringsTo - ringsFrom) * ((k + 0.5) / rings);
      const i = Math.round(t * N), ring = [];
      for (let s = 0; s <= 40; s++) ring.push(point(i, (s / 40) * Math.PI * 2));
      this.line(ring);
    }
    for (let l = 0; l < lines; l++) {
      const a = (l / lines) * Math.PI * 2, pts = [];
      for (let i = 0; i <= N; i++) pts.push(point(i, a));
      this.line(pts);
    }
    if (!solid) return;
    const R = 24, pos = [], idx = [];
    for (let i = 0; i <= N; i++) for (let s = 0; s <= R; s++) pos.push(...point(i, (s / R) * Math.PI * 2).toArray());
    for (let i = 0; i < N; i++) for (let s = 0; s < R; s++) {
      const a = i * (R + 1) + s, b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.occlude(g);
  }

  // Flat disc (for a slice): circles + optional spokes, occluded as a thin cylinder.
  disc({ center, normal, radii, spokes = 0, spokeFrom = 0, spokeTo = 1, thickness = 0.04 }) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
    const m = new THREE.Matrix4().compose(center, q, new THREE.Vector3(1, 1, 1));
    const P = (r, a, y = 0) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)).applyMatrix4(m);
    const outer = radii[0];
    for (const r of radii) {
      for (const y of [thickness / 2, -thickness / 2]) {
        const c = [];
        for (let i = 0; i <= 72; i++) c.push(P(r, (i / 72) * Math.PI * 2, y));
        this.line(c);
      }
    }
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      for (const y of [thickness / 2, -thickness / 2]) this.line([P(spokeFrom, a, y), P(spokeTo, a, y)]);
    }
    this.occlude(new THREE.CylinderGeometry(outer, outer, thickness, 64), m);
  }

  build({ color, width = 1.1, ghost = 0.12 }) {
    const group = new THREE.Group();
    const geo = new LineSegmentsGeometry().setPositions(this.segs);
    const front = new LineSegments2(geo, new LineMaterial({ color, linewidth: width, transparent: true, opacity: 0.95 }));
    front.renderOrder = 2;
    const back = new LineSegments2(geo, new LineMaterial({ color, linewidth: width * 0.8, transparent: true, opacity: ghost, depthTest: false }));
    back.renderOrder = 0;
    group.add(back, ...this.occluders, front);
    group.userData.bounds = this.bounds;
    return group;
  }
}

// Fade any wireframe group (built here or by cherry.js): scales every line
// material's opacity and hides the occluders once it's gone, so an invisible
// model never hides the visible one's lines.
export function setFade(group, k) {
  group.traverse((o) => {
    if (o.material?.isLineMaterial) {
      o.material.userData.base ??= o.material.opacity;
      o.material.opacity = o.material.userData.base * k;
    } else if (o.isMesh) {
      o.visible = k > 0.02;
    }
  });
  group.visible = k > 0.001;
}
