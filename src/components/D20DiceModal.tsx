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

type DiceSkin = 'basalt_gold' | 'dragon_ruby' | 'shadow_astral' | 'emerald_ooze';

const DICE_SKINS: Record<
  DiceSkin,
  {
    name: string;
    bodyColor: number;
    roughness: number;
    metalness: number;
    edgeColor: number;
    textColor: string;
    glowColor: string;
  }
> = {
  basalt_gold: {
    name: 'Базальт и Золото',
    bodyColor: 0x181512,
    roughness: 0.28,
    metalness: 0.82,
    edgeColor: 0xe5b839,
    textColor: '#fde047',
    glowColor: '#eab308',
  },
  dragon_ruby: {
    name: 'Рубин Дракона',
    bodyColor: 0x580a14,
    roughness: 0.18,
    metalness: 0.65,
    edgeColor: 0xff6b81,
    textColor: '#ffe4e6',
    glowColor: '#ef4444',
  },
  shadow_astral: {
    name: 'Теневой Астрал',
    bodyColor: 0x10132b,
    roughness: 0.22,
    metalness: 0.88,
    edgeColor: 0x818cf8,
    textColor: '#c7d2fe',
    glowColor: '#6366f1',
  },
  emerald_ooze: {
    name: 'Изумрудный Омут',
    bodyColor: 0x092b1a,
    roughness: 0.25,
    metalness: 0.72,
    edgeColor: 0x34d399,
    textColor: '#a7f3d0',
    glowColor: '#10b981',
  },
};

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
  const [currentRoll, setCurrentRoll] = useState<number>(targetResult || 20);
  const [isRolling, setIsRolling] = useState<boolean>(true);
  const [hasSettled, setHasSettled] = useState<boolean>(false);
  const [selectedSkin, setSelectedSkin] = useState<DiceSkin>('basalt_gold');

  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dieGroupRef = useRef<THREE.Group | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);

  // References to die materials for dynamic skin swapping
  const dieMeshRef = useRef<THREE.Mesh | null>(null);
  const edgesMeshRef = useRef<THREE.LineSegments | null>(null);

  // Face metadata
  const faceDataRef = useRef<{ normal: THREE.Vector3; targetQuat: THREE.Quaternion }[]>([]);

  // Physics animation parameters
  const physicsRef = useRef({
    isRolling: true,
    startTime: 0,
    duration: 1.5,
    currentRollNumber: targetResult || 20,
    angularVelocity: new THREE.Vector3(0, 0, 0),
    posY: 1.6,
    velY: 0,
    settleFactor: 0,
  });

  const triggerRoll = (forcedNumber?: number) => {
    const nextRoll = forcedNumber ?? (targetResult || Math.floor(Math.random() * 20) + 1);
    setCurrentRoll(nextRoll);
    setIsRolling(true);
    setHasSettled(false);

    sfx.playDiceRoll();

    const p = physicsRef.current;
    p.isRolling = true;
    p.startTime = performance.now();
    p.duration = 1.35;
    p.currentRollNumber = nextRoll;
    p.posY = 1.8; // drop height
    p.velY = 0.5;
    p.settleFactor = 0;

    // Strong angular momentum
    p.angularVelocity.set(
      (Math.random() * 8 + 6) * (Math.random() > 0.5 ? 1 : -1),
      (Math.random() * 8 + 6) * (Math.random() > 0.5 ? 1 : -1),
      (Math.random() * 6 + 4) * (Math.random() > 0.5 ? 1 : -1)
    );
  };

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 420;
    const height = mountRef.current.clientHeight || 360;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 7.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 1.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffeedd, 3.2);
    mainLight.position.set(5, 10, 7);
    scene.add(mainLight);

    const warmRim = new THREE.PointLight(0xffb84d, 2.8, 25);
    warmRim.position.set(-5, 4, 3);
    scene.add(warmRim);

    const blueBackLight = new THREE.PointLight(0x60a5fa, 2.0, 20);
    blueBackLight.position.set(0, -5, -4);
    scene.add(blueBackLight);

    // 3. Tabletop Drop Shadow Plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.6;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // 4. D20 Polyhedron Group
    const dieGroup = new THREE.Group();
    scene.add(dieGroup);
    dieGroupRef.current = dieGroup;

    const radius = 2.0;
    const geometry = new THREE.IcosahedronGeometry(radius, 0);

    const skin = DICE_SKINS[selectedSkin];
    const dieMaterial = new THREE.MeshStandardMaterial({
      color: skin.bodyColor,
      roughness: skin.roughness,
      metalness: skin.metalness,
      flatShading: true,
    });
    const dieMesh = new THREE.Mesh(geometry, dieMaterial);
    dieGroup.add(dieMesh);
    dieMeshRef.current = dieMesh;

    // Golden Edge Filigree
    const edgesGeom = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({
      color: skin.edgeColor,
      linewidth: 2,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeom, edgesMat);
    dieGroup.add(edgesMesh);
    edgesMeshRef.current = edgesMesh;

    // 5. Engraved Number Face Decals (Flat against each triangle!)
    const posAttr = geometry.getAttribute('position');
    const faceData: { normal: THREE.Vector3; targetQuat: THREE.Quaternion }[] = [];

    const createFaceTexture = (num: number, skinKey: DiceSkin) => {
      const curSkin = DICE_SKINS[skinKey];
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 256, 256);

        // Subtle decorative border circle on each face
        ctx.strokeStyle = num === 20 ? '#fbbf24' : num === 1 ? '#ef4444' : curSkin.textColor;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(128, 128, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Font setup
        ctx.font = 'bold 96px "Cinzel", "Times New Roman", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Deep engraved shadow
        ctx.fillStyle = '#000000';
        ctx.fillText(String(num), 132, 134);

        // Face text color
        if (num === 20) {
          ctx.fillStyle = '#fbbf24'; // Radiant gold
        } else if (num === 1) {
          ctx.fillStyle = '#ef4444'; // Cursed crimson
        } else {
          ctx.fillStyle = curSkin.textColor;
        }

        ctx.fillText(String(num), 128, 128);

        // Underline for 6 and 9
        if (num === 6 || num === 9) {
          ctx.strokeStyle = curSkin.textColor;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(96, 185);
          ctx.lineTo(160, 185);
          ctx.stroke();
        }

        // Special star indicator for 20
        if (num === 20) {
          ctx.font = '32px sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('★', 128, 54);
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    // Construct flat face meshes for all 20 faces
    for (let i = 0; i < 20; i++) {
      const vA = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3);
      const vB = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
      const vC = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);

      const center = new THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);
      const normal = center.clone().normalize();

      // Tangent / Up vector aligned with triangle apex vA
      const up = new THREE.Vector3().subVectors(vA, center).normalize();
      const right = new THREE.Vector3().crossVectors(up, normal).normalize();

      // Coordinate matrix: right = X, up = Y, normal = Z
      const rotMatrix = new THREE.Matrix4().makeBasis(right, up, normal);
      const faceQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

      const faceNumber = i + 1;
      const faceGeo = new THREE.PlaneGeometry(1.6, 1.6);
      const faceMat = new THREE.MeshStandardMaterial({
        map: createFaceTexture(faceNumber, selectedSkin),
        transparent: true,
        depthWrite: false,
        roughness: 0.2,
        metalness: 0.9,
        side: THREE.FrontSide, // Automatic backface culling hides numbers on the back!
      });

      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      // Place precisely on facet plane (slight epsilon 1.002 to prevent z-fighting)
      faceMesh.position.copy(center.clone().multiplyScalar(1.003));
      faceMesh.quaternion.copy(faceQuat);
      dieGroup.add(faceMesh);

      // Target camera view vector (tilted slightly up towards the viewer at (0, 0.35, 0.93))
      const targetFacing = new THREE.Vector3(0, 0.32, 0.95).normalize();
      // Quaternion to orient this face squarely towards the player
      const orientQuat = new THREE.Quaternion().setFromUnitVectors(normal, targetFacing);

      faceData.push({
        normal,
        targetQuat: orientQuat,
      });
    }
    faceDataRef.current = faceData;

    // 6. Impact Sparkles Particle System
    const particleCount = 140;
    const pGeom = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVel: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = 0;
      pPos[i * 3 + 1] = 0;
      pPos[i * 3 + 2] = 0;
      pVel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 4 + 1,
          (Math.random() - 0.5) * 5
        )
      );
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.16,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeom, pMat);
    scene.add(particles);
    particleSystemRef.current = particles;

    // 7. Mouse / Touch Drag Inspection
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevPointer = { x: clientX, y: clientY };
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dieGroupRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevPointer.x;
      const deltaY = clientY - prevPointer.y;
      prevPointer = { x: clientX, y: clientY };

      dieGroupRef.current.rotation.y += deltaX * 0.012;
      dieGroupRef.current.rotation.x += deltaY * 0.012;
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

    // Initial roll
    triggerRoll(targetResult);

    // 8. Physics Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;

      const p = physicsRef.current;
      const elapsed = (time - p.startTime) / 1000;

      if (p.isRolling && dieGroupRef.current) {
        if (elapsed < p.duration) {
          // Free tumble & bounce phase
          dieGroupRef.current.rotation.x += p.angularVelocity.x * delta;
          dieGroupRef.current.rotation.y += p.angularVelocity.y * delta;
          dieGroupRef.current.rotation.z += p.angularVelocity.z * delta;

          // Angular friction
          p.angularVelocity.multiplyScalar(0.978);

          // Tabletop vertical bounce
          p.velY -= 9.8 * delta; // gravity
          p.posY += p.velY * delta;
          if (p.posY <= 0) {
            p.posY = 0;
            p.velY = Math.abs(p.velY) * 0.42; // bounce damping
            if (p.velY > 0.3) {
              sfx.playClick();
            }
          }
          dieGroupRef.current.position.y = p.posY;
        } else {
          // Settle phase: smoothly slerp the target face directly into view!
          const targetIndex = Math.max(0, Math.min(19, p.currentRollNumber - 1));
          const targetQuat = faceDataRef.current[targetIndex]?.targetQuat;

          p.settleFactor = Math.min(1, p.settleFactor + delta * 3.5);
          if (targetQuat) {
            dieGroupRef.current.quaternion.slerp(targetQuat, p.settleFactor * 0.25);
          }
          dieGroupRef.current.position.y = THREE.MathUtils.lerp(
            dieGroupRef.current.position.y,
            0,
            delta * 8
          );

          if (p.settleFactor >= 0.98) {
            if (targetQuat) dieGroupRef.current.quaternion.copy(targetQuat);
            dieGroupRef.current.position.y = 0;
            p.isRolling = false;
            setIsRolling(false);
            setHasSettled(true);

            // Trigger particles & outcome sound
            const finalVal = p.currentRollNumber;
            if (pMat) {
              pMat.color.setHex(finalVal === 20 ? 0xffd700 : finalVal === 1 ? 0xff2222 : 0x38bdf8);
              pMat.opacity = 1.0;
            }
            if (finalVal === 20) {
              sfx.playSuccess(true);
            } else if (finalVal === 1) {
              sfx.playFail();
            } else {
              sfx.playSuccess(false);
            }

            if (onRollComplete) {
              onRollComplete(finalVal, finalVal + modifier);
            }
          }
        }
      } else if (!isDragging && dieGroupRef.current) {
        // Subtle ambient floating breathing
        dieGroupRef.current.position.y = Math.sin(time * 0.002) * 0.08;
      }

      // Shadow scales with die height
      if (shadowMeshRef.current && dieGroupRef.current) {
        const h = Math.max(0, dieGroupRef.current.position.y);
        const shadowScale = 1 / (1 + h * 0.5);
        shadowMeshRef.current.scale.set(shadowScale, shadowScale, 1);
        if (shadowMat) shadowMat.opacity = 0.7 * shadowScale;
      }

      // Particles decay
      if (pMat && pMat.opacity > 0.01) {
        pMat.opacity *= 0.93;
        const positions = pGeom.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += pVel[i].x * delta;
          positions[i * 3 + 1] += pVel[i].y * delta;
          positions[i * 3 + 2] += pVel[i].z * delta;
        }
        pGeom.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate(performance.now());

    // Cleanup
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
  }, [isOpen, selectedSkin]);

  if (!isOpen) return null;

  const total = currentRoll + modifier;
  const isCritSuccess = currentRoll === 20;
  const isCritFail = currentRoll === 1;
  const isSuccess = dc !== undefined ? total >= dc : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-amber-500/40 rounded-2xl shadow-[0_0_60px_rgba(217,119,6,0.3)] overflow-hidden flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stone-950 via-amber-950/50 to-stone-950 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="text-xl sm:text-2xl shrink-0">🎲</span>
            <div className="min-w-0">
              <h3 className="font-serif font-black text-amber-200 text-xs sm:text-sm tracking-wider uppercase truncate">
                {title}
              </h3>
              <p className="text-[10px] sm:text-xs text-stone-400 font-mono truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Skin Selector */}
            <div className="flex items-center gap-1 bg-stone-950/80 px-2 py-1 rounded-lg border border-stone-800">
              {(Object.keys(DICE_SKINS) as DiceSkin[]).map((skinKey) => (
                <button
                  key={skinKey}
                  onClick={() => setSelectedSkin(skinKey)}
                  title={DICE_SKINS[skinKey].name}
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border transition-transform ${
                    selectedSkin === skinKey ? 'scale-125 ring-2 ring-amber-400' : 'opacity-60'
                  }`}
                  style={{
                    backgroundColor: '#' + DICE_SKINS[skinKey].bodyColor.toString(16).padStart(6, '0'),
                    borderColor: '#' + DICE_SKINS[skinKey].edgeColor.toString(16).padStart(6, '0'),
                  }}
                />
              ))}
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-amber-300 p-1 rounded-lg hover:bg-stone-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 3D WebGL Canvas Tray Mount */}
        <div
          onClick={() => {
            if (!isRolling) triggerRoll();
          }}
          className="relative w-full h-[290px] sm:h-[360px] bg-gradient-to-b from-[#0a0f14] via-[#101920] to-[#0a0f14] flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden"
        >
          {/* Subtle Octagonal Dice Tray Border */}
          <div className="absolute inset-3 sm:inset-4 rounded-3xl border border-amber-500/15 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />

          <div ref={mountRef} className="w-full h-full" />

          {/* Tray Interaction Hint */}
          <div className="absolute top-2.5 sm:top-3 left-3 sm:left-4 text-[9px] sm:text-[10px] text-stone-400 font-mono pointer-events-none bg-stone-950/70 px-2 py-0.5 rounded border border-stone-800">
            {isRolling ? '🌀 Кувырок кубика...' : '🖐️ Вращайте • Клик — переброс'}
          </div>

          {/* Settled Result Card Overlay */}
          {hasSettled && (
            <div className="absolute bottom-4 inset-x-6 flex items-center justify-center pointer-events-none">
              <div
                className={`px-5 py-3 rounded-2xl border backdrop-blur-md flex items-center gap-4 shadow-2xl animate-in zoom-in-95 duration-200 ${
                  isCritSuccess
                    ? 'bg-amber-950/85 border-amber-400 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.4)]'
                    : isCritFail
                    ? 'bg-red-950/85 border-red-500 text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                    : isSuccess
                    ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-200'
                    : 'bg-stone-950/85 border-stone-700 text-stone-300'
                }`}
              >
                <div className="text-4xl font-serif font-black">{currentRoll}</div>
                <div className="text-left border-l border-white/15 pl-4">
                  <div className="text-xs font-bold leading-none tracking-wide">
                    {isCritSuccess
                      ? '🌟 НАТУРАЛЬНЫЕ 20 (КРИТИЧЕСКИЙ УСПЕХ)!'
                      : isCritFail
                      ? '💀 НАТУРАЛЬНАЯ 1 (КРИТИЧЕСКИЙ ПРОВАЛ)!'
                      : dc !== undefined
                      ? isSuccess
                        ? '✨ УСПЕШНАЯ ПРОВЕРКА'
                        : '❌ ПРОВАЛ ПРОВЕРКИ'
                      : 'БРОСОК ЗАВЕРШЁН'}
                  </div>
                  <div className="text-xs text-stone-300 mt-1 font-mono">
                    d20 ({currentRoll}) {modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`} ={' '}
                    <span className="font-bold text-amber-300 text-sm">{total}</span>
                    {dc !== undefined && (
                      <span className="text-stone-400 font-normal"> (СЛ {dc})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={() => triggerRoll()}
            disabled={isRolling}
            className="flex-1 py-2.5 px-4 rounded-xl border border-amber-500/40 bg-stone-900 hover:bg-stone-800 text-amber-200 font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>🎲</span>
            <span>Бросить снова</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>✓</span>
            <span>Принять бросок</span>
          </button>
        </div>
      </div>
    </div>
  );
};
