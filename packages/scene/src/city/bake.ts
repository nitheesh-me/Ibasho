/**
 * The paper model bake (DS 10, 13.8; QA M1): when the city rests, one frame with N8AO ambient
 * occlusion and a Sobel style ink edge on depth, so card masses read with contact depth and crisp
 * cut edges. While anything moves the plain live pass runs. Owner: WP-07.
 *
 * The edge pass uses the depth Laplacian (zero on any plane, large at creases and silhouettes), so a
 * tilted ground never reads as an edge under the orthographic camera.
 */
import { N8AOPostPass } from 'n8ao';
import {
  BlendFunction,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  RenderPass,
} from 'postprocessing';
import { type Camera, Color, HalfFloatType, type Scene, Uniform, type WebGLRenderer } from 'three';

const EDGE_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uStrength;
uniform float uSpan;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 px = texelSize;
  float l = readDepth(uv - vec2(px.x, 0.0));
  float r = readDepth(uv + vec2(px.x, 0.0));
  float b = readDepth(uv - vec2(0.0, px.y));
  float t = readDepth(uv + vec2(0.0, px.y));
  float lap = abs(l + r + b + t - 4.0 * depth) * uSpan;
  float e = smoothstep(0.35, 1.6, lap);
  outputColor = vec4(mix(inputColor.rgb, uInk, e * uStrength), inputColor.a);
}
`;

/** Ink edges from depth (one pass, no extra scene render). */
export class InkEdgeEffect extends Effect {
  constructor(ink: string, strength: number, span: number) {
    super('InkEdgeEffect', EDGE_FRAG, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uInk', new Uniform(new Color(ink))],
        ['uStrength', new Uniform(strength)],
        ['uSpan', new Uniform(span)],
      ]),
    });
  }
}

export interface PaperBake {
  composer: EffectComposer;
  setSize(width: number, height: number): void;
  render(): void;
  /** Day and night in place: AO colour and strength, edge ink. No pass is rebuilt. */
  setTheme(t: { ink: string; night: boolean }): void;
  dispose(): void;
}

/** A composer for the resting frame: scene, N8AO at half resolution, ink edges. */
export function paperBake(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  opts: { ink: string; night: boolean; far: number },
): PaperBake {
  const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const ao = new N8AOPostPass(scene, camera, 1, 1);
  ao.configuration.aoRadius = 4;
  ao.configuration.distanceFalloff = 1;
  ao.configuration.intensity = opts.night ? 1.2 : 2.2;
  ao.configuration.color = new Color(opts.ink);
  ao.configuration.gammaCorrection = false;
  ao.configuration.halfRes = true;
  composer.addPass(ao);
  const edge = new InkEdgeEffect(opts.ink, opts.night ? 0.25 : 0.35, opts.far);
  composer.addPass(new EffectPass(camera, edge));
  return {
    setTheme: ({ ink, night }) => {
      ao.configuration.intensity = night ? 1.2 : 2.2;
      ao.configuration.color = new Color(ink);
      (edge.uniforms.get('uInk')!.value as Color).set(ink);
      edge.uniforms.get('uStrength')!.value = night ? 0.25 : 0.35;
    },
    composer,
    setSize: (w, h) => composer.setSize(w, h, false),
    render: () => composer.render(0),
    dispose: () => composer.dispose(),
  };
}
