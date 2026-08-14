import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The three.js half of the anatomy viewer, kept in its own module so the
 * renderer and loaders are a separate chunk. Students who never open a model —
 * which is most of them, on most pages — never download it.
 */
export default function AnatomyCanvas({ url }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.4], fov: 45 }}
      dpr={[1, 1.75]}
      // demand, not the default loop: the model only moves while it is being
      // dragged. Rendering sixty times a second at rest was heating phones and
      // slowing every other animation on the page for nothing.
      frameloop="demand"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <ReleaseContextOnUnmount />

      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} />

      <Suspense fallback={<LoadingLabel />}>
        <Bounds fit clip observe margin={1.15}>
          <AnatomyModel url={url} />
        </Bounds>
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.6}
        maxDistance={6}
      />
    </Canvas>
  );
}

/**
 * A browser only allows a handful of WebGL contexts at once — open a few
 * viewers and it starts force-killing the oldest, which is the "Context Lost"
 * spam in the console and a canvas that goes black. React Three Fiber disposes
 * the renderer, but the context itself has to be handed back explicitly.
 */
function ReleaseContextOnUnmount() {
  const gl = useThree((state) => state.gl);

  useEffect(
    () => () => {
      gl.forceContextLoss?.();
      gl.dispose?.();
    },
    [gl],
  );

  return null;
}

function AnatomyModel({ url }) {
  const { scene } = useGLTF(url, true);
  const invalidate = useThree((state) => state.invalidate);
  const root = useRef();

  // useGLTF caches by url, so two viewers showing the same system would
  // otherwise share — and re-parent — a single scene graph. Clone before use.
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!root.current) return;

    // The source models are not centred on the origin, which would make them
    // orbit around a point off in space.
    const box = new THREE.Box3().setFromObject(root.current);
    root.current.position.sub(box.getCenter(new THREE.Vector3()));

    // On demand rendering means nothing draws until something asks for it.
    invalidate();
  }, [model, invalidate]);

  return <primitive ref={root} object={model} />;
}

function LoadingLabel() {
  return (
    <Html center>
      <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft shadow-[var(--shadow-soft)]">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-saffron border-t-transparent" />
        Loading the model
      </div>
    </Html>
  );
}
