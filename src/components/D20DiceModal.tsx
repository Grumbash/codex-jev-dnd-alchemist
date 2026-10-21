import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { sfx } from '../utils/sound';

interface D20DiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetResult?: number; // Pre-rolled 1..20 or randomized if undefined
  modifier?: number;
  dc?: number;
  title?: string;
  subtitle?: string;
  onRollComplete?: (result: number, total: number) => void;
}

export const D20DiceModal: React.FC<D20DiceModalProps> = ({
  isOpen,
  onClose,
  targetResult,
  modifier = 0,
  dc,
  title = 'Бросок d20 Судьбы',
  subtitle = 'Мыс Дальний Камень',
  onRollComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentRoll, setCurrentRoll] = useState<number>(targetResult || 10);
  const [isRolling, setIsRolling] = useState<boolean>(true);
  const [hasSettled, setHasSettled] = useState<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // References for Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dieGroupRef = useRef<THREE.Group | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);

  // Roll physics state
  const rollPhysicsRef = useRef({
    angularVelocity: new THREE.Vector3(0, 0, 0),
    targetQuaternion: new THREE.Quaternion(),
    isRolling: true,
    settleProgress: 0,
    startTime: 0,
    targetFaceIndex: 19, // 0..19 corresponds to numbers 1..20
  });

  const rollDie = (forceResult?: number) => {
    setIsRolling(true);
    setHasSettled(false);
    sfx.playDiceRoll();

    const result = forceResult ?? (targetResult || Math.floor(Math.random() * 20) + 1);
    setCurrentRoll(result);

    const physics = rollPhysicsRef.current;
    physics.isRolling = true;
    physics.settleProgress = 0;
    physics.startTime = performance.now();
    physics.targetFaceIndex = result - 1;

    // High tumble rotational impulse
    physics.angularVelocity.set(
      (Math.random() * 0.4 + 0.3) * (Math.random() > 0.5 ? 1 : -1),
      (Math.random() * 0.4 + 0.3) * (Math.random() > 0.5 ? 1 : -1),
      (Math.random() * 0.3 + 0.2) * (Math.random() > 0.5 ? 1 : -1)
    );
  };

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 380;
    const height = mountRef.current.clientHeight || 340;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.4);
    scene.add(ambientLight);

    const goldPoint = new THREE.PointLight(0xffd700, 3.5, 20);
    goldPoint.position.set(4, 5, 6);
    scene.add(goldPoint);

    const rimPoint = new THREE.PointLight(0x4080ff, 2.0, 15);
    rimPoint.position.set(-4, -3, 3);
    scene.add(rimPoint);

    // 3. Icosahedron D20 Die Group
    const dieGroup = new THREE.Group();
    scene.add(dieGroup);
    dieGroupRef.current = dieGroup;

    const radius = 2.2;
    const geometry = new THREE.IcosahedronGeometry(radius, 0);

    // Dark Basalt Material with brass sheen
    const material = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.35,
      metalness: 0.85,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    dieGroup.add(mesh);

    // Gold Brass Edges
    const edgesGeom = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xeab308,
      linewidth: 2,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeom, edgesMat);
    dieGroup.add(edgesMesh);

    // Face Normals & 3D Number Labels
    // An icosahedron has 20 triangular faces (60 non-indexed vertices)
    const posAttr = geometry.getAttribute('position');
    const faceNormals: THREE.Vector3[] = [];

    const createTextTexture = (num: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 128, 128);
        ctx.font = 'bold 54px "Cinzel", "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Underline for 6 and 9
        if (num === 6 || num === 9) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(44, 96);
          ctx.lineTo(84, 96);
          ctx.stroke();
        }
        // Shadow
        ctx.fillStyle = '#000000';
        ctx.fillText(String(num), 66, 66);
        // Golden Text
        ctx.fillStyle = num === 20 ? '#fbbf24' : num === 1 ? '#ef4444' : '#fef08a';
        ctx.fillText(String(num), 64, 64);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    // Calculate centers of each of the 20 faces
    for (let i = 0; i < 20; i++) {
      const vA = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3);
      const vB = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
      const vC = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);

      const center = new THREE.Vector3()
        .add(vA)
        .add(vB)
        .add(vC)
        .divideScalar(3);

      const normal = center.clone().normalize();
      faceNormals.push(normal);

      // Create a small sprite on each face
      const faceNumber = i + 1;
      const spriteMat = new THREE.SpriteMaterial({
        map: createTextTexture(faceNumber),
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(center.clone().multiplyScalar(1.02)); // slightly above surface
      sprite.scale.set(1.35, 1.35, 1);
      dieGroup.add(sprite);
    }

    // 4. Sparkle Particles for roll impact
    const particleCount = 120;
    const partGeom = new THREE.BufferGeometry();
    const partPos = new Float32Array(particleCount * 3);
    const partVel: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      partPos[i * 3] = 0;
      partPos[i * 3 + 1] = 0;
      partPos[i * 3 + 2] = 0;
      partVel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        )
      );
    }
    partGeom.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.12,
      transparent: true,
      opacity: 0,
    });
    const particleSystem = new THREE.Points(partGeom, partMat);
    scene.add(particleSystem);
    particleSystemRef.current = particleSystem;

    // Trigger initial roll
    rollDie(targetResult);

    // Mouse Drag interaction
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouse = { x: clientX, y: clientY };
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dieGroupRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouse.x;
      const deltaY = clientY - prevMouse.y;
      prevMouse = { x: clientX, y: clientY };

      dieGroupRef.current.rotation.y += deltaX * 0.01;
      dieGroupRef.current.rotation.x += deltaY * 0.01;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    dom.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    // 5. Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const physics = rollPhysicsRef.current;

      if (physics.isRolling && dieGroupRef.current) {
        const elapsed = (time - physics.startTime) / 1000;

        if (elapsed < 1.4) {
          // Fast tumble phase
          dieGroupRef.current.rotation.x += physics.angularVelocity.x;
          dieGroupRef.current.rotation.y += physics.angularVelocity.y;
          dieGroupRef.current.rotation.z += physics.angularVelocity.z;
          physics.angularVelocity.multiplyScalar(0.975);
        } else {
          // Settling phase: orient the target face normal towards the camera (0, 0, 1)
          const targetNormal = faceNormals[physics.targetFaceIndex] || faceNormals[19];
          const forward = new THREE.Vector3(0, 0, 1);

          // Calculate quaternion that rotates targetNormal into forward vector
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(targetNormal, forward);

          physics.settleProgress = Math.min(1, physics.settleProgress + delta * 2.8);
          dieGroupRef.current.quaternion.slerp(targetQuat, physics.settleProgress * 0.22);

          if (physics.settleProgress >= 0.96) {
            dieGroupRef.current.quaternion.copy(targetQuat);
            physics.isRolling = false;
            setIsRolling(false);
            setHasSettled(true);

            // Trigger particles & fanfare
            const finalRoll = physics.targetFaceIndex + 1;
            if (partMat) {
              partMat.color.setHex(finalRoll === 20 ? 0xffd700 : finalRoll === 1 ? 0xff3333 : 0x38bdf8);
              partMat.opacity = 0.95;
            }
            if (finalRoll === 20) {
              sfx.playSuccess(true);
            } else if (finalRoll === 1) {
              sfx.playFail();
            } else {
              sfx.playClick();
            }

            if (onRollComplete) {
              onRollComplete(finalRoll, finalRoll + modifier);
            }
          }
        }
      } else if (!isDragging && dieGroupRef.current) {
        // Subtle floating idle motion
        dieGroupRef.current.position.y = Math.sin(time * 0.002) * 0.12;
      }

      // Update particle decay
      if (partMat && partMat.opacity > 0.01) {
        partMat.opacity *= 0.94;
        const positions = partGeom.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += partVel[i].x * delta * 1.5;
          positions[i * 3 + 1] += partVel[i].y * delta * 1.5;
          positions[i * 3 + 2] += partVel[i].z * delta * 1.5;
        }
        partGeom.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate(performance.now());

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      dom.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      dom.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const total = currentRoll + modifier;
  const isCritSuccess = currentRoll === 20;
  const isCritFail = currentRoll === 1;
  const isSuccess = dc !== undefined ? total >= dc : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-amber-500/40 rounded-2xl shadow-[0_0_50px_rgba(217,119,6,0.25)] overflow-hidden flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stone-950 via-amber-950/40 to-stone-950 px-5 py-3 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎲</span>
            <div>
              <h3 className="font-serif font-bold text-amber-200 text-sm tracking-wide uppercase">
                {title}
              </h3>
              <p className="text-xs text-stone-400 font-mono">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-amber-300 p-1 rounded-lg hover:bg-stone-800 transition"
          >
            ✕
          </button>
        </div>

        {/* 3D WebGL Canvas Mount */}
        <div className="relative w-full h-[320px] bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden">
          <div ref={mountRef} className="w-full h-full" />

          {/* Touch / Mouse Hint */}
          <div className="absolute top-3 left-4 text-[10px] text-stone-500 font-mono pointer-events-none bg-stone-950/60 px-2 py-0.5 rounded border border-stone-800">
            {isRolling ? '🌀 Вращение кубика...' : '🖐️ Потяните мышью для осмотра 3D'}
          </div>

          {/* Quick Roll Result Badge Overlay */}
          {hasSettled && (
            <div className="absolute bottom-3 inset-x-4 flex items-center justify-center pointer-events-none">
              <div
                className={`px-4 py-2 rounded-xl border backdrop-blur-md flex items-center gap-3 shadow-xl animate-in zoom-in-95 duration-200 ${
                  isCritSuccess
                    ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-amber-500/30'
                    : isCritFail
                    ? 'bg-red-950/80 border-red-500 text-red-200 shadow-red-500/30'
                    : isSuccess
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                    : 'bg-stone-950/80 border-stone-700 text-stone-300'
                }`}
              >
                <div className="text-3xl font-serif font-black">{currentRoll}</div>
                <div className="text-left border-l border-white/10 pl-3">
                  <div className="text-xs font-bold leading-none">
                    {isCritSuccess
                      ? '🌟 НАТУРАЛЬНЫЕ 20 (КРИТ)!'
                      : isCritFail
                      ? '💀 НАТУРАЛЬНАЯ 1 (ПРОВАЛ)!'
                      : dc !== undefined
                      ? isSuccess
                        ? '✨ УСПЕХ ПРОВЕРКИ'
                        : '❌ ПРОВАЛ ПРОВЕРКИ'
                      : 'БРОСОК ЗАВЕРШЕН'}
                  </div>
                  <div className="text-[11px] text-stone-300 mt-0.5 font-mono">
                    d20 ({currentRoll}) {modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`} ={' '}
                    <span className="font-bold text-amber-300">{total}</span>
                    {dc !== undefined && (
                      <span className="text-stone-400"> (против СЛ {dc})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={() => rollDie()}
            disabled={isRolling}
            className="flex-1 py-2.5 px-4 rounded-xl border border-amber-500/40 bg-stone-900 hover:bg-stone-800 text-amber-200 font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>🎲</span>
            <span>Бросить снова</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
          >
            <span>✓</span>
            <span>Принять бросок</span>
          </button>
        </div>
      </div>
    </div>
  );
};
