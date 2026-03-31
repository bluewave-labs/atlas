import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Pet sprites config
// ---------------------------------------------------------------------------

export type PetType = 'cat' | 'fox' | 'dragon' | 'unicorn' | 'none';

export const PET_OPTIONS: { id: PetType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'cat', label: 'Cat' },
  { id: 'fox', label: 'Fox' },
  { id: 'dragon', label: 'Dragon' },
  { id: 'unicorn', label: 'Unicorn' },
];

interface PetAnimConfig {
  walkFrames: number;
  sitFrames: number;
  lickFrames: number;
  hasLick: boolean;
  hasSit: boolean;
}

const PET_CONFIG: Record<Exclude<PetType, 'none'>, PetAnimConfig> = {
  cat: { walkFrames: 6, sitFrames: 10, lickFrames: 12, hasLick: true, hasSit: true },
  fox: { walkFrames: 8, sitFrames: 0, lickFrames: 0, hasLick: false, hasSit: false },
  dragon: { walkFrames: 8, sitFrames: 0, lickFrames: 0, hasLick: false, hasSit: false },
  unicorn: { walkFrames: 8, sitFrames: 0, lickFrames: 0, hasLick: false, hasSit: false },
};

function framePath(pet: PetType, action: string, frame: number): string {
  return `/pets/${pet}/${action}/frame_${String(frame).padStart(3, '0')}.png`;
}

// ---------------------------------------------------------------------------
// DockPet — pixel pet that wanders near the dock
// ---------------------------------------------------------------------------

interface DockPetProps {
  pet?: PetType;
  bottomOffset?: number;
  /** Ref to dock element — pet will stay within its horizontal bounds */
  dockRef?: React.RefObject<HTMLElement | null>;
}

type PetState = 'walk-east' | 'walk-west' | 'idle' | 'sit' | 'lick';

export function DockPet({ pet = 'cat', bottomOffset = 82, dockRef }: DockPetProps) {
  if (pet === 'none') return null;
  const config = PET_CONFIG[pet];
  const [state, setState] = useState<PetState>('idle');
  const [frame, setFrame] = useState(0);
  const [x, setX] = useState(() => {
    if (dockRef?.current) {
      const rect = dockRef.current.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    return window.innerWidth / 2;
  });
  const moveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const xRef = useRef(x);
  xRef.current = x;

  // Frame animation
  useEffect(() => {
    if (state === 'idle') {
      setFrame(0);
      return;
    }

    let maxFrames: number;
    let rate: number;

    if (state === 'walk-east' || state === 'walk-west') {
      maxFrames = config.walkFrames;
      rate = 220; // slow gentle walk
    } else if (state === 'sit') {
      maxFrames = config.sitFrames;
      rate = 200;
    } else if (state === 'lick') {
      maxFrames = config.lickFrames;
      rate = 160;
    } else {
      return;
    }

    setFrame(0);
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % maxFrames);
    }, rate);
    return () => clearInterval(interval);
  }, [state, config]);

  // Movement (only when walking) — constrained to dock bounds
  useEffect(() => {
    if (state !== 'walk-east' && state !== 'walk-west') return;
    // Cache dock bounds once per walk session (avoid getBoundingClientRect every 16ms)
    let minX = 20;
    let maxX = window.innerWidth - 60;
    if (dockRef?.current) {
      const rect = dockRef.current.getBoundingClientRect();
      minX = rect.left;
      maxX = rect.right - 40;
    }
    const speed = 0.35;
    const interval = setInterval(() => {
      setX((prev) => {
        const next = state === 'walk-east' ? prev + speed : prev - speed;
        if (next > maxX) { setState('walk-west'); return prev; }
        if (next < minX) { setState('walk-east'); return prev; }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [state, dockRef]);

  // Behavior loop
  const pickNextAction = useCallback(() => {
    const rand = Math.random();
    const hasCatAnims = config.hasLick || config.hasSit;

    if (rand < 0.2 && config.hasSit) {
      // Sit for 4-8s
      setState('sit');
      moveTimerRef.current = setTimeout(pickNextAction, 4000 + Math.random() * 4000);
    } else if (rand < 0.35 && config.hasLick) {
      // Lick for 3-5s
      setState('lick');
      moveTimerRef.current = setTimeout(pickNextAction, 3000 + Math.random() * 2000);
    } else if (rand < 0.55) {
      // Idle (just standing still) for 3-6s
      setState('idle');
      moveTimerRef.current = setTimeout(pickNextAction, 3000 + Math.random() * 3000);
    } else {
      // Walk for 5-12s
      const preferDir = xRef.current > window.innerWidth / 2 ? 'walk-west' : 'walk-east';
      setState(Math.random() > 0.4 ? preferDir : (preferDir === 'walk-east' ? 'walk-west' : 'walk-east'));
      moveTimerRef.current = setTimeout(pickNextAction, 5000 + Math.random() * 7000);
    }
  }, [config]);

  useEffect(() => {
    moveTimerRef.current = setTimeout(pickNextAction, 2000 + Math.random() * 2000);
    return () => clearTimeout(moveTimerRef.current);
  }, [pickNextAction]);

  // Resolve sprite path
  let src: string;
  if (state === 'idle') {
    src = `/pets/${pet}/idle/frame_000.png`;
  } else if (state === 'sit') {
    src = framePath(pet, 'sit', frame);
  } else if (state === 'lick') {
    src = framePath(pet, 'lick', frame);
  } else {
    src = framePath(pet, state, frame);
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: x,
        width: 40,
        height: 40,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        zIndex: 45,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// PetPreview — animated walk preview for settings picker
// ---------------------------------------------------------------------------

export function PetPreview({ pet, size = 48 }: { pet: Exclude<PetType, 'none'>; size?: number }) {
  const config = PET_CONFIG[pet];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % config.walkFrames);
    }, 180);
    return () => clearInterval(interval);
  }, [config.walkFrames]);

  return (
    <img
      src={framePath(pet, 'walk-east', frame)}
      alt={pet}
      draggable={false}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
      }}
    />
  );
}
