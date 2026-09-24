// The last section's eye: a real-time, physically based eyeball that looks at
// the cursor.
//
//   sclera  a sphere open at the front; painted map (warm white, vessels running
//           toward the iris, grey limbal shadow), glossy clear coat = tear film
//   iris    a disc behind the cornea; baked colour + height maps: radial fibres,
//           amber collarette, crypts, furrows, dark limbal ring, black pupil
//   cornea  a clear refracting dome (transmission, IOR 1.376)
//
// The iris maps are procedural (simplex noise), rendered once on the GPU at load.
// The studio environment gives the catchlights, which stay put as the eye turns.
// It follows the cursor (eased, with tiny fixation tremors); without a mouse,
// or once it has gone quiet, it glances around by itself (not with reduced motion).

import * as THREE from "three";
import { createStage, reducedMotion, studioEnvironment } from "./stage.js";

const LIMBUS_R = 0.55;                                  // iris/cornea edge (eyeball radius 1)
const LIMBUS_Z = Math.sqrt(1 - LIMBUS_R ** 2);
const LIMBUS_A = Math.asin(LIMBUS_R);                   // its angle from the gaze axis
const CORNEA_R = 0.78;                                  // tighter curve than the ball: it bulges
const CORNEA_C = LIMBUS_Z - Math.sqrt(CORNEA_R ** 2 - LIMBUS_R ** 2);
const IRIS_R = LIMBUS_R + 0.02;                         // tucked under the sclera
const IRIS_Z = LIMBUS_Z - 0.09;
const PUPIL_R = 0.19;
const MAX_TURN = THREE.MathUtils.degToRad(36);
const EASE = 0.09;                                      // s: time constant of the eye following its target
const QUIET = 3500;                                     // ms without pointer movement before it glances around

// ---------------------------------------------------------------- GPU-baked maps
// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// Iris in disc coordinates: r = 1 at the disc edge. Colours are linear.
const IRIS = /* glsl */ `
uniform float uPupil, uLimbus, uHeight;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p), th = atan(p.y, p.x);
  vec2 cs = vec2(cos(th), sin(th));
  float t = clamp((r - uPupil) / (uLimbus - uPupil), 0.0, 1.0);   // 0 pupil edge → 1 limbus
  // fibres: noise that changes fast around and slowly outward = radial strands, a little wavy
  float wave = 0.12 * snoise(vec3(cs * 3.0, t * 2.0 + 11.0));
  vec2 cw = vec2(cos(th + wave * 0.15), sin(th + wave * 0.15));
  float f1 = snoise(vec3(cw * 24.0, t * 2.6));
  float f2 = snoise(vec3(cw * 55.0, t * 5.0 + 5.0));
  float f3 = snoise(vec3(cw * 7.0, t * 1.6 + 9.0));
  float fib = 0.5 + 0.5 * (0.5 * f1 + 0.32 * f2 + 0.18 * f3);
  // collarette: a wobbly ring about a third of the way out
  float coll = 0.34 + 0.05 * snoise(vec3(cs * 2.5, 1.7));
  float inner = 1.0 - smoothstep(coll - 0.14, coll + 0.12, t);
  // amber streaks bleeding outward from the collarette along the fibres
  float streak = smoothstep(0.55, 0.95, 0.5 + 0.5 * f1) * (1.0 - smoothstep(0.3, 0.85, t));
  vec3 ciliary = mix(vec3(0.052, 0.068, 0.040), vec3(0.062, 0.070, 0.064), smoothstep(0.5, 1.0, t));
  vec3 pupillary = vec3(0.105, 0.058, 0.02);
  vec3 col = mix(ciliary, pupillary, clamp(inner + 0.55 * streak, 0.0, 1.0));
  col *= 0.28 + 1.5 * pow(fib, 1.4);
  float ridge = exp(-pow((t - coll) / 0.03, 2.0));
  col += vec3(0.045, 0.032, 0.014) * ridge * (0.5 + 0.5 * f2);
  // crypts: dark pits either side of the collarette
  float crypt = smoothstep(0.5, 0.78, snoise(vec3(cs * 9.0, t * 4.0 + 2.0)))
              * smoothstep(0.2, 0.32, t) * (1.0 - smoothstep(0.6, 0.78, t));
  col *= 1.0 - 0.7 * crypt;
  // contraction furrows: faint broken rings in the outer part
  float fur = 0.5 + 0.5 * sin(t * 30.0 + 2.5 * snoise(vec3(cs * 4.0, 3.0)));
  float furrow = smoothstep(0.86, 1.0, fur) * smoothstep(0.55, 0.72, t) * smoothstep(-0.2, 0.4, snoise(vec3(cs * 5.0, 7.0)));
  col *= 1.0 - 0.35 * furrow;
  // speckles
  col *= 1.0 + 0.25 * smoothstep(0.7, 0.9, snoise(vec3(p * 60.0, 4.0))) * (1.0 - inner);
  // dark limbal ring, pupil ruff, pupil
  col *= 1.0 - 0.9 * smoothstep(0.7, 1.0, t);
  col = mix(col, vec3(0.05, 0.025, 0.012), 1.0 - smoothstep(0.0, 0.04, t));
  float pupil = 1.0 - smoothstep(uPupil - 0.008, uPupil + 0.004, r);
  col = mix(col, vec3(0.003), pupil);
  float h = (0.35 + 0.65 * fib) * (1.0 - crypt * 0.8) * (1.0 - furrow * 0.5) + ridge * 0.6;
  h *= 1.0 - pupil;
  gl_FragColor = uHeight > 0.5 ? vec4(vec3(h), 1.0) : vec4(col, 1.0);
}
`;

