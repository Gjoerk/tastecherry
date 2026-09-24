// Gem material: traces the refracted ray through the stone's own facet planes
// (the stone is convex, so the exit facet is the nearest plane ahead), with
// total internal reflection and per-channel dispersion on the way out.

import * as THREE from "three";

const MAX_PLANES = 96;

// Unique facet planes (normal, offset) of a convex, non-indexed geometry.
export function facetPlanes(geometry) {
  const pos = geometry.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const planes = [];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const d = n.dot(a);
    const plane = new THREE.Vector4(n.x, n.y, n.z, d);
    if (!planes.some((p) => p.clone().sub(plane).length() < 1e-3)) planes.push(plane);
  }
  if (planes.length > MAX_PLANES) throw new Error(`Gem has ${planes.length} planes (max ${MAX_PLANES})`);
  while (planes.length < MAX_PLANES) planes.push(new THREE.Vector4(0, 0, 0, 0));
  return planes;
}

// Gem photography studio: light walls surrounded by bright soft boxes and
// black flags. The flags are what give a brilliant its crisp dark facets.
export function gemStudio({ wall = 0.62, light = 5, flags = 14, boxes = 12, seed = 7 } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(wall, wall, wall * 0.97), side: THREE.BackSide })
  ));
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const card = (color, count, minSize, maxSize) => {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 1.6 - 0.5, rand() * 2 - 1).normalize();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.position.copy(dir.multiplyScalar(6));
      m.scale.set(minSize + rand() * (maxSize - minSize), minSize + rand() * (maxSize - minSize), 1);
      m.lookAt(0, 0, 0);
      scene.add(m);
    }
  };
  card(new THREE.Color(0.02, 0.02, 0.02), flags, 1.2, 3.2);
  card(new THREE.Color(light, light, light), boxes, 0.8, 2.4);
  return scene;
}

// Environment rendered into a cube map (HDR, so soft boxes can exceed 1).
export function cubeEnvironment(renderer, scene, size = 256) {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  new THREE.CubeCamera(0.1, 50, target).update(renderer, scene);
  return target.texture;
}

// Bounding planes for a stone that is only roughly convex (the rough crystal):
// `count` directions spread over the sphere, each plane just touching the
// mesh's outermost vertex that way. The ray exits through these.
export function supportPlanes(geometry, count = MAX_PLANES) {
  const pos = geometry.attributes.position, v = new THREE.Vector3();
  const planes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i + 0.5) * (2 / count), r = Math.sqrt(1 - y * y), a = i * golden;
    const n = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    let d = -Infinity;
    for (let j = 0; j < pos.count; j++) d = Math.max(d, n.dot(v.fromBufferAttribute(pos, j)));
    planes.push(new THREE.Vector4(n.x, n.y, n.z, d));
  }
  while (planes.length < MAX_PLANES) planes.push(new THREE.Vector4(0, 0, 0, 0));
  return planes;
}

// milk: how much the light inside is scattered to a soft white (0 = water clear)
// frost: blur of what the surface reflects and refracts (env mip bias)
export function createGemMaterial(geometry, envMap, {
  ior = 2.42, dispersion = 0.035, tint = "#ffffff", bounces = 5,
  planes = null, milk = 0, milkColor = "#ECEEEF", frost = 0,
} = {}) {
  const uniforms = {
    envMap: { value: envMap },
    planes: { value: planes ?? facetPlanes(geometry) },
    milk: { value: milk },
    milkColor: { value: new THREE.Color(milkColor) },
    frost: { value: frost },
    ior: { value: ior },
    dispersion: { value: dispersion },
    tint: { value: new THREE.Color(tint) },
    camObj: { value: new THREE.Vector3() },
    objToWorld: { value: new THREE.Matrix3() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: { PLANES: MAX_PLANES, BOUNCES: bounces },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vPos = position;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform samplerCube envMap;
      uniform vec4 planes[PLANES];
      uniform float ior;
      uniform float dispersion;
      uniform vec3 tint;
      uniform float milk;
      uniform vec3 milkColor;
      uniform float frost;
      uniform vec3 camObj;
      uniform mat3 objToWorld;
      varying vec3 vPos;
      varying vec3 vNormal;

      vec3 env(vec3 dirObj) {
        return textureCube(envMap, normalize(objToWorld * dirObj), frost).rgb;
      }

      // Nearest facet the ray leaves through (from inside the convex stone)
      void exitFacet(vec3 p, vec3 d, out float tHit, out vec3 nHit) {
        tHit = 1e5;
        nHit = vec3(0.0, 1.0, 0.0);
        for (int i = 0; i < PLANES; i++) {
          vec3 n = planes[i].xyz;
          float dn = dot(d, n);
          if (dn > 1e-4) {
            float t = (planes[i].w - dot(p, n)) / dn;
            if (t > 1e-4 && t < tHit) { tHit = t; nHit = n; }
          }
        }
      }

      void main() {
        vec3 V = normalize(vPos - camObj);
        vec3 N = normalize(vNormal);

        float F0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
        float fresnel = F0 + (1.0 - F0) * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
        vec3 reflected = env(reflect(V, N));

        vec3 p = vPos;
        vec3 d = refract(V, N, 1.0 / ior);
        vec3 refracted = vec3(0.0);
        float carry = 1.0;

        for (int b = 0; b < BOUNCES; b++) {
          float t; vec3 n;
          exitFacet(p, d, t, n);
          p += d * t;
          vec3 outG = refract(d, -n, ior);
          if (dot(outG, outG) > 0.0) {
            // Escapes: split into R/G/B with slightly different indices (fire)
            vec3 outR = refract(d, -n, ior - dispersion);
            vec3 outB = refract(d, -n, ior + dispersion);
            if (dot(outR, outR) == 0.0) outR = outG;
            if (dot(outB, outB) == 0.0) outB = outG;
            refracted = vec3(env(outR).r, env(outG).g, env(outB).b) * carry;
            break;
          }
          d = reflect(d, -n);           // total internal reflection
          carry *= 0.96;
          if (b == BOUNCES - 1) refracted = env(d) * carry * 0.6;
        }

        // milky: part of the light is scattered inside (brighter the more it bounced around)
        refracted = mix(refracted, milkColor * (0.75 + 0.25 * carry), milk);
        vec3 color = mix(refracted * tint, reflected, fresnel);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  material.userData.update = (mesh, camera) => {
    uniforms.camObj.value.copy(camera.position);
    mesh.worldToLocal(uniforms.camObj.value);
    uniforms.objToWorld.value.setFromMatrix4(mesh.matrixWorld);
    // Remove scale so directions stay unit length
    const s = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x;
    uniforms.objToWorld.value.multiplyScalar(1 / s);
  };
  return material;
}
