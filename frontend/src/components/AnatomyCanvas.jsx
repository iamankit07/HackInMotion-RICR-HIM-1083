import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The three.js half of the anatomy viewer, kept in its own module so the
 * renderer and loaders are a separate chunk. Students who never open a model —
 * which is most of them, on most pages — never download it.
 */

// Models are normalised to a unit box, so this is roughly how tall the body
// stands in metres once it is in front of you.
const VR_MODEL_SCALE = 1.7;
export default function AnatomyCanvas({ url, vrRequested = false, vrActive = false, onVrChange }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.4], fov: 45 }}
      dpr={[1, 1.75]}
      // demand, not the default loop: the model only moves while it is being
      // dragged. Rendering sixty times a second at rest was heating phones and
      // slowing every other animation on the page for nothing.
      //
      // A headset is the exception. WebXR drives its own frame callback and a
      // demand loop simply never draws, so the session switches this to always.
      frameloop={vrActive ? 'always' : 'demand'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.xr.enabled = true;
      }}
    >
      <ReleaseContextOnUnmount />
      <VrSession requested={vrRequested} onChange={onVrChange} />

      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} />

      <Suspense fallback={<LoadingLabel />}>
        {/*
          On a flat screen Bounds moves the camera to frame the model. In a
          headset the camera is the person's head, so the model is placed in
          front of them at life size instead and Bounds is left out of it.
        */}
        <group
          position={vrActive ? [0, 1.1, -1.5] : [0, 0, 0]}
          scale={vrActive ? VR_MODEL_SCALE : 1}
        >
          {vrActive ? (
            <AnatomyModel url={url} />
          ) : (
            <Bounds fit clip observe margin={1.15}>
              <AnatomyModel url={url} />
            </Bounds>
          )}
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        // The headset pose owns the camera in VR; orbiting it as well fights
        // the person's own head movement and is a quick route to nausea.
        enabled={!vrActive}
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
 * Opens and closes the headset session.
 *
 * This lives inside the Canvas because starting a session needs the renderer,
 * which only exists once react-three-fiber has built it. The button that asks
 * for VR is out in the page, so the request arrives as a prop.
 */
function VrSession({ requested, onChange }) {
  const gl = useThree((state) => state.gl);
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!requested || sessionRef.current || !navigator.xr) return undefined;

    let cancelled = false;

    // Standing scale, with the floor where the person's real floor is. Falls
    // back to local if the headset has no room set up.
    gl.xr.setReferenceSpaceType('local-floor');

    navigator.xr
      .requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      })
      .then(async (session) => {
        if (cancelled) {
          session.end().catch(() => {});
          return;
        }

        sessionRef.current = session;
        session.addEventListener('end', () => {
          sessionRef.current = null;
          onChange?.(false);
        });

        await gl.xr.setSession(session);
        onChange?.(true);
      })
      .catch((error) => {
        // Headset refused, or the click that asked for it went stale. Hand the
        // page back rather than leaving a button stuck saying "opening".
        onChange?.(false, error);
      });

    return () => {
      cancelled = true;
    };
  }, [requested, gl, onChange]);

  // Leaving the page mid-session would otherwise strand the person in VR.
  useEffect(
    () => () => {
      sessionRef.current?.end().catch(() => {});
    },
    [],
  );

  return null;
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

    // The source models are neither centred on the origin nor authored to a
    // common scale, which on a flat screen only Bounds was papering over. In a
    // headset the size is the whole point, so normalise to a unit box here and
    // let the caller scale that to human height.
    //
    // Measure from a cleared transform. React runs this effect twice on mount
    // in development, and the second pass would otherwise measure a model we
    // had already resized, read it as a unit box, and undo the first pass.
    root.current.scale.setScalar(1);
    root.current.position.set(0, 0, 0);
    root.current.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root.current);
    const size = box.getSize(new THREE.Vector3());
    const factor = 1 / (Math.max(size.x, size.y, size.z) || 1);

    root.current.scale.setScalar(factor);
    root.current.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-factor);

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