function bake(renderer, fragment, width, height, uniforms) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    // half float avoids banding in the dark iris, where the GPU can render to it
    type: renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float")
      ? THREE.HalfFloatType : THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: NOISE + fragment,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const scene = new THREE.Scene();
  scene.add(quad);
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.Camera());
  renderer.setRenderTarget(null);
  material.dispose();
  quad.geometry.dispose();
  target.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return target.texture;
}

// Sclera, painted on a canvas in the sphere's UVs: x around the gaze axis, y from
// the limbus (top) to the back pole. Vessels start at the back and run toward the
// iris, wandering, branching and tapering; a grey shadow rings the limbus.
function scleraTexture(width = 2048, height = 1024) {
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const g = c.getContext("2d");
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const base = g.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#9c9ea3");
  base.addColorStop(0.035, "#cfcdca");
  base.addColorStop(0.12, "#ece8e2");
  base.addColorStop(0.45, "#eae2da");
  base.addColorStop(0.8, "#e2cfc5");
  base.addColorStop(1, "#d6bcb0");
  g.fillStyle = base;
  g.fillRect(0, 0, width, height);
  // mottling: soft warm and cool patches
  for (let i = 0; i < 260; i++) {
    const x = rnd() * width, y = height * (0.1 + rnd() * 0.9), r = 20 + rnd() * 90;
    const warm = rnd() < 0.6;
    const blob = g.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, warm ? "rgba(214,150,140,0.10)" : "rgba(235,228,205,0.12)");
    blob.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = blob;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // vessels: stroked twice (a soft flush, then the vessel), wrapped round the seam
  g.lineCap = g.lineJoin = "round";
  const stroke = (x0, y0, x1, y1, w, colour) => {
    g.strokeStyle = colour;
    g.lineWidth = w;
    for (const dx of [-width, 0, width]) {
      g.beginPath();
      g.moveTo(x0 + dx, y0);
      g.lineTo(x1 + dx, y1);
      g.stroke();
    }
  };
  const vessel = (x, y, angle, w, steps, depth) => {
    for (let i = 0; i < steps; i++) {
      angle += (rnd() - 0.5) * 0.5;
      angle += (-Math.PI / 2 - angle) * 0.06;                     // keeps heading for the iris
      const len = 5 + rnd() * 4;
      const nx = x + Math.cos(angle) * len, ny = y + Math.sin(angle) * len;
      const fade = Math.min(1, (ny / height - 0.04) / 0.2);         // vessels fade out near the limbus
      stroke(x, y, nx, ny, w * 3.2, `rgba(205,95,90,${0.07 * fade})`);
      stroke(x, y, nx, ny, w, `rgba(${150 + rnd() * 30},${22 + rnd() * 18},${28 + rnd() * 10},${0.55 * fade})`);
      x = nx; y = ny;
      w *= 0.988;
      if (depth < 3 && w > 0.9 && rnd() < 0.05) {
        vessel(x, y, angle + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), w * 0.65, steps * 0.55, depth + 1);
      }
      if (y < height * 0.05 || w < 0.35) break;
    }
  };
  for (let i = 0; i < 16; i++) {
    vessel(rnd() * width, height * (0.5 + rnd() * 0.45), -Math.PI / 2 + (rnd() - 0.5) * 0.6, 2 + rnd() * 3.5, 90 + rnd() * 90, 0);
  }
  for (let i = 0; i < 28; i++) {                                  // fine capillaries, anywhere past the limbus shadow
    vessel(rnd() * width, height * (0.18 + rnd() * 0.7), rnd() * Math.PI * 2, 0.6 + rnd() * 0.6, 12 + rnd() * 20, 3);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------- model (gaze along +Z)
// Push a flat disc's middle forward a little (iris toward the pupil / lens)
function domed(geometry, height) {
  const tessellated = new THREE.RingGeometry(0.0001, geometry.parameters.radius, 128, 48);
  geometry.dispose();
  const pos = tessellated.attributes.position, uv = tessellated.attributes.uv;
  const R = tessellated.parameters.outerRadius;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i)) / R;
    pos.setZ(i, height * (1 - r * r));
    uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getY(i) / (2 * R) + 0.5);
  }
  tessellated.computeVertexNormals();
  return tessellated;
}

