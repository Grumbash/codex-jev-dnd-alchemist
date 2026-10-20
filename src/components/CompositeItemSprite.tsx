import React, { useId, useMemo } from 'react';
import { ElementType, GameItem, Monster, Rarity } from '../types/game';

interface CompositeItemSpriteProps {
  item: GameItem;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompositeItemSpriteProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

interface ElementPalette {
  primary: string;
  secondary: string;
  glow: string;
  dark: string;
  rim: string;
}

const ELEMENT_PALETTES: Record<ElementType, ElementPalette> = {
  fire: {
    primary: '#ff5722',
    secondary: '#ffb300',
    glow: '#ff7043',
    dark: '#6d1b07',
    rim: '#ffe082',
  },
  cold: {
    primary: '#00bcd4',
    secondary: '#80deea',
    glow: '#26c6da',
    dark: '#004d61',
    rim: '#e0f7fa',
  },
  acid: {
    primary: '#76ff03',
    secondary: '#c6ff00',
    glow: '#aeea00',
    dark: '#1b4d00',
    rim: '#f4ff81',
  },
  poison: {
    primary: '#00e676',
    secondary: '#a5d6a7',
    glow: '#69f0ae',
    dark: '#004d25',
    rim: '#b9f6ca',
  },
  necrotic: {
    primary: '#8e24aa',
    secondary: '#ce93d8',
    glow: '#ab47bc',
    dark: '#230633',
    rim: '#f3e5f5',
  },
  radiant: {
    primary: '#ffca28',
    secondary: '#fff59d',
    glow: '#ffd54f',
    dark: '#6d4c00',
    rim: '#ffffff',
  },
  psychic: {
    primary: '#ec407a',
    secondary: '#f48fb1',
    glow: '#f06292',
    dark: '#4a0726',
    rim: '#fce4ec',
  },
  lightning: {
    primary: '#2979ff',
    secondary: '#82b1ff',
    glow: '#448aff',
    dark: '#0a1e5e',
    rim: '#e3f2fd',
  },
  force: {
    primary: '#651fff',
    secondary: '#b388ff',
    glow: '#7c4dff',
    dark: '#1c0557',
    rim: '#ede7f6',
  },
};

const RARITY_FRAME_COLORS: Record<Rarity, { border: string; bg: string; shard: string }> = {
  common: { border: '#52525b', bg: '#18181b', shard: '#71717a' },
  uncommon: { border: '#10b981', bg: '#052e16', shard: '#34d399' },
  rare: { border: '#3b82f6', bg: '#0c1e4a', shard: '#60a5fa' },
  very_rare: { border: '#a855f7', bg: '#2e1065', shard: '#c084fc' },
  legendary: { border: '#f59e0b', bg: '#451a03', shard: '#fbbf24' },
  artifact: { border: '#ef4444', bg: '#450a0a', shard: '#f87171' },
};

// ============================================================================
// 3D LOW-POLY FACET ENGINE UTILITIES
// ============================================================================

type Vec3 = [number, number, number];

type MaterialRole =
  | 'elementPrimary'
  | 'elementSecondary'
  | 'elementCore'
  | 'metalLight'
  | 'metalDark'
  | 'gold'
  | 'leather'
  | 'wood'
  | 'bone'
  | 'obsidian'
  | 'glass'
  | 'parchment'
  | 'effectAccent';

interface PolyFace3D {
  verts: [Vec3, Vec3, Vec3] | [Vec3, Vec3, Vec3, Vec3];
  mat: MaterialRole;
  layer: 1 | 2 | 3; // 1 = Back/Chassis, 2 = Main Blade/Body, 3 = Foreground Gems & Special Effect
  opacity?: number;
  facetBias?: number;
}

interface RenderedPolygon {
  points: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  zOrder: number;
  layer: 1 | 2 | 3;
  opacity: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(
    r1 + (r2 - r1) * clamped,
    g1 + (g2 - g1) * clamped,
    b1 + (b2 - b1) * clamped
  );
}

function shadeHex(hex: string, factor: number): string {
  if (factor >= 1) {
    return mixHex(hex, '#ffffff', Math.min(0.86, (factor - 1) * 0.78));
  }
  return mixHex('#06070b', hex, Math.max(0.14, factor));
}

function subVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normVec(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Creates a faceted 3D pyramid fan over a polygon ring towards an apex
 */
function makePyramidFaces(
  baseVerts: Vec3[],
  apex: Vec3,
  mat: MaterialRole,
  layer: 1 | 2 | 3,
  opacity = 1
): PolyFace3D[] {
  const faces: PolyFace3D[] = [];
  for (let i = 0; i < baseVerts.length; i++) {
    const next = baseVerts[(i + 1) % baseVerts.length];
    faces.push({
      verts: [baseVerts[i], next, apex],
      mat,
      layer,
      opacity,
      facetBias: ((i % 3) - 1) * 0.09,
    });
  }
  return faces;
}

/**
 * Creates a 6-facet 3D diamond/octahedron crystal at (cx, cy, cz)
 */
function makeOctahedronFaces(
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  mat: MaterialRole,
  layer: 1 | 2 | 3,
  opacity = 1
): PolyFace3D[] {
  const top: Vec3 = [cx, cy - ry, cz];
  const bot: Vec3 = [cx, cy + ry, cz];
  const left: Vec3 = [cx - rx, cy, cz];
  const right: Vec3 = [cx + rx, cy, cz];
  const front: Vec3 = [cx, cy, cz + rz];
  const back: Vec3 = [cx, cy, cz - rz * 0.5];

  return [
    { verts: [top, left, front], mat, layer, opacity, facetBias: 0.16 },
    { verts: [top, front, right], mat, layer, opacity, facetBias: -0.05 },
    { verts: [bot, front, left], mat, layer, opacity, facetBias: 0.02 },
    { verts: [bot, right, front], mat, layer, opacity, facetBias: -0.18 },
    { verts: [top, back, left], mat, layer, opacity, facetBias: 0.06 },
    { verts: [top, right, back], mat, layer, opacity, facetBias: -0.12 },
  ];
}

/**
 * Creates a segmented low-poly ridge strip (e.g. sword blade, whip, wand, horn, tentacle)
 */
function makeRidgeBladeFaces(
  spine: Array<{ x: number; y: number; z: number; w: number; skewY?: number }>,
  matLeft: MaterialRole,
  matRight: MaterialRole,
  layer: 1 | 2 | 3
): PolyFace3D[] {
  const faces: PolyFace3D[] = [];
  for (let i = 0; i < spine.length - 1; i++) {
    const cur = spine[i];
    const nxt = spine[i + 1];
    const curSkew = cur.skewY ?? 0;
    const nxtSkew = nxt.skewY ?? 0;

    const cMid: Vec3 = [cur.x, cur.y, cur.z];
    const cLeft: Vec3 = [cur.x - cur.w, cur.y + curSkew, 0];
    const cRight: Vec3 = [cur.x + cur.w, cur.y - curSkew, 0];

    const nMid: Vec3 = [nxt.x, nxt.y, nxt.z];
    const nLeft: Vec3 = [nxt.x - nxt.w, nxt.y + nxtSkew, 0];
    const nRight: Vec3 = [nxt.x + nxt.w, nxt.y - nxtSkew, 0];

    if (cur.w > 0.1 || nxt.w > 0.1) {
      faces.push({
        verts: [cLeft, cMid, nMid],
        mat: matLeft,
        layer,
        facetBias: 0.12 + (i % 2) * 0.06,
      });
      if (nxt.w > 0.1) {
        faces.push({
          verts: [cLeft, nMid, nLeft],
          mat: matLeft,
          layer,
          facetBias: 0.02 - (i % 2) * 0.05,
        });
      }
      faces.push({
        verts: [cMid, cRight, nMid],
        mat: matRight,
        layer,
        facetBias: -0.1 + (i % 2) * 0.05,
      });
      if (nxt.w > 0.1) {
        faces.push({
          verts: [cRight, nRight, nMid],
          mat: matRight,
          layer,
          facetBias: -0.2 - (i % 2) * 0.04,
        });
      }
    }
  }
  return faces;
}

function rotatePointAroundCenter(p: Vec3, degZ: number, tiltX = 0.12, tiltY = -0.14): Vec3 {
  const cx = 50;
  const cy = 50;
  const radZ = (degZ * Math.PI) / 180;
  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);

  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const dz = p[2];

  const rx = dx * cosZ - dy * sinZ;
  const ry = dx * sinZ + dy * cosZ;

  const px = cx + rx + dz * tiltY;
  const py = cy + ry - dz * tiltX;
  const pz = dz + rx * -0.15 + ry * -0.15;

  return [px, py, pz];
}

function projectAndShadeFaces(
  faces: PolyFace3D[],
  primaryPalette: ElementPalette,
  secondaryPalette: ElementPalette,
  degZ = 0
): RenderedPolygon[] {
  const keyLight: Vec3 = normVec([-0.55, -0.65, 0.75]);
  const rimLight: Vec3 = normVec([0.75, 0.45, 0.35]);

  const baseColors: Record<MaterialRole, string> = {
    elementPrimary: primaryPalette.primary,
    elementSecondary: secondaryPalette.primary,
    elementCore: mixHex(primaryPalette.secondary, '#ffffff', 0.4),
    metalLight: '#cbd5e1',
    metalDark: '#475569',
    gold: '#f59e0b',
    leather: '#78350f',
    wood: '#5c2d0c',
    bone: '#e7e5e4',
    obsidian: '#1e1b4b',
    glass: '#94a3b8',
    parchment: '#fde68a',
    effectAccent: secondaryPalette.glow,
  };

  return faces
    .map((face, idx) => {
      const transformed = face.verts.map((v) => rotatePointAroundCenter(v, degZ));
      const v0 = transformed[0];
      const v1 = transformed[1];
      const v2 = transformed[2];

      const e1 = subVec(v1, v0);
      const e2 = subVec(v2, v0);
      const rawN = normVec(crossVec(e1, e2));
      const n: Vec3 = normVec([rawN[0], rawN[1], Math.abs(rawN[2]) + 0.35]);

      const diffKey = Math.max(0, dotVec(n, keyLight));
      const diffRim = Math.max(0, dotVec(n, rimLight));

      const bias = face.facetBias ?? (((idx * 37) % 11) - 5) * 0.028;
      const shadeFactor = Math.max(
        0.34,
        Math.min(1.58, 0.5 + diffKey * 0.9 + bias)
      );

      let fill = shadeHex(baseColors[face.mat], shadeFactor);

      if (
        diffRim > 0.44 &&
        (face.mat === 'elementPrimary' ||
          face.mat === 'metalLight' ||
          face.mat === 'obsidian')
      ) {
        fill = mixHex(fill, secondaryPalette.rim, (diffRim - 0.44) * 0.58);
      }

      const isSpecular = diffKey > 0.77 && bias > 0;
      if (isSpecular) {
        fill = mixHex(fill, primaryPalette.rim, 0.36);
      }

      const stroke = isSpecular
        ? mixHex(fill, '#ffffff', 0.48)
        : shadeHex(fill, 0.65);

      const avgZ =
        transformed.reduce((acc, pt) => acc + pt[2], 0) / transformed.length;

      const points = transformed
        .map((pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`)
        .join(' ');

      return {
        points,
        fill,
        stroke,
        strokeWidth: face.layer === 3 ? 0.55 : 0.65,
        zOrder: face.layer * 100 + avgZ,
        layer: face.layer,
        opacity: face.opacity ?? 1,
      };
    })
    .sort((a, b) => a.zOrder - b.zOrder);
}

// ============================================================================
// CRAFTED ITEM ARCHETYPE LOW-POLY 3D MESHES (All 18 Station Archetypes)
// ============================================================================

function buildArchetypeLowPolyMesh(
  archetype: string
): { faces: PolyFace3D[]; rotationZ: number } {
  switch (archetype) {
    // --- BLACKSMITH ARCHETYPES ---
    case 'dagger': {
      const faces: PolyFace3D[] = [
        ...makeOctahedronFaces(50, 84, 6, 6, 6, 7, 'gold', 1),
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 65, z: 6, w: 3.5 },
            { x: 50, y: 78, z: 5, w: 3 },
          ],
          'leather',
          'leather',
          1
        ),
        { verts: [[50, 62, 7], [30, 56, 2], [41, 66, 3]], mat: 'gold', layer: 1, facetBias: 0.16 },
        { verts: [[50, 62, 7], [41, 66, 3], [50, 67, 5]], mat: 'gold', layer: 1, facetBias: -0.05 },
        { verts: [[50, 62, 7], [70, 56, 2], [59, 66, 3]], mat: 'gold', layer: 1, facetBias: -0.18 },
        { verts: [[50, 62, 7], [50, 67, 5], [59, 66, 3]], mat: 'gold', layer: 1, facetBias: -0.1 },
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 12, z: 2, w: 0 },
            { x: 50, y: 26, z: 12, w: 8.5 },
            { x: 50, y: 44, z: 14, w: 11 },
            { x: 50, y: 62, z: 9, w: 8 },
          ],
          'elementPrimary',
          'elementSecondary',
          2
        ),
        ...makeOctahedronFaces(50, 55, 13, 4.5, 6.5, 6, 'elementCore', 3),
      ];
      return { faces, rotationZ: 38 };
    }

    case 'longsword': {
      const faces: PolyFace3D[] = [
        ...makeOctahedronFaces(50, 90, 7, 6.5, 5.5, 7, 'gold', 1),
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 67, z: 6, w: 3.8 },
            { x: 50, y: 78, z: 6, w: 3.2 },
            { x: 50, y: 86, z: 5, w: 3.5 },
          ],
          'leather',
          'obsidian',
          1
        ),
        // Swept winged crossguard
        { verts: [[50, 64, 9], [22, 56, 3], [34, 66, 4]], mat: 'gold', layer: 1, facetBias: 0.18 },
        { verts: [[50, 64, 9], [34, 66, 4], [50, 69, 6]], mat: 'gold', layer: 1, facetBias: 0.04 },
        { verts: [[50, 64, 9], [78, 56, 3], [66, 66, 4]], mat: 'gold', layer: 1, facetBias: -0.16 },
        { verts: [[50, 64, 9], [50, 69, 6], [66, 66, 4]], mat: 'gold', layer: 1, facetBias: -0.08 },
        // Multi-segmented diamond-ridge longsword blade
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 7, z: 3, w: 0 },
            { x: 50, y: 18, z: 13, w: 8.5 },
            { x: 50, y: 34, z: 15, w: 8 },
            { x: 50, y: 50, z: 15, w: 9.5 },
            { x: 50, y: 64, z: 11, w: 10 },
          ],
          'elementPrimary',
          'elementSecondary',
          2
        ),
        ...makeOctahedronFaces(50, 64, 13, 5.5, 5.5, 7, 'elementCore', 3),
        ...makeOctahedronFaces(50, 44, 16, 3.5, 6, 5, 'elementCore', 3),
      ];
      return { faces, rotationZ: 38 };
    }

    case 'warhammer': {
      const faces: PolyFace3D[] = [
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 12, z: 7, w: 0 },
            { x: 50, y: 22, z: 8, w: 4 },
            { x: 50, y: 88, z: 6, w: 4 },
          ],
          'wood',
          'leather',
          1
        ),
        ...makeOctahedronFaces(50, 90, 6, 5.5, 5, 6, 'gold', 1),
        // Colossal Low-Poly Prism Hammer Head (Layer 2)
        { verts: [[22, 24, 6], [50, 22, 14], [50, 34, 16]], mat: 'metalLight', layer: 2, facetBias: 0.16 },
        { verts: [[22, 24, 6], [50, 34, 16], [20, 34, 11]], mat: 'elementPrimary', layer: 2, facetBias: 0.2 },
        { verts: [[20, 34, 11], [50, 34, 16], [50, 46, 14]], mat: 'metalDark', layer: 2, facetBias: -0.06 },
        { verts: [[20, 34, 11], [50, 46, 14], [22, 44, 6]], mat: 'elementPrimary', layer: 2, facetBias: 0.04 },

        { verts: [[50, 22, 14], [78, 24, 6], [50, 34, 16]], mat: 'metalDark', layer: 2, facetBias: -0.05 },
        { verts: [[78, 24, 6], [80, 34, 11], [50, 34, 16]], mat: 'elementSecondary', layer: 2, facetBias: -0.1 },
        { verts: [[50, 34, 16], [80, 34, 11], [50, 46, 14]], mat: 'obsidian', layer: 2, facetBias: -0.18 },
        { verts: [[80, 34, 11], [78, 44, 6], [50, 46, 14]], mat: 'elementSecondary', layer: 2, facetBias: -0.22 },

        ...makePyramidFaces(
          [[22, 24, 6], [20, 34, 11], [22, 44, 6], [22, 34, 1]],
          [11, 34, 5],
          'elementCore',
          2
        ),
        ...makePyramidFaces(
          [[78, 24, 6], [80, 34, 11], [78, 44, 6], [78, 34, 1]],
          [91, 36, 3],
          'elementSecondary',
          2
        ),
        ...makeOctahedronFaces(50, 34, 18, 7, 7, 6, 'elementCore', 3),
      ];
      return { faces, rotationZ: 32 };
    }

    case 'whip': {
      // Barbed Segmented Low-Poly Monster-Spine Lash Whip
      const faces: PolyFace3D[] = [
        // Grip handle (Layer 1)
        ...makeOctahedronFaces(24, 84, 7, 5, 5, 6, 'gold', 1),
        ...makeRidgeBladeFaces(
          [
            { x: 24, y: 64, z: 8, w: 4 },
            { x: 24, y: 80, z: 6, w: 3.5 },
          ],
          'leather',
          'obsidian',
          1
        ),
        // Coiled S-curve segmented whip lash (Layer 2)
        ...makeRidgeBladeFaces(
          [
            { x: 24, y: 64, z: 9, w: 4.5 },
            { x: 22, y: 38, z: 12, w: 5, skewY: 3 },
            { x: 42, y: 20, z: 15, w: 5.5, skewY: -2 },
            { x: 68, y: 28, z: 14, w: 5, skewY: 3 },
            { x: 76, y: 54, z: 13, w: 4.5, skewY: -3 },
            { x: 56, y: 74, z: 15, w: 4, skewY: 2 },
            { x: 46, y: 52, z: 18, w: 0 },
          ],
          'elementPrimary',
          'elementSecondary',
          2
        ),
        // Razor Barbs along the whip & Stinger Tip (Layer 3)
        ...makeOctahedronFaces(42, 20, 17, 4, 6, 5, 'elementCore', 3),
        ...makeOctahedronFaces(76, 54, 16, 4, 6, 5, 'elementCore', 3),
        ...makeOctahedronFaces(46, 52, 20, 6, 8, 6, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'breastplate': {
      const faces: PolyFace3D[] = [
        // Pauldrons (Layer 1)
        { verts: [[34, 22, 8], [12, 30, 4], [20, 46, 9]], mat: 'gold', layer: 1, facetBias: 0.2 },
        { verts: [[34, 22, 8], [20, 46, 9], [34, 42, 11]], mat: 'metalLight', layer: 1, facetBias: 0.1 },
        { verts: [[66, 22, 8], [80, 46, 9], [88, 30, 4]], mat: 'gold', layer: 1, facetBias: -0.15 },
        { verts: [[66, 22, 8], [66, 42, 11], [80, 46, 9]], mat: 'metalDark', layer: 1, facetBias: -0.2 },
        // Faceted Dragon-Scale Cuirass Torso (Layer 2)
        { verts: [[34, 22, 8], [50, 28, 14], [34, 42, 11]], mat: 'elementPrimary', layer: 2, facetBias: 0.16 },
        { verts: [[66, 22, 8], [66, 42, 11], [50, 28, 14]], mat: 'elementSecondary', layer: 2, facetBias: -0.1 },
        { verts: [[34, 42, 11], [50, 28, 14], [50, 50, 17]], mat: 'elementPrimary', layer: 2, facetBias: 0.18 },
        { verts: [[66, 42, 11], [50, 50, 17], [50, 28, 14]], mat: 'elementSecondary', layer: 2, facetBias: -0.12 },
        { verts: [[34, 42, 11], [50, 50, 17], [28, 62, 9]], mat: 'elementSecondary', layer: 2, facetBias: 0.08 },
        { verts: [[66, 42, 11], [72, 62, 9], [50, 50, 17]], mat: 'elementPrimary', layer: 2, facetBias: -0.16 },
        { verts: [[28, 62, 9], [50, 50, 17], [50, 72, 14]], mat: 'elementPrimary', layer: 2, facetBias: 0.04 },
        { verts: [[72, 62, 9], [50, 72, 14], [50, 50, 17]], mat: 'elementSecondary', layer: 2, facetBias: -0.18 },
        // Waist Tassets
        { verts: [[28, 62, 9], [50, 72, 14], [32, 84, 5]], mat: 'gold', layer: 2, facetBias: 0.05 },
        { verts: [[32, 84, 5], [50, 72, 14], [50, 88, 8]], mat: 'metalLight', layer: 2, facetBias: -0.02 },
        { verts: [[72, 62, 9], [68, 84, 5], [50, 72, 14]], mat: 'gold', layer: 2, facetBias: -0.15 },
        { verts: [[68, 84, 5], [50, 88, 8], [50, 72, 14]], mat: 'metalDark', layer: 2, facetBias: -0.22 },
        // Chest Core Gem (Layer 3)
        ...makeOctahedronFaces(50, 44, 19, 8, 10, 7, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'shield': {
      const faces: PolyFace3D[] = [
        { verts: [[50, 14, 10], [20, 22, 3], [32, 32, 11]], mat: 'gold', layer: 1, facetBias: 0.2 },
        { verts: [[50, 14, 10], [32, 32, 11], [50, 28, 13]], mat: 'gold', layer: 1, facetBias: 0.1 },
        { verts: [[50, 14, 10], [50, 28, 13], [68, 32, 11]], mat: 'gold', layer: 1, facetBias: -0.06 },
        { verts: [[50, 14, 10], [68, 32, 11], [80, 22, 3]], mat: 'gold', layer: 1, facetBias: -0.14 },

        { verts: [[20, 22, 3], [22, 56, 3], [32, 32, 11]], mat: 'metalLight', layer: 1, facetBias: 0.16 },
        { verts: [[22, 56, 3], [34, 58, 10], [32, 32, 11]], mat: 'metalLight', layer: 1, facetBias: 0.08 },
        { verts: [[22, 56, 3], [50, 88, 5], [34, 58, 10]], mat: 'metalLight', layer: 1, facetBias: 0.02 },

        { verts: [[80, 22, 3], [68, 32, 11], [78, 56, 3]], mat: 'metalDark', layer: 1, facetBias: -0.14 },
        { verts: [[78, 56, 3], [68, 32, 11], [66, 58, 10]], mat: 'metalDark', layer: 1, facetBias: -0.18 },
        { verts: [[78, 56, 3], [66, 58, 10], [50, 88, 5]], mat: 'metalDark', layer: 1, facetBias: -0.22 },

        { verts: [[50, 28, 13], [32, 32, 11], [50, 48, 18]], mat: 'elementPrimary', layer: 2, facetBias: 0.18 },
        { verts: [[32, 32, 11], [34, 58, 10], [50, 48, 18]], mat: 'elementPrimary', layer: 2, facetBias: 0.08 },
        { verts: [[34, 58, 10], [50, 88, 5], [50, 48, 18]], mat: 'elementSecondary', layer: 2, facetBias: -0.02 },

        { verts: [[50, 28, 13], [50, 48, 18], [68, 32, 11]], mat: 'elementSecondary', layer: 2, facetBias: -0.06 },
        { verts: [[68, 32, 11], [50, 48, 18], [66, 58, 10]], mat: 'elementPrimary', layer: 2, facetBias: -0.14 },
        { verts: [[66, 58, 10], [50, 48, 18], [50, 88, 5]], mat: 'elementSecondary', layer: 2, facetBias: -0.2 },

        ...makeOctahedronFaces(50, 48, 20, 10, 12, 8, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    // --- ARTIFICER ARCHETYPES ---
    case 'ring': {
      const faces: PolyFace3D[] = [
        { verts: [[28, 42, 6], [18, 58, 4], [30, 58, 10]], mat: 'gold', layer: 1, facetBias: 0.18 },
        { verts: [[18, 58, 4], [26, 78, 4], [34, 70, 10]], mat: 'gold', layer: 1, facetBias: 0.1 },
        { verts: [[18, 58, 4], [34, 70, 10], [30, 58, 10]], mat: 'gold', layer: 1, facetBias: 0.04 },
        { verts: [[26, 78, 4], [50, 86, 6], [50, 74, 11]], mat: 'gold', layer: 2, facetBias: -0.02 },
        { verts: [[26, 78, 4], [50, 74, 11], [34, 70, 10]], mat: 'gold', layer: 2, facetBias: 0.05 },

        { verts: [[72, 42, 6], [70, 58, 10], [82, 58, 4]], mat: 'gold', layer: 1, facetBias: -0.14 },
        { verts: [[82, 58, 4], [66, 70, 10], [74, 78, 4]], mat: 'gold', layer: 1, facetBias: -0.18 },
        { verts: [[82, 58, 4], [70, 58, 10], [66, 70, 10]], mat: 'gold', layer: 1, facetBias: -0.12 },
        { verts: [[74, 78, 4], [50, 74, 11], [50, 86, 6]], mat: 'gold', layer: 2, facetBias: -0.22 },
        { verts: [[74, 78, 4], [66, 70, 10], [50, 74, 11]], mat: 'gold', layer: 2, facetBias: -0.16 },

        { verts: [[28, 42, 6], [30, 58, 10], [42, 42, 12]], mat: 'metalLight', layer: 2, facetBias: 0.15 },
        { verts: [[72, 42, 6], [58, 42, 12], [70, 58, 10]], mat: 'metalDark', layer: 2, facetBias: -0.15 },

        ...makeOctahedronFaces(50, 32, 16, 18, 16, 12, 'elementPrimary', 3),
        ...makeOctahedronFaces(50, 30, 21, 10, 9, 8, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'wand': {
      const faces: PolyFace3D[] = [
        ...makeRidgeBladeFaces(
          [
            { x: 50, y: 30, z: 9, w: 4.5 },
            { x: 50, y: 58, z: 8, w: 3.5 },
            { x: 50, y: 88, z: 5, w: 2.5 },
          ],
          'obsidian',
          'gold',
          1
        ),
        ...makeOctahedronFaces(50, 56, 10, 5.5, 3, 5, 'gold', 2),
        ...makeOctahedronFaces(50, 74, 8, 4.5, 2.5, 4, 'gold', 2),
        ...makeOctahedronFaces(50, 22, 14, 13, 14, 12, 'elementPrimary', 2),
        ...makeOctahedronFaces(50, 22, 18, 7, 8, 9, 'elementCore', 3),
        ...makeOctahedronFaces(31, 18, 10, 4, 5, 4, 'elementSecondary', 3),
        ...makeOctahedronFaces(69, 18, 10, 4, 5, 4, 'elementSecondary', 3),
      ];
      return { faces, rotationZ: 36 };
    }

    case 'amulet': {
      const faces: PolyFace3D[] = [
        { verts: [[30, 14, 3], [22, 34, 4], [28, 36, 6]], mat: 'gold', layer: 1, facetBias: 0.15 },
        { verts: [[22, 34, 4], [36, 50, 6], [40, 44, 8]], mat: 'gold', layer: 1, facetBias: 0.08 },
        { verts: [[70, 14, 3], [72, 36, 6], [78, 34, 4]], mat: 'gold', layer: 1, facetBias: -0.12 },
        { verts: [[78, 34, 4], [60, 44, 8], [64, 50, 6]], mat: 'gold', layer: 1, facetBias: -0.18 },

        ...makePyramidFaces(
          [
            [50, 34, 7],
            [68, 42, 7],
            [74, 60, 7],
            [64, 78, 7],
            [50, 86, 7],
            [36, 78, 7],
            [26, 60, 7],
            [32, 42, 7],
          ],
          [50, 60, 16],
          'gold',
          2
        ),
        ...makeOctahedronFaces(50, 60, 18, 15, 19, 11, 'elementPrimary', 3),
        ...makeOctahedronFaces(50, 60, 23, 8, 11, 7, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'cloak': {
      const faces: PolyFace3D[] = [
        { verts: [[50, 12, 12], [28, 24, 6], [38, 32, 13]], mat: 'obsidian', layer: 1, facetBias: 0.16 },
        { verts: [[50, 12, 12], [38, 32, 13], [50, 28, 15]], mat: 'elementPrimary', layer: 1, facetBias: 0.22 },
        { verts: [[50, 12, 12], [50, 28, 15], [62, 32, 13]], mat: 'elementSecondary', layer: 1, facetBias: -0.08 },
        { verts: [[50, 12, 12], [62, 32, 13], [72, 24, 6]], mat: 'obsidian', layer: 1, facetBias: -0.18 },

        { verts: [[28, 24, 6], [16, 58, 4], [36, 56, 12]], mat: 'elementPrimary', layer: 2, facetBias: 0.18 },
        { verts: [[28, 24, 6], [36, 56, 12], [38, 32, 13]], mat: 'elementPrimary', layer: 2, facetBias: 0.1 },
        { verts: [[38, 32, 13], [36, 56, 12], [50, 60, 8]], mat: 'obsidian', layer: 2, facetBias: -0.06 },
        { verts: [[38, 32, 13], [50, 60, 8], [50, 28, 15]], mat: 'elementSecondary', layer: 2, facetBias: 0.04 },

        { verts: [[50, 28, 15], [50, 60, 8], [62, 32, 13]], mat: 'elementPrimary', layer: 2, facetBias: -0.08 },
        { verts: [[62, 32, 13], [50, 60, 8], [64, 56, 12]], mat: 'obsidian', layer: 2, facetBias: -0.16 },
        { verts: [[72, 24, 6], [62, 32, 13], [64, 56, 12]], mat: 'elementSecondary', layer: 2, facetBias: -0.12 },
        { verts: [[72, 24, 6], [64, 56, 12], [84, 58, 4]], mat: 'elementPrimary', layer: 2, facetBias: -0.22 },

        { verts: [[16, 58, 4], [22, 86, 2], [36, 56, 12]], mat: 'elementSecondary', layer: 2, facetBias: 0.12 },
        { verts: [[22, 86, 2], [40, 88, 7], [36, 56, 12]], mat: 'elementPrimary', layer: 2, facetBias: 0.02 },
        { verts: [[36, 56, 12], [40, 88, 7], [50, 60, 8]], mat: 'obsidian', layer: 2, facetBias: -0.1 },
        { verts: [[50, 60, 8], [60, 88, 7], [64, 56, 12]], mat: 'obsidian', layer: 2, facetBias: -0.14 },
        { verts: [[64, 56, 12], [60, 88, 7], [78, 86, 2]], mat: 'elementSecondary', layer: 2, facetBias: -0.18 },
        { verts: [[64, 56, 12], [78, 86, 2], [84, 58, 4]], mat: 'elementPrimary', layer: 2, facetBias: -0.24 },

        ...makeOctahedronFaces(50, 34, 18, 8, 6, 7, 'gold', 3),
        ...makeOctahedronFaces(50, 34, 21, 4.5, 4, 5, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'orb': {
      const cx = 50;
      const cy = 50;
      const r = 24;
      const ringPts: Vec3[] = [
        [cx, cy - r, 4],
        [cx + r * 0.7, cy - r * 0.7, 6],
        [cx + r, cy, 4],
        [cx + r * 0.7, cy + r * 0.7, 6],
        [cx, cy + r, 4],
        [cx - r * 0.7, cy + r * 0.7, 6],
        [cx - r, cy, 4],
        [cx - r * 0.7, cy - r * 0.7, 6],
      ];
      const innerPts: Vec3[] = [
        [cx, cy - r * 0.48, 18],
        [cx + r * 0.48, cy, 18],
        [cx, cy + r * 0.48, 18],
        [cx - r * 0.48, cy, 18],
      ];
      const apex: Vec3 = [cx, cy, 24];

      const faces: PolyFace3D[] = [
        { verts: [[34, 82, 4], [66, 82, 4], [50, 72, 10]], mat: 'gold', layer: 1, facetBias: 0.1 },
        { verts: [[28, 88, 2], [72, 88, 2], [50, 78, 8]], mat: 'obsidian', layer: 1, facetBias: -0.12 },
        { verts: [ringPts[0], ringPts[1], innerPts[0]], mat: 'elementPrimary', layer: 2, facetBias: 0.2 },
        { verts: [ringPts[1], innerPts[1], innerPts[0]], mat: 'elementSecondary', layer: 2, facetBias: 0.08 },
        { verts: [ringPts[1], ringPts[2], innerPts[1]], mat: 'elementPrimary', layer: 2, facetBias: -0.04 },
        { verts: [ringPts[2], ringPts[3], innerPts[1]], mat: 'elementSecondary', layer: 2, facetBias: -0.14 },
        { verts: [ringPts[3], innerPts[2], innerPts[1]], mat: 'elementPrimary', layer: 2, facetBias: -0.18 },
        { verts: [ringPts[3], ringPts[4], innerPts[2]], mat: 'elementSecondary', layer: 2, facetBias: -0.22 },
        { verts: [ringPts[4], ringPts[5], innerPts[2]], mat: 'elementPrimary', layer: 2, facetBias: -0.12 },
        { verts: [ringPts[5], innerPts[3], innerPts[2]], mat: 'elementSecondary', layer: 2, facetBias: -0.02 },
        { verts: [ringPts[5], ringPts[6], innerPts[3]], mat: 'elementPrimary', layer: 2, facetBias: 0.08 },
        { verts: [ringPts[6], ringPts[7], innerPts[3]], mat: 'elementSecondary', layer: 2, facetBias: 0.18 },
        { verts: [ringPts[7], innerPts[0], innerPts[3]], mat: 'elementCore', layer: 2, facetBias: 0.25 },
        { verts: [ringPts[7], ringPts[0], innerPts[0]], mat: 'elementPrimary', layer: 2, facetBias: 0.22 },
        ...makePyramidFaces(innerPts, apex, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'scroll': {
      // Low-Poly Unfurled Runic Scroll with Wooden Rollers & Floating Sigil Crystal
      const faces: PolyFace3D[] = [
        // Top & Bottom Gold-Tipped Rollers (Layer 1)
        ...makeRidgeBladeFaces(
          [
            { x: 20, y: 20, z: 10, w: 4 },
            { x: 80, y: 20, z: 10, w: 4 },
          ],
          'gold',
          'wood',
          1
        ),
        ...makeRidgeBladeFaces(
          [
            { x: 20, y: 80, z: 10, w: 4 },
            { x: 80, y: 80, z: 10, w: 4 },
          ],
          'wood',
          'gold',
          1
        ),
        // Faceted Parchment Sheet (Layer 2)
        { verts: [[26, 22, 8], [50, 24, 13], [28, 50, 11]], mat: 'parchment', layer: 2, facetBias: 0.18 },
        { verts: [[50, 24, 13], [74, 22, 8], [72, 50, 11]], mat: 'parchment', layer: 2, facetBias: -0.06 },
        { verts: [[50, 24, 13], [72, 50, 11], [28, 50, 11]], mat: 'parchment', layer: 2, facetBias: 0.08 },
        { verts: [[28, 50, 11], [72, 50, 11], [50, 76, 13]], mat: 'parchment', layer: 2, facetBias: 0.02 },
        { verts: [[28, 50, 11], [50, 76, 13], [26, 78, 8]], mat: 'parchment', layer: 2, facetBias: -0.08 },
        { verts: [[72, 50, 11], [74, 78, 8], [50, 76, 13]], mat: 'parchment', layer: 2, facetBias: -0.16 },
        // Glowing Runic Sigil Crystal on Scroll (Layer 3)
        ...makeOctahedronFaces(50, 50, 18, 12, 16, 8, 'elementPrimary', 3),
        ...makeOctahedronFaces(50, 50, 22, 6, 9, 6, 'elementCore', 3),
      ];
      return { faces, rotationZ: -12 };
    }

    // --- ALCHEMIST ARCHETYPES ---
    case 'volatile_bomb': {
      // Faceted Spiked Alchemical Grenade Sphere + Burning Fuse
      const orbFaces = buildArchetypeLowPolyMesh('orb').faces.filter((f) => f.layer >= 2);
      const faces: PolyFace3D[] = [
        // Bronze Neck & Burning Fuse Spark (Layer 1 & 3)
        { verts: [[40, 26, 8], [60, 26, 8], [50, 16, 12]], mat: 'gold', layer: 1, facetBias: 0.14 },
        ...makeOctahedronFaces(58, 10, 18, 7, 7, 7, 'elementCore', 3),
        ...makeOctahedronFaces(68, 8, 16, 4, 4, 4, 'elementSecondary', 3),
        // Iron & Elemental Bomb Casing (Layer 2)
        ...orbFaces.map((f, i) => ({
          ...f,
          mat: (i % 2 === 0 ? 'obsidian' : 'elementPrimary') as MaterialRole,
        })),
        // Glowing Fissure Core (Layer 3)
        ...makeOctahedronFaces(50, 52, 24, 9, 9, 7, 'elementCore', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'mutagen_elixir': {
      // Double-Helix Crystalline Vial
      const faces: PolyFace3D[] = [
        ...makeOctahedronFaces(50, 12, 8, 6, 5, 6, 'gold', 1),
        // Left Helix Strand (Layer 2)
        ...makeRidgeBladeFaces(
          [
            { x: 34, y: 22, z: 12, w: 5 },
            { x: 64, y: 42, z: 16, w: 6 },
            { x: 34, y: 64, z: 14, w: 6 },
            { x: 58, y: 84, z: 10, w: 4 },
          ],
          'elementPrimary',
          'glass',
          2
        ),
        // Right Helix Strand (Layer 2)
        ...makeRidgeBladeFaces(
          [
            { x: 66, y: 22, z: 10, w: 5 },
            { x: 36, y: 42, z: 14, w: 6 },
            { x: 66, y: 64, z: 16, w: 6 },
            { x: 42, y: 84, z: 12, w: 4 },
          ],
          'elementSecondary',
          'elementCore',
          2
        ),
        // Helix Rung Nodes (Layer 3)
        ...makeOctahedronFaces(50, 32, 18, 5, 4, 5, 'elementCore', 3),
        ...makeOctahedronFaces(50, 53, 19, 6, 4, 6, 'elementCore', 3),
        ...makeOctahedronFaces(50, 74, 17, 5, 4, 5, 'elementCore', 3),
      ];
      return { faces, rotationZ: 12 };
    }

    case 'deadly_poison': {
      // Skull-Shaped Crystalline Venom Flask
      const faces: PolyFace3D[] = [
        ...makeOctahedronFaces(50, 12, 8, 6, 5, 6, 'obsidian', 1),
        { verts: [[38, 18, 8], [62, 18, 8], [50, 28, 12]], mat: 'gold', layer: 1 },
        // Skull Flask Body (Layer 2)
        ...makePyramidFaces(
          [
            [30, 28, 8],
            [70, 28, 8],
            [78, 52, 8],
            [64, 84, 8],
            [36, 84, 8],
            [22, 52, 8],
          ],
          [50, 54, 19],
          'elementPrimary',
          2
        ),
        // Glowing Toxic Eye Sockets & Jaw (Layer 3)
        ...makeOctahedronFaces(38, 48, 21, 6, 5, 5, 'elementCore', 3),
        ...makeOctahedronFaces(62, 48, 21, 6, 5, 5, 'elementCore', 3),
        ...makeOctahedronFaces(50, 68, 20, 8, 5, 4, 'obsidian', 3),
      ];
      return { faces, rotationZ: 0 };
    }

    case 'weapon_oil':
    case 'astral_solvent':
    case 'healing_draught':
    default: {
      // Multi-faceted Alchemical Crystal Decanter with Glowing Potion Liquid Inside
      const faces: PolyFace3D[] = [
        ...makeOctahedronFaces(50, 14, 8, 6, 5, 6, 'leather', 1),
        { verts: [[38, 20, 8], [62, 20, 8], [50, 28, 12]], mat: 'gold', layer: 1, facetBias: 0.15 },

        // Upper Glass Facets (Layer 2)
        { verts: [[42, 24, 9], [50, 28, 12], [24, 48, 8]], mat: 'glass', layer: 2, opacity: 0.72, facetBias: 0.24 },
        { verts: [[24, 48, 8], [50, 28, 12], [50, 50, 16]], mat: 'glass', layer: 2, opacity: 0.65, facetBias: 0.14 },
        { verts: [[58, 24, 9], [76, 48, 8], [50, 28, 12]], mat: 'glass', layer: 2, opacity: 0.6, facetBias: -0.08 },
        { verts: [[50, 28, 12], [76, 48, 8], [50, 50, 16]], mat: 'glass', layer: 2, opacity: 0.55, facetBias: -0.16 },

        // Glowing Low-Poly Potion Liquid Inside (Layer 2 & 3)
        { verts: [[24, 48, 8], [50, 50, 16], [20, 68, 9]], mat: 'elementPrimary', layer: 2, facetBias: 0.2 },
        { verts: [[20, 68, 9], [50, 50, 16], [50, 70, 18]], mat: 'elementCore', layer: 3, facetBias: 0.26 },
        { verts: [[50, 50, 16], [76, 48, 8], [80, 68, 9]], mat: 'elementSecondary', layer: 2, facetBias: -0.06 },
        { verts: [[50, 50, 16], [80, 68, 9], [50, 70, 18]], mat: 'elementPrimary', layer: 3, facetBias: -0.12 },

        // Bottom Crystal Base
        { verts: [[20, 68, 9], [50, 70, 18], [34, 86, 7]], mat: 'elementPrimary', layer: 2, facetBias: 0.08 },
        { verts: [[34, 86, 7], [50, 70, 18], [50, 88, 10]], mat: 'elementSecondary', layer: 2, facetBias: -0.04 },
        { verts: [[80, 68, 9], [66, 86, 7], [50, 70, 18]], mat: 'elementSecondary', layer: 2, facetBias: -0.16 },
        { verts: [[66, 86, 7], [50, 88, 10], [50, 70, 18]], mat: 'elementPrimary', layer: 2, facetBias: -0.22 },
      ];
      return { faces, rotationZ: 0 };
    }
  }
}

// ============================================================================
// REAGENT / MONSTER ORGAN LOW-POLY 3D MESHES (By MaterialTag & ID)
// ============================================================================

function buildReagentLowPolyMesh(item: GameItem): { faces: PolyFace3D[]; rotationZ: number } {
  const mat = item.material;
  const id = item.id.toLowerCase();

  if (mat === 'eye' || id.includes('eye') || id.includes('lens') || id.includes('stalk')) {
    const orb = buildArchetypeLowPolyMesh('orb').faces.filter((f) => f.layer >= 2);
    const faces: PolyFace3D[] = [
      { verts: [[34, 70, 2], [18, 90, 0], [42, 76, 4]], mat: 'elementSecondary', layer: 1, facetBias: -0.1 },
      { verts: [[66, 70, 2], [58, 76, 4], [82, 90, 0]], mat: 'elementSecondary', layer: 1, facetBias: -0.15 },
      ...orb.map((f) => ({ ...f, mat: (f.layer === 3 ? 'elementPrimary' : 'bone') as MaterialRole })),
      ...makeOctahedronFaces(50, 50, 26, 4.5, 14, 5, 'obsidian', 3),
    ];
    return { faces, rotationZ: 0 };
  }

  if (
    id.includes('claw') ||
    id.includes('spike') ||
    id.includes('splinter') ||
    id.includes('tentacle') ||
    id.includes('tongue')
  ) {
    const faces: PolyFace3D[] = [
      { verts: [[26, 76, 8], [54, 86, 8], [38, 66, 12]], mat: 'elementSecondary', layer: 1, facetBias: 0.12 },
      { verts: [[26, 76, 8], [34, 90, 4], [54, 86, 8]], mat: 'obsidian', layer: 1, facetBias: -0.16 },
      ...makeRidgeBladeFaces(
        [
          { x: 68, y: 12, z: 4, w: 0 },
          { x: 58, y: 24, z: 12, w: 6, skewY: 3 },
          { x: 48, y: 42, z: 15, w: 10, skewY: 4 },
          { x: 42, y: 60, z: 14, w: 12, skewY: 4 },
          { x: 40, y: 78, z: 10, w: 13, skewY: 3 },
        ],
        mat === 'bone' ? 'bone' : 'elementPrimary',
        'elementSecondary',
        2
      ),
      ...makeOctahedronFaces(72, 26, 14, 4.5, 7, 5, 'elementCore', 3),
    ];
    return { faces, rotationZ: 0 };
  }

  if (mat === 'scale' || mat === 'chitin' || mat === 'hide') {
    const faces: PolyFace3D[] = [
      ...makePyramidFaces(
        [[14, 34, 2], [42, 24, 4], [44, 56, 6], [18, 64, 2]],
        [28, 44, 12],
        'elementSecondary',
        1
      ),
      ...makePyramidFaces(
        [[58, 24, 4], [86, 34, 2], [82, 64, 2], [56, 56, 6]],
        [72, 44, 12],
        'elementSecondary',
        1
      ),
      ...makePyramidFaces(
        [[50, 14, 8], [76, 36, 8], [68, 72, 8], [50, 88, 6], [32, 72, 8], [24, 36, 8]],
        [50, 52, 20],
        'elementPrimary',
        2
      ),
      ...makeOctahedronFaces(50, 48, 22, 6, 14, 6, 'elementCore', 3),
    ];
    return { faces, rotationZ: 0 };
  }

  if (mat === 'bone') {
    const faces: PolyFace3D[] = [
      { verts: [[28, 30, 6], [10, 12, 2], [22, 40, 6]], mat: 'obsidian', layer: 1, facetBias: 0.16 },
      { verts: [[72, 30, 6], [78, 40, 6], [90, 12, 2]], mat: 'obsidian', layer: 1, facetBias: -0.16 },
      { verts: [[50, 18, 12], [26, 30, 8], [50, 44, 18]], mat: 'bone', layer: 2, facetBias: 0.2 },
      { verts: [[50, 18, 12], [50, 44, 18], [74, 30, 8]], mat: 'bone', layer: 2, facetBias: -0.06 },
      { verts: [[26, 30, 8], [24, 56, 8], [50, 44, 18]], mat: 'bone', layer: 2, facetBias: 0.08 },
      { verts: [[74, 30, 8], [50, 44, 18], [76, 56, 8]], mat: 'bone', layer: 2, facetBias: -0.14 },
      { verts: [[24, 56, 8], [36, 78, 9], [50, 62, 16]], mat: 'bone', layer: 2, facetBias: 0.02 },
      { verts: [[76, 56, 8], [50, 62, 16], [64, 78, 9]], mat: 'bone', layer: 2, facetBias: -0.18 },
      { verts: [[36, 78, 9], [64, 78, 9], [50, 62, 16]], mat: 'elementPrimary', layer: 2, facetBias: -0.08 },
      ...makeOctahedronFaces(36, 48, 18, 6, 5, 5, 'elementCore', 3),
      ...makeOctahedronFaces(64, 48, 18, 6, 5, 5, 'elementCore', 3),
    ];
    return { faces, rotationZ: 0 };
  }

  if (mat === 'ooze' || mat === 'blood' || mat === 'essence') {
    // Low-Poly Floating Gelatinous Cube / Ichor Droplet Cluster
    const faces: PolyFace3D[] = [
      ...makePyramidFaces(
        [
          [22, 26, 8],
          [78, 22, 8],
          [84, 74, 8],
          [20, 80, 8],
        ],
        [50, 50, 20],
        'elementPrimary',
        2,
        0.88
      ),
      ...makeOctahedronFaces(50, 50, 23, 12, 12, 9, 'elementCore', 3),
      ...makeOctahedronFaces(28, 34, 18, 5, 5, 5, 'elementSecondary', 3),
      ...makeOctahedronFaces(70, 68, 18, 4.5, 4.5, 4, 'elementSecondary', 3),
    ];
    return { faces, rotationZ: 8 };
  }

  if (mat === 'crystal' || mat === 'metal' || mat === 'artifact_core' || item.kind === 'catalyst') {
    const faces: PolyFace3D[] = [
      ...makeRidgeBladeFaces(
        [
          { x: 26, y: 28, z: 6, w: 0 },
          { x: 28, y: 52, z: 10, w: 8 },
          { x: 34, y: 82, z: 6, w: 7 },
        ],
        'elementSecondary',
        'elementPrimary',
        1
      ),
      ...makeRidgeBladeFaces(
        [
          { x: 74, y: 32, z: 6, w: 0 },
          { x: 70, y: 54, z: 10, w: 8 },
          { x: 66, y: 82, z: 6, w: 7 },
        ],
        'elementPrimary',
        'elementSecondary',
        1
      ),
      ...makeRidgeBladeFaces(
        [
          { x: 50, y: 10, z: 8, w: 0 },
          { x: 50, y: 32, z: 18, w: 12 },
          { x: 50, y: 66, z: 16, w: 11 },
          { x: 50, y: 88, z: 8, w: 6 },
        ],
        'elementCore',
        'elementPrimary',
        2
      ),
      ...makeOctahedronFaces(50, 48, 22, 6, 9, 6, 'elementCore', 3),
    ];
    return { faces, rotationZ: 0 };
  }

  if (mat === 'parchment') {
    return buildArchetypeLowPolyMesh('scroll');
  }

  // Default: Anatomical Low-Poly Crystalline Monster Organ / Heart / Gland
  const faces: PolyFace3D[] = [
    { verts: [[32, 14, 6], [42, 28, 10], [28, 28, 8]], mat: 'elementSecondary', layer: 1, facetBias: 0.16 },
    { verts: [[66, 12, 6], [72, 26, 8], [56, 28, 10]], mat: 'elementSecondary', layer: 1, facetBias: -0.14 },
    ...makePyramidFaces(
      [
        [38, 24, 8],
        [62, 24, 8],
        [78, 42, 8],
        [72, 68, 8],
        [48, 88, 6],
        [26, 66, 8],
        [22, 42, 8],
      ],
      [50, 52, 20],
      'elementPrimary',
      2
    ),
    ...makeOctahedronFaces(50, 50, 23, 9, 11, 7, 'elementCore', 3),
  ];
  return { faces, rotationZ: 0 };
}

// ============================================================================
// LAYER 4: JEV SPECIAL EFFECT LOW-POLY 3D OVERLAYS
// ============================================================================

function buildSpecialEffectLowPolyOverlay(effect?: string): PolyFace3D[] {
  if (!effect) return [];

  switch (effect) {
    case 'corrosion':
      return [
        ...makeOctahedronFaces(24, 74, 22, 4.5, 7.5, 5, 'effectAccent', 3),
        ...makeOctahedronFaces(74, 68, 22, 4, 7, 5, 'elementCore', 3),
        ...makeOctahedronFaces(62, 84, 22, 3.5, 5.5, 4, 'effectAccent', 3),
      ];

    case 'antimagic':
      return [
        ...makeOctahedronFaces(50, 50, 24, 9, 9, 7, 'bone', 3),
        ...makeOctahedronFaces(50, 50, 28, 3.5, 7.5, 4, 'obsidian', 3),
        { verts: [[50, 50, 20], [10, 22, 16], [16, 14, 16]], mat: 'effectAccent', layer: 3, opacity: 0.55, facetBias: 0.25 },
        { verts: [[50, 50, 20], [84, 14, 16], [90, 22, 16]], mat: 'effectAccent', layer: 3, opacity: 0.55, facetBias: 0.25 },
      ];

    case 'adhesive':
      return [
        { verts: [[14, 38, 20], [28, 44, 22], [18, 48, 18]], mat: 'bone', layer: 3, facetBias: 0.22 },
        { verts: [[14, 56, 20], [28, 60, 22], [18, 66, 18]], mat: 'bone', layer: 3, facetBias: 0.16 },
        { verts: [[86, 38, 20], [82, 48, 18], [72, 44, 22]], mat: 'bone', layer: 3, facetBias: -0.1 },
        { verts: [[86, 56, 20], [82, 66, 18], [72, 60, 22]], mat: 'bone', layer: 3, facetBias: -0.16 },
      ];

    case 'mind_blast':
      return [
        ...makeOctahedronFaces(16, 46, 22, 4, 6, 4, 'effectAccent', 3),
        ...makeOctahedronFaces(84, 54, 22, 4, 6, 4, 'effectAccent', 3),
        ...makeOctahedronFaces(50, 12, 22, 4.5, 4.5, 4, 'elementCore', 3),
      ];

    case 'hellfire':
      return [
        { verts: [[16, 78, 20], [24, 54, 22], [30, 76, 18]], mat: 'elementCore', layer: 3, facetBias: 0.25 },
        { verts: [[70, 76, 18], [76, 52, 22], [84, 78, 20]], mat: 'effectAccent', layer: 3, facetBias: 0.18 },
        { verts: [[20, 34, 20], [14, 16, 18], [28, 26, 18]], mat: 'elementCore', layer: 3, facetBias: 0.22 },
      ];

    case 'vampiric':
      return [
        ...makeOctahedronFaces(20, 26, 22, 4.5, 6, 5, 'effectAccent', 3),
        ...makeOctahedronFaces(80, 28, 22, 4.5, 6, 5, 'effectAccent', 3),
      ];

    case 'regeneration':
      return [
        ...makeOctahedronFaces(78, 24, 24, 4, 9, 5, 'elementCore', 3),
        ...makeOctahedronFaces(78, 24, 24, 9, 4, 5, 'effectAccent', 3),
      ];

    case 'petrification':
      return [
        ...makeOctahedronFaces(20, 74, 22, 6, 7, 5, 'metalLight', 3),
        ...makeOctahedronFaces(80, 74, 22, 6, 7, 5, 'metalDark', 3),
      ];

    case 'phase_shift':
    default:
      return [];
  }
}

// ============================================================================
// MAIN LOW-POLY COMPOSITE ITEM SPRITE COMPONENT
// ============================================================================

export const CompositeItemSprite: React.FC<CompositeItemSpriteProps> = ({
  item,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');

  const primaryElement: ElementType = item.elements?.[0] ?? 'force';
  const secondaryElement: ElementType =
    item.elements?.[1] ??
    (primaryElement === 'fire'
      ? 'radiant'
      : primaryElement === 'acid'
        ? 'poison'
        : primaryElement === 'necrotic'
          ? 'psychic'
          : 'force');

  const rarity: Rarity = item.rarity ?? 'common';
  const isCursed = Boolean(item.isCursed);
  const isMasterwork = Boolean(item.isMasterwork);

  const pPal = ELEMENT_PALETTES[primaryElement] ?? ELEMENT_PALETTES.force;
  const sPal = ELEMENT_PALETTES[secondaryElement] ?? pPal;
  const rFrame = RARITY_FRAME_COLORS[rarity] ?? RARITY_FRAME_COLORS.common;

  const { layer1Polys, layer2Polys, layer3Polys, isPhaseShift } = useMemo(() => {
    const baseMesh =
      item.kind === 'crafted' && item.archetype
        ? buildArchetypeLowPolyMesh(item.archetype)
        : buildReagentLowPolyMesh(item);

    const effectFaces = buildSpecialEffectLowPolyOverlay(item.specialEffect);
    const allFaces = [...baseMesh.faces, ...effectFaces];

    const projected = projectAndShadeFaces(allFaces, pPal, sPal, baseMesh.rotationZ);

    return {
      layer1Polys: projected.filter((p) => p.layer === 1),
      layer2Polys: projected.filter((p) => p.layer === 2),
      layer3Polys: projected.filter((p) => p.layer === 3),
      isPhaseShift: item.specialEffect === 'phase_shift',
    };
  }, [item, pPal, sPal]);

  // Low-poly octagonal chiseled background tablet facets
  const bgOctagonFacets = [
    { pts: '50,50 22,8 50,4', fill: mixHex(rFrame.bg, pPal.dark, 0.35) },
    { pts: '50,50 50,4 78,8', fill: mixHex(rFrame.bg, sPal.dark, 0.25) },
    { pts: '50,50 78,8 94,26', fill: mixHex(rFrame.bg, '#09090b', 0.4) },
    { pts: '50,50 94,26 94,74', fill: mixHex(rFrame.bg, '#09090b', 0.6) },
    { pts: '50,50 94,74 78,92', fill: mixHex(rFrame.bg, '#09090b', 0.75) },
    { pts: '50,50 78,92 50,96', fill: mixHex(rFrame.bg, pPal.dark, 0.5) },
    { pts: '50,50 50,96 22,92', fill: mixHex(rFrame.bg, '#09090b', 0.55) },
    { pts: '50,50 22,92 6,74', fill: mixHex(rFrame.bg, pPal.dark, 0.3) },
    { pts: '50,50 6,74 6,26', fill: mixHex(rFrame.bg, pPal.primary, 0.18) },
    { pts: '50,50 6,26 22,8', fill: mixHex(rFrame.bg, pPal.primary, 0.26) },
  ];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={`lp-shadow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.68" />
          </filter>
          <filter id={`lp-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor={pPal.glow} floodOpacity="0.6" />
          </filter>
        </defs>

        {/* LAYER 0: FACETED LOW-POLY STONE/CRYSTAL TABLET & RARITY HALO */}
        <g>
          {bgOctagonFacets.map((f, i) => (
            <polygon
              key={i}
              points={f.pts}
              fill={f.fill}
              stroke={isCursed ? '#ef4444' : rFrame.border}
              strokeWidth="0.45"
              strokeOpacity="0.45"
            />
          ))}
          <polygon
            points="22,8 50,4 78,8 94,26 94,74 78,92 50,96 22,92 6,74 6,26"
            fill="none"
            stroke={isCursed ? '#ef4444' : rFrame.border}
            strokeWidth={rarity === 'common' ? '1.8' : '2.6'}
            strokeLinejoin="bevel"
          />

          {/* Masterwork (Nat 20) Low-Poly Golden Crown Shards */}
          {isMasterwork && (
            <g opacity="0.95">
              <polygon points="50,1 55,9 45,9" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.6" />
              <polygon points="99,50 91,55 91,45" fill="#f59e0b" stroke="#fef08a" strokeWidth="0.6" />
              <polygon points="50,99 55,91 45,91" fill="#d97706" stroke="#fef08a" strokeWidth="0.6" />
              <polygon points="1,50 9,55 9,45" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.6" />
            </g>
          )}

          {/* Cursed Obsidian Jagged Spikes */}
          {isCursed && (
            <g opacity="0.95">
              <polygon points="10,12 22,18 16,24" fill="#dc2626" stroke="#450a0a" strokeWidth="0.7" />
              <polygon points="90,12 84,24 78,18" fill="#991b1b" stroke="#450a0a" strokeWidth="0.7" />
              <polygon points="10,88 16,76 22,82" fill="#b91c1c" stroke="#450a0a" strokeWidth="0.7" />
              <polygon points="90,88 78,82 84,76" fill="#7f1d1d" stroke="#450a0a" strokeWidth="0.7" />
            </g>
          )}
        </g>

        {/* Displacer Phase-Shift Twin Mesh */}
        {isPhaseShift && (
          <g transform="translate(8, -5)" opacity="0.38">
            {[...layer1Polys, ...layer2Polys].map((poly, i) => (
              <polygon
                key={`ghost-${i}`}
                points={poly.points}
                fill={sPal.primary}
                stroke="#e0f2fe"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}

        {/* LAYER 1: STRUCTURAL CHASSIS / HILT / BACK SUB-MESH */}
        <g filter={`url(#lp-shadow-${uid})`}>
          {layer1Polys.map((poly, idx) => (
            <polygon
              key={`l1-${idx}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
              opacity={poly.opacity}
            />
          ))}
        </g>

        {/* LAYER 2: PRIMARY BLADE / CORE / ELEMENTAL PAYLOAD SUB-MESH */}
        <g filter={`url(#lp-shadow-${uid})`}>
          {layer2Polys.map((poly, idx) => (
            <polygon
              key={`l2-${idx}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
              opacity={poly.opacity}
            />
          ))}
        </g>

        {/* LAYER 3: FOREGROUND GEMS & JEV SPECIAL EFFECT LOW-POLY MESH */}
        <g filter={`url(#lp-glow-${uid})`}>
          {layer3Polys.map((poly, idx) => (
            <polygon
              key={`l3-${idx}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
              opacity={poly.opacity}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

// ============================================================================
// LOW-POLY 3D MONSTER PORTRAIT SPRITE FOR THE BESTIARY
// ============================================================================

interface CompositeMonsterSpriteProps {
  monster: Monster;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function buildMonsterLowPolyFaces(monsterId: string): {
  faces: PolyFace3D[];
  primary: ElementType;
  secondary: ElementType;
} {
  switch (monsterId) {
    case 'gelatinous_cube':
      return {
        primary: 'acid',
        secondary: 'force',
        faces: [
          // Translucent Low-Poly Isometric Cube (Layer 2)
          { verts: [[50, 10, 12], [86, 28, 8], [50, 46, 20]], mat: 'elementCore', layer: 2, opacity: 0.78, facetBias: 0.25 },
          { verts: [[50, 10, 12], [50, 46, 20], [14, 28, 8]], mat: 'elementPrimary', layer: 2, opacity: 0.82, facetBias: 0.18 },
          { verts: [[14, 28, 8], [50, 46, 20], [16, 72, 6]], mat: 'elementPrimary', layer: 2, opacity: 0.85, facetBias: 0.08 },
          { verts: [[16, 72, 6], [50, 46, 20], [50, 90, 12]], mat: 'elementSecondary', layer: 2, opacity: 0.85, facetBias: -0.04 },
          { verts: [[50, 46, 20], [86, 28, 8], [84, 72, 6]], mat: 'elementPrimary', layer: 2, opacity: 0.8, facetBias: -0.12 },
          { verts: [[50, 46, 20], [84, 72, 6], [50, 90, 12]], mat: 'elementPrimary', layer: 2, opacity: 0.82, facetBias: -0.2 },
          // Floating Dissolved Skull & Sword trapped inside the Cube! (Layer 3)
          ...makeOctahedronFaces(38, 48, 22, 8, 9, 6, 'bone', 3),
          ...makeOctahedronFaces(62, 58, 22, 6, 12, 6, 'elementCore', 3),
        ],
      };

    case 'manticore':
      return {
        primary: 'fire',
        secondary: 'poison',
        faces: [
          ...makePyramidFaces(
            [
              [50, 8, 2],
              [82, 20, 2],
              [92, 52, 2],
              [78, 84, 2],
              [50, 92, 2],
              [22, 84, 2],
              [8, 52, 2],
              [18, 20, 2],
            ],
            [50, 50, 12],
            'elementPrimary',
            1
          ),
          { verts: [[28, 24, 8], [10, 8, 4], [22, 34, 8]], mat: 'obsidian', layer: 1, facetBias: 0.18 },
          { verts: [[72, 24, 8], [78, 34, 8], [90, 8, 4]], mat: 'obsidian', layer: 1, facetBias: -0.18 },
          ...makePyramidFaces(
            [[30, 28, 10], [70, 28, 10], [74, 62, 10], [50, 80, 10], [26, 62, 10]],
            [50, 52, 22],
            'gold',
            2
          ),
          ...makeOctahedronFaces(38, 44, 21, 5, 4, 4, 'elementCore', 3),
          ...makeOctahedronFaces(62, 44, 21, 5, 4, 4, 'elementCore', 3),
          { verts: [[38, 68, 18], [42, 82, 16], [45, 68, 18]], mat: 'bone', layer: 3, facetBias: 0.22 },
          { verts: [[55, 68, 18], [58, 82, 16], [62, 68, 18]], mat: 'bone', layer: 3, facetBias: -0.1 },
        ],
      };

    case 'basilisk':
      return {
        primary: 'acid',
        secondary: 'poison',
        faces: [
          { verts: [[50, 6, 4], [42, 26, 8], [58, 26, 8]], mat: 'elementCore', layer: 1, facetBias: 0.22 },
          { verts: [[26, 12, 4], [28, 32, 8], [42, 26, 8]], mat: 'elementSecondary', layer: 1, facetBias: 0.14 },
          { verts: [[74, 12, 4], [58, 26, 8], [72, 32, 8]], mat: 'elementSecondary', layer: 1, facetBias: -0.14 },
          ...makePyramidFaces(
            [[26, 28, 8], [74, 28, 8], [82, 56, 8], [50, 88, 8], [18, 56, 8]],
            [50, 54, 20],
            'elementPrimary',
            2
          ),
          ...makeOctahedronFaces(34, 42, 20, 4, 3.5, 4, 'elementCore', 3),
          ...makeOctahedronFaces(66, 42, 20, 4, 3.5, 4, 'elementCore', 3),
          ...makeOctahedronFaces(30, 54, 19, 4.5, 4, 4, 'elementCore', 3),
          ...makeOctahedronFaces(70, 54, 19, 4.5, 4, 4, 'elementCore', 3),
        ],
      };

    case 'displacer_beast':
      return {
        primary: 'force',
        secondary: 'psychic',
        faces: [
          { verts: [[20, 74, 4], [8, 22, 6], [22, 36, 8]], mat: 'obsidian', layer: 1, facetBias: 0.18 },
          ...makeOctahedronFaces(12, 20, 10, 6, 8, 5, 'elementSecondary', 3),
          { verts: [[80, 74, 4], [78, 36, 8], [92, 22, 6]], mat: 'obsidian', layer: 1, facetBias: -0.18 },
          ...makeOctahedronFaces(88, 20, 10, 6, 8, 5, 'elementSecondary', 3),
          ...makePyramidFaces(
            [[28, 26, 8], [72, 26, 8], [74, 62, 8], [50, 84, 8], [26, 62, 8]],
            [50, 52, 20],
            'elementPrimary',
            2
          ),
          ...makeOctahedronFaces(38, 48, 20, 5.5, 4, 5, 'elementCore', 3),
          ...makeOctahedronFaces(62, 48, 20, 5.5, 4, 5, 'elementCore', 3),
        ],
      };

    case 'mimic':
      return {
        primary: 'acid',
        secondary: 'psychic',
        faces: [
          { verts: [[16, 22, 8], [50, 14, 14], [50, 44, 16]], mat: 'wood', layer: 2, facetBias: 0.18 },
          { verts: [[16, 22, 8], [50, 44, 16], [14, 46, 10]], mat: 'gold', layer: 2, facetBias: 0.1 },
          { verts: [[50, 14, 14], [84, 22, 8], [50, 44, 16]], mat: 'wood', layer: 2, facetBias: -0.1 },
          { verts: [[84, 22, 8], [86, 46, 10], [50, 44, 16]], mat: 'gold', layer: 2, facetBias: -0.18 },
          { verts: [[18, 44, 6], [82, 44, 6], [50, 82, 6]], mat: 'obsidian', layer: 1, facetBias: -0.25 },
          { verts: [[16, 64, 10], [50, 86, 14], [84, 64, 10]], mat: 'wood', layer: 2, facetBias: -0.08 },
          { verts: [[24, 44, 16], [30, 58, 16], [36, 44, 16]], mat: 'bone', layer: 3, facetBias: 0.22 },
          { verts: [[64, 44, 16], [70, 58, 16], [76, 44, 16]], mat: 'bone', layer: 3, facetBias: -0.08 },
          ...makeRidgeBladeFaces(
            [
              { x: 50, y: 50, z: 18, w: 9 },
              { x: 64, y: 72, z: 22, w: 6 },
              { x: 78, y: 88, z: 20, w: 0 },
            ],
            'elementSecondary',
            'elementPrimary',
            3
          ),
          ...makeOctahedronFaces(34, 30, 18, 4.5, 4, 4, 'elementCore', 3),
          ...makeOctahedronFaces(66, 30, 18, 4.5, 4, 4, 'elementCore', 3),
          ...makeOctahedronFaces(50, 24, 19, 4, 4, 4, 'elementCore', 3),
        ],
      };

    case 'venom_troll':
      return {
        primary: 'poison',
        secondary: 'acid',
        faces: [
          { verts: [[24, 40, 6], [4, 28, 2], [22, 54, 6]], mat: 'elementPrimary', layer: 1, facetBias: 0.18 },
          { verts: [[76, 40, 6], [78, 54, 6], [96, 28, 2]], mat: 'elementSecondary', layer: 1, facetBias: -0.18 },
          ...makePyramidFaces(
            [[30, 18, 8], [70, 18, 8], [76, 56, 8], [66, 86, 8], [34, 86, 8], [24, 56, 8]],
            [50, 52, 20],
            'elementPrimary',
            2
          ),
          { verts: [[28, 76, 16], [24, 54, 18], [38, 74, 16]], mat: 'bone', layer: 3, facetBias: 0.2 },
          { verts: [[72, 76, 16], [62, 74, 16], [76, 54, 18]], mat: 'bone', layer: 3, facetBias: -0.1 },
          ...makeOctahedronFaces(38, 40, 20, 5, 4, 5, 'elementCore', 3),
          ...makeOctahedronFaces(62, 40, 20, 5, 4, 5, 'elementCore', 3),
        ],
      };

    case 'mind_flayer':
      return {
        primary: 'psychic',
        secondary: 'force',
        faces: [
          { verts: [[14, 26, 2], [50, 48, 6], [20, 74, 2]], mat: 'obsidian', layer: 1, facetBias: 0.15 },
          { verts: [[86, 26, 2], [80, 74, 2], [50, 48, 6]], mat: 'obsidian', layer: 1, facetBias: -0.15 },
          ...makePyramidFaces(
            [[50, 10, 8], [76, 22, 8], [72, 50, 8], [50, 58, 12], [28, 50, 8], [24, 22, 8]],
            [50, 34, 22],
            'elementPrimary',
            2
          ),
          ...makeRidgeBladeFaces(
            [
              { x: 38, y: 54, z: 14, w: 4.5 },
              { x: 26, y: 74, z: 12, w: 3.5 },
              { x: 18, y: 92, z: 8, w: 0 },
            ],
            'elementPrimary',
            'elementSecondary',
            2
          ),
          ...makeRidgeBladeFaces(
            [
              { x: 46, y: 56, z: 16, w: 4.5 },
              { x: 42, y: 78, z: 14, w: 3.5 },
              { x: 38, y: 94, z: 10, w: 0 },
            ],
            'elementSecondary',
            'elementPrimary',
            3
          ),
          ...makeRidgeBladeFaces(
            [
              { x: 54, y: 56, z: 16, w: 4.5 },
              { x: 58, y: 78, z: 14, w: 3.5 },
              { x: 62, y: 94, z: 10, w: 0 },
            ],
            'elementPrimary',
            'elementSecondary',
            3
          ),
          ...makeRidgeBladeFaces(
            [
              { x: 62, y: 54, z: 14, w: 4.5 },
              { x: 74, y: 74, z: 12, w: 3.5 },
              { x: 82, y: 92, z: 8, w: 0 },
            ],
            'elementSecondary',
            'elementPrimary',
            2
          ),
          ...makeOctahedronFaces(38, 44, 21, 5.5, 4, 5, 'elementCore', 3),
          ...makeOctahedronFaces(62, 44, 21, 5.5, 4, 5, 'elementCore', 3),
        ],
      };

    case 'beholder':
      return {
        primary: 'force',
        secondary: 'necrotic',
        faces: [
          ...makeOctahedronFaces(18, 16, 10, 5, 5, 5, 'elementCore', 1),
          ...makeOctahedronFaces(50, 8, 10, 5, 5, 5, 'elementSecondary', 1),
          ...makeOctahedronFaces(82, 16, 10, 5, 5, 5, 'elementCore', 1),
          { verts: [[34, 32, 6], [18, 16, 8], [26, 36, 6]], mat: 'elementPrimary', layer: 1 },
          { verts: [[50, 28, 6], [50, 8, 8], [56, 28, 6]], mat: 'elementPrimary', layer: 1 },
          { verts: [[66, 32, 6], [82, 16, 8], [74, 36, 6]], mat: 'elementPrimary', layer: 1 },
          ...makePyramidFaces(
            [
              [50, 22, 8],
              [78, 32, 8],
              [84, 58, 8],
              [72, 84, 8],
              [50, 90, 8],
              [28, 84, 8],
              [16, 58, 8],
              [22, 32, 8],
            ],
            [50, 54, 20],
            'elementPrimary',
            2
          ),
          ...makeOctahedronFaces(50, 46, 22, 13, 12, 6, 'bone', 3),
          ...makeOctahedronFaces(50, 46, 26, 4.5, 9, 4, 'obsidian', 3),
          { verts: [[32, 70, 18], [36, 82, 16], [42, 70, 18]], mat: 'bone', layer: 3 },
          { verts: [[46, 70, 18], [50, 84, 16], [54, 70, 18]], mat: 'bone', layer: 3 },
          { verts: [[58, 70, 18], [64, 82, 16], [68, 70, 18]], mat: 'bone', layer: 3 },
        ],
      };

    case 'red_dragon':
      return {
        primary: 'fire',
        secondary: 'radiant',
        faces: [
          { verts: [[32, 26, 6], [8, 6, 2], [22, 38, 8]], mat: 'obsidian', layer: 1, facetBias: 0.2 },
          { verts: [[68, 26, 6], [78, 38, 8], [92, 6, 2]], mat: 'obsidian', layer: 1, facetBias: -0.2 },
          { verts: [[22, 38, 8], [6, 44, 2], [22, 56, 8]], mat: 'gold', layer: 1, facetBias: 0.14 },
          { verts: [[78, 38, 8], [78, 56, 8], [94, 44, 2]], mat: 'gold', layer: 1, facetBias: -0.14 },
          ...makeRidgeBladeFaces(
            [
              { x: 50, y: 14, z: 12, w: 12 },
              { x: 50, y: 38, z: 20, w: 24 },
              { x: 50, y: 64, z: 22, w: 18 },
              { x: 50, y: 88, z: 16, w: 8 },
            ],
            'elementPrimary',
            'elementSecondary',
            2
          ),
          ...makeOctahedronFaces(36, 44, 22, 6, 4, 5, 'elementCore', 3),
          ...makeOctahedronFaces(64, 44, 22, 6, 4, 5, 'elementCore', 3),
        ],
      };

    case 'archlich':
    default:
      return {
        primary: 'necrotic',
        secondary: 'cold',
        faces: [
          { verts: [[24, 30, 8], [20, 8, 4], [38, 24, 10]], mat: 'gold', layer: 1, facetBias: 0.2 },
          { verts: [[38, 24, 10], [50, 4, 6], [62, 24, 10]], mat: 'gold', layer: 1, facetBias: 0.12 },
          { verts: [[62, 24, 10], [80, 8, 4], [76, 30, 8]], mat: 'gold', layer: 1, facetBias: -0.16 },
          ...makeBoneSkullMesh(),
          ...makeOctahedronFaces(50, 18, 18, 5, 7, 5, 'elementCore', 3),
          ...makeOctahedronFaces(36, 48, 20, 6, 5, 5, 'elementCore', 3),
          ...makeOctahedronFaces(64, 48, 20, 6, 5, 5, 'elementCore', 3),
        ],
      };
  }
}

function makeBoneSkullMesh(): PolyFace3D[] {
  return [
    { verts: [[50, 22, 12], [26, 32, 8], [50, 46, 18]], mat: 'bone', layer: 2, facetBias: 0.2 },
    { verts: [[50, 22, 12], [50, 46, 18], [74, 32, 8]], mat: 'bone', layer: 2, facetBias: -0.06 },
    { verts: [[26, 32, 8], [24, 58, 8], [50, 46, 18]], mat: 'bone', layer: 2, facetBias: 0.08 },
    { verts: [[74, 32, 8], [50, 46, 18], [76, 58, 8]], mat: 'bone', layer: 2, facetBias: -0.14 },
    { verts: [[24, 58, 8], [36, 84, 9], [50, 64, 16]], mat: 'bone', layer: 2, facetBias: 0.02 },
    { verts: [[76, 58, 8], [50, 64, 16], [64, 84, 9]], mat: 'bone', layer: 2, facetBias: -0.18 },
    { verts: [[36, 84, 9], [64, 84, 9], [50, 64, 16]], mat: 'obsidian', layer: 2, facetBias: -0.15 },
  ];
}

export const CompositeMonsterSprite: React.FC<CompositeMonsterSpriteProps> = ({
  monster,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const sizeMap = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const { l1, l2, l3, pPal } = useMemo(() => {
    const spec = buildMonsterLowPolyFaces(monster.id);
    const p = ELEMENT_PALETTES[spec.primary];
    const s = ELEMENT_PALETTES[spec.secondary];
    const projected = projectAndShadeFaces(spec.faces, p, s, 0);
    return {
      l1: projected.filter((f) => f.layer === 1),
      l2: projected.filter((f) => f.layer === 2),
      l3: projected.filter((f) => f.layer === 3),
      pPal: p,
    };
  }, [monster.id]);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${sizeMap[size]} ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <filter id={`m-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.68" />
          </filter>
        </defs>
        {/* Low-Poly Octagonal Monster Crest Base */}
        <polygon
          points="24,6 76,6 94,24 94,76 76,94 24,94 6,76 6,24"
          fill="#111217"
          stroke={pPal.primary}
          strokeWidth="2.2"
          strokeOpacity="0.6"
        />
        <g filter={`url(#m-shadow-${uid})`}>
          {l1.map((poly, i) => (
            <polygon
              key={`ml1-${i}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
            />
          ))}
        </g>
        <g filter={`url(#m-shadow-${uid})`}>
          {l2.map((poly, i) => (
            <polygon
              key={`ml2-${i}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
            />
          ))}
        </g>
        <g>
          {l3.map((poly, i) => (
            <polygon
              key={`ml3-${i}`}
              points={poly.points}
              fill={poly.fill}
              stroke={poly.stroke}
              strokeWidth={poly.strokeWidth}
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
