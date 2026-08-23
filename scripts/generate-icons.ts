/**
 * Rendert die App-Icons (Favicon, Apple-Touch-Icon, PWA-Icons) aus dem
 * gleichen Signet wie `src/app/brandMark.ts`: zwei einander zugewandte,
 * blattartige Tropfenformen in Grün ("Aufnahme") und Amber ("Bedarf"), die
 * sich in der Mitte berühren.
 *
 * Reine Node-Implementierung ohne Zusatzabhängigkeiten (kein sharp/cairo
 * verfügbar): die beiden kubischen Bézier-Pfade aus brandMark.ts werden zu
 * Polygonen abgeflacht, per Supersampling (4×4) antialiased gerastert und
 * als PNG (eigener minimaler Encoder über `zlib.deflateSync`) geschrieben.
 *
 * Das Signet wird verkleinert und zentriert (Safe-Zone ~60% Durchmesser),
 * damit auch das "maskable" PWA-Icon (kreisförmiger Zuschnitt durch das OS)
 * nichts vom Signet abschneidet.
 *
 * Aufruf: npm run generate:icons
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/icons')

const COLOR_BG = [245, 247, 242] as const // --color-bg
const COLOR_INTAKE = [11, 138, 111] as const // --chart-color-intake (Grün, "Aufnahme")
const COLOR_REQUIREMENT = [181, 101, 29] as const // --chart-color-requirement (Amber, "Bedarf")

type Point = [number, number]

// Gleiche Pfade wie brandMark.ts, 32er-Design-Raster.
const LEAF_INTAKE: [Point, Point, Point, Point][] = [
  [
    [16, 16],
    [16, 8],
    [10, 4],
    [4, 4],
  ],
  [
    [4, 4],
    [4, 12],
    [8, 16],
    [16, 16],
  ],
]

const LEAF_REQUIREMENT: [Point, Point, Point, Point][] = [
  [
    [16, 16],
    [16, 24],
    [22, 28],
    [28, 28],
  ],
  [
    [28, 28],
    [28, 20],
    [24, 16],
    [16, 16],
  ],
]

function cubicBezier([p0, p1, p2, p3]: [Point, Point, Point, Point], steps: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    const a = mt * mt * mt
    const b = 3 * mt * mt * t
    const c = 3 * mt * t * t
    const d = t * t * t
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ])
  }
  return pts
}

function flattenLeaf(segments: [Point, Point, Point, Point][]): Point[] {
  return segments.flatMap((seg) => cubicBezier(seg, 32))
}

function pointInPolygon([px, py]: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Zentriert das 32er-Design in einem size×size-Canvas, Signet-Radius ≈ 30% von size. */
function toCanvasSpace(poly: Point[], size: number): Point[] {
  const maxDistFromCenter = Math.hypot(16 - 4, 16 - 4) // Bézier-Konvexhülle: (4,4)/(28,28) zu (16,16)
  const targetRadius = 0.38 * size // < 0.4·size Safe-Zone-Radius für maskable PWA-Icons
  const scale = targetRadius / maxDistFromCenter
  const cx = size / 2
  const cy = size / 2
  return poly.map(([x, y]) => [cx + (x - 16) * scale, cy + (y - 16) * scale])
}

function renderIcon(size: number): Buffer {
  const leafIntake = toCanvasSpace(flattenLeaf(LEAF_INTAKE), size)
  const leafRequirement = toCanvasSpace(flattenLeaf(LEAF_REQUIREMENT), size)

  const pixels = Buffer.alloc(size * size * 3)
  const SS = 4 // Supersampling pro Achse
  const subOffsets = Array.from({ length: SS }, (_, i) => (i + 0.5) / SS)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hitIntake = 0
      let hitRequirement = 0
      for (const oy of subOffsets) {
        for (const ox of subOffsets) {
          const sample: Point = [x + ox, y + oy]
          if (pointInPolygon(sample, leafIntake)) hitIntake++
          else if (pointInPolygon(sample, leafRequirement)) hitRequirement++
        }
      }
      const total = SS * SS
      const aIntake = hitIntake / total
      const aRequirement = hitRequirement / total
      const aBg = 1 - aIntake - aRequirement

      const idx = (y * size + x) * 3
      for (let c = 0; c < 3; c++) {
        pixels[idx + c] = Math.round(
          COLOR_INTAKE[c] * aIntake + COLOR_REQUIREMENT[c] * aRequirement + COLOR_BG[c] * aBg,
        )
      }
    }
  }
  return pixels
}

// --- Minimaler PNG-Encoder (RGB, 8-bit, kein Interlacing) ---

function crc32(buf: Buffer): number {
  let c: number
  const table = crc32.table ?? (crc32.table = buildCrcTable())
  let crc = 0xffffffff
  for (const byte of buf) {
    c = table[(crc ^ byte) & 0xff]
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
crc32.table = undefined as number[] | undefined

function buildCrcTable(): number[] {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePng(rgbPixels: Buffer, size: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type: RGB
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdr = pngChunk('IHDR', ihdrData)

  // Jede Scanline bekommt ein Filter-Byte (0 = None) vorangestellt.
  const stride = size * 3
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgbPixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = pngChunk('IDAT', deflateSync(raw))
  const iend = pngChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true })

  const targets: [string, number][] = [
    ['favicon.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]

  for (const [filename, size] of targets) {
    const pixels = renderIcon(size)
    const png = encodePng(pixels, size)
    const outPath = resolve(OUT_DIR, filename)
    writeFileSync(outPath, png)
    console.log(`${filename} (${size}×${size}) → ${outPath}`)
  }
}

main()