export function createEye(renderer) {
  const eye = new THREE.Group();
  const toFront = (g) => g.rotateX(Math.PI / 2);          // sphere pole +Y → gaze +Z

  const scleraMap = scleraTexture();
  scleraMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const sclera = new THREE.Mesh(
    toFront(new THREE.SphereGeometry(1, 128, 96, 0, Math.PI * 2, LIMBUS_A - 0.01, Math.PI - LIMBUS_A + 0.01)),
    new THREE.MeshPhysicalMaterial({
      map: scleraMap, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.04,
      sheen: 0.25, sheenColor: new THREE.Color(1, 0.85, 0.8), sheenRoughness: 0.6,
    }),
  );

  const irisUniforms = { uPupil: { value: PUPIL_R / IRIS_R }, uLimbus: { value: LIMBUS_R / IRIS_R }, uHeight: { value: 0 } };
  const irisMap = bake(renderer, IRIS, 1024, 1024, irisUniforms);
  irisUniforms.uHeight.value = 1;
  const irisHeight = bake(renderer, IRIS, 1024, 1024, irisUniforms);
  const iris = new THREE.Mesh(
    domed(new THREE.CircleGeometry(IRIS_R, 128, 0, Math.PI * 2), 0.035),
    new THREE.MeshStandardMaterial({ map: irisMap, bumpMap: irisHeight, bumpScale: 2.5, roughness: 0.65 }),
  );
  iris.position.z = IRIS_Z;

  // Cornea: reflections only, added over the iris (a refraction pass would blur the iris
  // detail); the iris's slight dome below stands in for the cornea's magnification
  const cornea = new THREE.Mesh(
    toFront(new THREE.SphereGeometry(CORNEA_R, 96, 32, 0, Math.PI * 2, 0, Math.asin(LIMBUS_R / CORNEA_R))
      .translate(0, CORNEA_C, 0)),
    new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.0, metalness: 0,
      envMapIntensity: 1.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  // fade its reflection out toward the rim, where it would draw a hard white ring
  cornea.material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRim;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRim = length(position.xy);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRim;")
      .replace("#include <dithering_fragment>",
        `#include <dithering_fragment>\ngl_FragColor.rgb *= 1.0 - smoothstep(${(LIMBUS_R * 0.86).toFixed(3)}, ${LIMBUS_R.toFixed(3)}, vRim);`);
  };
  // the short dark wall between the limbus and the (deeper) iris
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(LIMBUS_R, IRIS_R, LIMBUS_Z - IRIS_Z, 96, 1, true)
      .rotateX(Math.PI / 2).translate(0, 0, (LIMBUS_Z + IRIS_Z) / 2),
    new THREE.MeshStandardMaterial({ color: 0x1d1917, roughness: 0.85, side: THREE.DoubleSide }),
  );
  eye.add(sclera, wall, iris, cornea);
  return eye;
}

