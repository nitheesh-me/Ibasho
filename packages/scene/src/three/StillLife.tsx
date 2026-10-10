/**
 * Still-life rendering (DEC TE-8). Owns the render loop: `Live` while the camera moves, one
 * `Bake` (PBR, N8AO, bloom for Yoru, accumulated shadows) once it rests, then only the
 * composite of the baked frame plus overlays, depth-tested against the baked depth.
 * Owner: WP-07.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { N8AOPostPass } from 'n8ao';
import { BloomEffect, CopyPass, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { type MutableRefObject, useEffect, useMemo, useRef } from 'react';
import {
  AlwaysDepth,
  Color,
  DepthTexture,
  HalfFloatType,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import { initialStill, type StillPhase, type StillState, tick } from '../still-life/machine.ts';
import { OVERLAY_LAYER } from './context.tsx';

export interface BakeRecipe {
  ao: boolean;
  aoColor: string;
  aoIntensity: number;
  bloom: { intensity: number; threshold: number } | null;
  multisampling: number;
}

export interface StillStats {
  phase: StillPhase;
  sceneRenders: number;
  composites: number;
  /** `renderer.info.render` of the last frame drawn to the screen. */
  lastCalls: number;
  lastTriangles: number;
  bakeCalls: number;
  bakeTriangles: number;
}

export interface StillLifeProps {
  recipe: BakeRecipe;
  /** False while a camera sequence plays (live only). */
  allowBake: boolean;
  /** Bumped by the stage when the scene graph changes. */
  version: number;
  stats?: MutableRefObject<StillStats | null>;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tColor, vUv);
  gl_FragDepth = texture2D(tDepth, vUv).x;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function StillLife({ recipe, allowBake, version, stats }: StillLifeProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);

  const machine = useRef<StillState>(initialStill(0));
  const dirty = useRef(true);
  const prevWorld = useRef(new Matrix4());
  const prevProj = useRef(new Matrix4());

  const targets = useMemo(() => {
    const bake = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    const depth = new WebGLRenderTarget(1, 1, { depthBuffer: true, depthTexture: new DepthTexture(1, 1) });
    return { bake, depth };
  }, []);

  const composite = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: { tColor: { value: targets.bake.texture }, tDepth: { value: targets.depth.depthTexture } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: true,
      depthWrite: true,
      depthFunc: AlwaysDepth,
    });
    mat.toneMapped = true;
    const quad = new Mesh(new PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const s = new Scene();
    s.add(quad);
    return { scene: s, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mat, quad };
  }, [targets]);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: recipe.multisampling,
    });
    c.autoRenderToScreen = false;
    c.addPass(new RenderPass(scene, camera));
    if (recipe.ao) {
      const ao = new N8AOPostPass(scene, camera, 1, 1);
      ao.configuration.aoRadius = 1.1;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = recipe.aoIntensity;
      ao.configuration.color = new Color(recipe.aoColor);
      ao.configuration.gammaCorrection = false;
      ao.configuration.halfRes = true;
      c.addPass(ao);
    }
    if (recipe.bloom) {
      const bloom = new BloomEffect({
        intensity: recipe.bloom.intensity,
        luminanceThreshold: recipe.bloom.threshold,
        luminanceSmoothing: 0.2,
        mipmapBlur: true,
      });
      c.addPass(new EffectPass(camera, bloom));
    }
    const copy = new CopyPass(targets.bake);
    copy.renderToScreen = false;
    c.addPass(copy);
    return c;
  }, [gl, scene, camera, recipe, targets]);

  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(
    () => () => {
      targets.bake.dispose();
      targets.depth.dispose();
      composite.mat.dispose();
      composite.quad.geometry.dispose();
    },
    [targets, composite],
  );

  useEffect(() => {
    const v = gl.getDrawingBufferSize(new Vector2());
    composer.setSize(size.width, size.height, false);
    targets.bake.setSize(v.x, v.y);
    targets.depth.setSize(v.x, v.y);
    dirty.current = true;
    invalidate();
  }, [gl, composer, targets, size.width, size.height, dpr, invalidate]);

  useEffect(() => {
    dirty.current = true;
    invalidate();
  }, [version, recipe, allowBake, invalidate]);

  useFrame(() => {
    const changed =
      dirty.current ||
      !camera.matrixWorld.equals(prevWorld.current) ||
      !camera.projectionMatrix.equals(prevProj.current);
    prevWorld.current.copy(camera.matrixWorld);
    prevProj.current.copy(camera.projectionMatrix);
    dirty.current = false;
    const { state, action } = tick(machine.current, {
      now: performance.now(),
      changed,
      bakeFrames: 2,
      allowBake,
    });
    machine.current = state;
    const savedLayers = camera.layers.mask;
    let bakeCalls = stats?.current?.bakeCalls ?? 0;
    let bakeTris = stats?.current?.bakeTriangles ?? 0;

    if (action === 'live' || action === 'bake-accumulate') {
      gl.setRenderTarget(null);
      gl.autoClear = true;
      camera.layers.enableAll();
      gl.render(scene, camera);
      camera.layers.mask = savedLayers;
      invalidate();
    } else {
      if (action === 'bake-final') {
        camera.layers.set(0);
        gl.info.reset();
        gl.info.autoReset = false;
        composer.render(0);
        gl.setRenderTarget(targets.depth);
        gl.clear(true, true, false);
        gl.render(scene, camera);
        gl.setRenderTarget(null);
        bakeCalls = gl.info.render.calls;
        bakeTris = gl.info.render.triangles;
        gl.info.autoReset = true;
        camera.layers.mask = savedLayers;
      }
      // Composite: baked colour and depth, then overlays only.
      gl.setRenderTarget(null);
      gl.autoClear = false;
      gl.clear(true, true, true);
      gl.render(composite.scene, composite.camera);
      const bg = scene.background;
      const shadowAuto = gl.shadowMap.autoUpdate;
      scene.background = null;
      gl.shadowMap.autoUpdate = false;
      camera.layers.set(OVERLAY_LAYER);
      gl.render(scene, camera);
      camera.layers.mask = savedLayers;
      scene.background = bg;
      gl.shadowMap.autoUpdate = shadowAuto;
      gl.autoClear = true;
    }
    if (stats) {
      stats.current = {
        phase: state.phase,
        sceneRenders: state.sceneRenders,
        composites: state.composites,
        lastCalls: gl.info.render.calls,
        lastTriangles: gl.info.render.triangles,
        bakeCalls,
        bakeTriangles: bakeTris,
      };
    }
  }, 1);

  return null;
}
