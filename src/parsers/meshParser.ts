import { ParsedMesh } from './types';
import { buildElementEdgeIndices, buildSurfaceTopology } from './topology';
import {
  parseNonNegativeCount,
  parseRequiredFloat,
  toZeroBasedIndex,
  validateParsedMesh
} from './parserUtils';

/**
 * Parse MEDIT .mesh format (ASCII).
 * Supports Vertices, Triangles, Tetrahedra, Hexahedra.
 * Volume elements (hex/tet) use boundary face extraction to produce surface.
 */
export function parseMesh(content: string): ParsedMesh {
  const lines = content.split(/\r?\n/);
  let i = 0;

  function skipToKeyword(): string | undefined {
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line && !line.startsWith('#')) {
        return line;
      }
    }
    return undefined;
  }

  function readInt(): number {
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line && !line.startsWith('#')) {
        return parseNonNegativeCount(line, 'section count');
      }
    }
    throw new Error('Unexpected end of file while reading section count');
  }

  function readDataLine(context: string): string[] {
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (!line || line.startsWith('#')) {
        continue;
      }

      return line.split(/\s+/);
    }

    throw new Error(`Unexpected end of file while reading ${context}`);
  }

  const vertices: number[] = [];
  // Store elements by type
  const triangles: number[][] = [];   // each: [v0, v1, v2]
  const tetrahedra: number[][] = [];  // each: [v0, v1, v2, v3]
  const hexahedra: number[][] = [];   // each: [v0..v7]

  while (i < lines.length) {
    const kw = skipToKeyword();
    if (!kw) break;

    if (kw === 'Vertices') {
      const count = readInt();
      for (let n = 0; n < count; n++) {
        const parts = readDataLine(`vertex ${n + 1}`);
        vertices.push(
          parseRequiredFloat(parts[0], `vertex ${n + 1} x`),
          parseRequiredFloat(parts[1], `vertex ${n + 1} y`),
          parseRequiredFloat(parts[2], `vertex ${n + 1} z`)
        );
      }
    } else if (kw === 'Triangles') {
      const count = readInt();
      for (let n = 0; n < count; n++) {
        const parts = readDataLine(`triangle ${n + 1}`);
        triangles.push([
          toZeroBasedIndex(parts[0], `triangle ${n + 1} vertex 1`),
          toZeroBasedIndex(parts[1], `triangle ${n + 1} vertex 2`),
          toZeroBasedIndex(parts[2], `triangle ${n + 1} vertex 3`)
        ]);
      }
    } else if (kw === 'Tetrahedra') {
      const count = readInt();
      for (let n = 0; n < count; n++) {
        const parts = readDataLine(`tetrahedron ${n + 1}`);
        tetrahedra.push([
          toZeroBasedIndex(parts[0], `tetrahedron ${n + 1} vertex 1`),
          toZeroBasedIndex(parts[1], `tetrahedron ${n + 1} vertex 2`),
          toZeroBasedIndex(parts[2], `tetrahedron ${n + 1} vertex 3`),
          toZeroBasedIndex(parts[3], `tetrahedron ${n + 1} vertex 4`)
        ]);
      }
    } else if (kw === 'Hexahedra') {
      const count = readInt();
      for (let n = 0; n < count; n++) {
        const parts = readDataLine(`hexahedron ${n + 1}`);
        hexahedra.push([
          toZeroBasedIndex(parts[0], `hexahedron ${n + 1} vertex 1`),
          toZeroBasedIndex(parts[1], `hexahedron ${n + 1} vertex 2`),
          toZeroBasedIndex(parts[2], `hexahedron ${n + 1} vertex 3`),
          toZeroBasedIndex(parts[3], `hexahedron ${n + 1} vertex 4`),
          toZeroBasedIndex(parts[4], `hexahedron ${n + 1} vertex 5`),
          toZeroBasedIndex(parts[5], `hexahedron ${n + 1} vertex 6`),
          toZeroBasedIndex(parts[6], `hexahedron ${n + 1} vertex 7`),
          toZeroBasedIndex(parts[7], `hexahedron ${n + 1} vertex 8`)
        ]);
      }
    } else if (kw === 'End') {
      break;
    }
    // skip unknown keywords
  }

  const topologyInput = { vertexPositions: vertices, triangles, tetrahedra, hexahedra };
  const { indices, surfaceEdgeIndices } = buildSurfaceTopology(topologyInput);
  const edgeIndices = buildElementEdgeIndices(topologyInput);

  return validateParsedMesh({
    vertices,
    indices,
    surfaceEdgeIndices,
    edgeIndices,
    elementCounts: {
      triangles: triangles.length,
      quadrilaterals: 0,
      tetrahedra: tetrahedra.length,
      hexahedra: hexahedra.length
    }
  }, 'MEDIT .mesh');
}
