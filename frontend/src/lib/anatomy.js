/**
 * Maps a study topic to the anatomical system worth looking at in 3D.
 *
 * The models are whole systems rather than individually addressable organs, so
 * matching is done on the topic title: a topic about the brachial plexus opens
 * the nervous system, one about the rotator cuff opens the muscular system.
 * Nothing here is anatomy-specific to the app — a goal about macroeconomics
 * simply matches nothing and no viewer is offered.
 */

export const ANATOMY_SYSTEMS = {
  myology: {
    file: 'myology.glb',
    label: 'Muscular system',
    blurb: 'Skeletal muscles, their bellies and tendinous attachments.',
  },
  arthrology: {
    file: 'arthrology.glb',
    label: 'Skeleton & joints',
    blurb: 'Bones and the articulations between them.',
  },
  neurology: {
    file: 'neurology.glb',
    label: 'Nervous system',
    blurb: 'Brain, spinal cord and the peripheral nerves.',
  },
  angiology: {
    file: 'angiology.glb',
    label: 'Cardiovascular system',
    blurb: 'Heart, arteries, veins and lymphatics.',
  },
  splanchnology: {
    file: 'splanchnology.glb',
    label: 'Internal organs',
    blurb: 'The viscera of the thorax, abdomen and pelvis.',
  },
  muscular_insertions: {
    file: 'muscular_insertions.glb',
    label: 'Muscle attachments',
    blurb: 'Where each muscle originates and inserts on bone.',
  },
};

/**
 * Ordered most specific first: "cardiac muscle" should open the heart, not the
 * skeletal muscles, so the cardiovascular terms get to match before "muscle".
 */
const MATCHERS = [
  ['angiology', ['heart', 'cardiac', 'cardio', 'artery', 'arteries', 'arterial', 'vein', 'venous', 'vessel', 'vascular', 'circulation', 'circulatory', 'aorta', 'capillar', 'lymph', 'blood supply', 'angio']],
  ['neurology', ['nerve', 'nervous', 'neuro', 'brain', 'cerebr', 'cerebell', 'spinal cord', 'plexus', 'ganglion', 'cranial', 'meninges', 'medulla', 'thalamus', 'cortex', 'synapse', 'reflex']],
  ['splanchnology', ['organ', 'viscera', 'visceral', 'stomach', 'intestine', 'bowel', 'liver', 'hepat', 'kidney', 'renal', 'lung', 'pulmonary', 'respirat', 'digest', 'gastro', 'spleen', 'pancrea', 'bladder', 'reproductive', 'endocrine', 'thyroid', 'abdomen', 'abdominal', 'thorax', 'thoracic cavity']],
  ['muscular_insertions', ['insertion', 'origin and insertion', 'attachment', 'tendon', 'aponeurosis']],
  ['arthrology', ['bone', 'osteo', 'skelet', 'joint', 'articulat', 'cartilage', 'ligament', 'vertebra', 'spine', 'cranium', 'skull', 'pelvis', 'femur', 'humerus', 'rib', 'arthro', 'synovial']],
  ['myology', ['muscle', 'muscular', 'myo', 'biceps', 'triceps', 'deltoid', 'quadriceps', 'hamstring', 'flexor', 'extensor', 'abductor', 'adductor', 'rotator cuff', 'diaphragm']],
];

/**
 * Returns the system key for a topic title, or null when the topic has nothing
 * to do with human anatomy.
 */
export function matchAnatomySystem(...text) {
  const haystack = text.filter(Boolean).join(' ').toLowerCase();
  if (!haystack.trim()) return null;

  for (const [system, keywords] of MATCHERS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return system;
    }
  }

  return null;
}

export const getAnatomySystem = (key) => ANATOMY_SYSTEMS[key] ?? null;

export const anatomyModelUrl = (key) => {
  const system = ANATOMY_SYSTEMS[key];
  return system ? `/models/anatomy/${system.file}` : null;
};

/**
 * The standalone Quest build, offered as a download beside the in-browser
 * viewer. It is a sideload rather than a store install, so it is deliberately
 * the secondary option: the WebXR button below needs nothing installed at all.
 */
export const VR_APK_URL =
  'https://github.com/iamankit07/HackInMotion-RICR-HIM-1083/releases/download/vr-v1/VR_Human_Anatomy.apk';

export const VR_APK_SIZE = '407 MB';

/**
 * Whether this browser can open an immersive session — true in the Quest
 * browser, false on every laptop and phone the app is normally used from.
 *
 * Resolved once and shared, because each caller asking the headset the same
 * question is wasted work on a device with little to spare.
 */
let vrSupport = null;

export function checkVrSupport() {
  if (vrSupport) return vrSupport;

  vrSupport = navigator.xr?.isSessionSupported
    ? navigator.xr.isSessionSupported('immersive-vr').catch(() => false)
    : Promise.resolve(false);

  return vrSupport;
}