// A soft contact shadow on an invisible floor (doesn't turn with the eye)
function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.3)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.12, -1.0, 0.05);
  return shadow;
}

export function initEye(container) {
  const stage = createStage(container, { fov: 22, transparent: true });
  const { renderer, scene, camera } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.environment = studioEnvironment(renderer, { wall: 0.35, panels: 5 });
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const pivot = new THREE.Group();                       // +Z turns toward the target
  pivot.add(createEye(renderer));
  scene.add(pivot, contactShadow());

  camera.position.set(0, 0.6, 7.4);
  camera.lookAt(0, -0.12, 0);

  // ---- Direction: yaw/pitch now (eased) and wanted (radians)
  const now = { yaw: 0, pitch: 0 };
  const want = { yaw: 0, pitch: 0 };
  const tremor = { yaw: 0, pitch: 0 };
  let lastPointer = -Infinity, nextGlance = 0, nextTremor = 0;
  const clamp = (v) => Math.max(-MAX_TURN, Math.min(MAX_TURN, v));
  const lookAt = (x, y) => {
    const r = container.getBoundingClientRect();
    const depth = Math.max(r.width, 240) * 1.1;         // how far in front of the screen the eye "is"
    want.yaw = clamp(Math.atan2(x - (r.left + r.width / 2), depth));
    want.pitch = clamp(Math.atan2((r.top + r.height * 0.47) - y, depth));
    lastPointer = performance.now();
  };
  addEventListener("pointermove", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  addEventListener("pointerdown", (e) => lookAt(e.clientX, e.clientY), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { lastPointer = -Infinity; });

  stage.onFrame = (t, dt) => {
    const ms = performance.now();
    if (!reducedMotion) {
      if (ms - lastPointer > QUIET && ms > nextGlance) {
        want.yaw = (Math.random() * 2 - 1) * MAX_TURN * 0.6;
        want.pitch = (Math.random() * 2 - 1) * MAX_TURN * 0.4;
        nextGlance = ms + 1400 + Math.random() * 2200;
      }
      if (ms > nextTremor) {                             // tiny fixation jumps: a living eye never sits dead still
        tremor.yaw = (Math.random() * 2 - 1) * 0.006;
        tremor.pitch = (Math.random() * 2 - 1) * 0.006;
        nextTremor = ms + 500 + Math.random() * 1200;
      }
    }
    const k = 1 - Math.exp(-dt / EASE);
    now.yaw += (want.yaw + tremor.yaw - now.yaw) * k;
    now.pitch += (want.pitch + tremor.pitch - now.pitch) * k;
    pivot.rotation.set(-now.pitch, now.yaw, 0, "YXZ");
  };
  stage.resize();
  container.classList.add("is-ready");
  return stage;
}
