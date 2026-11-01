import {PlaneGeometry, Vector2} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

// The reflection uses the real horizontal road plane. Only wetness is textured;
// the reflected image retains the mirror camera's projective coordinates.
const wetRoadShader = {
  name: 'WetAsphaltReflection',
  uniforms: {
    color: {value: null},
    tDiffuse: {value: null},
    textureMatrix: {value: null},
    texelSize: {value: new Vector2(1 / 1024, 1 / 640)},
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vReflection;
    varying vec3 vWorldPosition;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vReflection = textureMatrix * vec4(position, 1.0);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 texelSize;
    varying vec4 vReflection;
    varying vec3 vWorldPosition;
    #include <logdepthbuf_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 cell = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
                 mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      #include <logdepthbuf_fragment>
      // Fixed world coordinates prevent puddles from turning or sliding with a shot.
      vec2 road = vWorldPosition.xz;
      float patches = .65 * noise(road * vec2(.72, .36))
                    + .25 * noise(road * 1.7) + .10 * noise(road * 5.1);
      float wetness = smoothstep(.43, .68, patches);
      wetness *= 1.0 - smoothstep(5.45, 5.72, abs(road.x));
      vec3 eye = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - max(eye.y, 0.0), 4.0);
      float alpha = wetness * (.10 + .48 * fresnel);
      // Distant reflected scenery and the street fade into the same night air.
      alpha *= exp(-.00025 * dot(cameraPosition - vWorldPosition, cameraPosition - vWorldPosition));
      if (alpha < .003) discard;
      vec2 uv = vReflection.xy / vReflection.w;
      vec2 blur = texelSize * mix(2.2, .8, wetness);
      vec3 reflection = texture2D(tDiffuse, uv).rgb * .28;
      reflection += texture2D(tDiffuse, uv + vec2(blur.x, 0.0)).rgb * .14;
      reflection += texture2D(tDiffuse, uv - vec2(blur.x, 0.0)).rgb * .14;
      reflection += texture2D(tDiffuse, uv + vec2(0.0, blur.y)).rgb * .14;
      reflection += texture2D(tDiffuse, uv - vec2(0.0, blur.y)).rgb * .14;
      reflection += texture2D(tDiffuse, uv + blur).rgb * .04;
      reflection += texture2D(tDiffuse, uv - blur).rgb * .04;
      reflection += texture2D(tDiffuse, uv + vec2(blur.x, -blur.y)).rgb * .04;
      reflection += texture2D(tDiffuse, uv + vec2(-blur.x, blur.y)).rgb * .04;
      gl_FragColor = vec4(reflection, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createWetRoad({width = 11.5, length = 640, height = -.037} = {}) {
  const surface = new Reflector(new PlaneGeometry(width, length), {
    textureWidth: 1024, textureHeight: 640, multisample: 0,
    clipBias: .002, shader: wetRoadShader,
  });
  surface.name = 'wet-asphalt-puddles';
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = height;
  surface.material.transparent = true;
  surface.material.depthWrite = false;
  surface.renderOrder = 1;
  return surface;
}
