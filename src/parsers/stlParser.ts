import { ParsedMesh } from './types';
import { buildElementEdgeIndices, buildSurfaceTopology } from './topology';
import { ensure, parseNonNegativeCount, parseRequiredFloat, validateParsedMesh } from './parserUtils';

/**
 * Parse STL files (both ASCII and binary).
 * Returns mesh with unindexed triangles; Three.js BufferGeometry handles shared vertex normals.
 */
export function parseStl(buffer: Buffer): ParsedMesh {
  // Detect ASCII vs binary: ASCII starts with "solid"
  const header = buffer.slice(0, 5).toString('ascii');
  if (header.toLowerCase().startsWith('solid')) {
    // Try ASCII first; binary can also start with "solid" so check for "facet"
    const text = buffer.toString('utf8');
    if (text.includes('facet')) {
      return parseStlAscii(text);
    }
  }
  return parseStlBinary(buffer);
}

function parseStlAscii(text: string): ParsedMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const triangles: number[][] = [];
  let idx = 0;

  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    vertices.push(
      parseRequiredFloat(match[1], `ASCII STL vertex ${idx + 1} x`),
      parseRequiredFloat(match[2], `ASCII STL vertex ${idx + 1} y`),
      parseRequiredFloat(match[3], `ASCII STL vertex ${idx + 1} z`)
    );
    indices.push(idx++);

    if (idx % 3 === 0) {
      triangles.push([idx - 3, idx - 2, idx - 1]);
    }
  }

  ensure(triangles.length > 0, 'ASCII STL contains no triangle facets');
  const { surfaceEdgeIndices } = buildSurfaceTopology({ triangles });

  return validateParsedMesh({
    vertices,
    indices,
    surfaceEdgeIndices,
    edgeIndices: buildElementEdgeIndices({ triangles }),
    elementCounts: {
      triangles: triangles.length,
      quadrilaterals: 0,
      tetrahedra: 0,
      hexahedra: 0
    }
  }, 'ASCII STL');
}

function parseStlBinary(buffer: Buffer): ParsedMesh {
  // Binary STL: 80-byte header, 4-byte tri count, then (12*4+2) bytes per tri
  ensure(buffer.length >= 84, 'Binary STL is too short to contain a valid header');
  const triCount = parseNonNegativeCount(String(buffer.readUInt32LE(80)), 'binary STL triangle count');
  ensure(buffer.length >= 84 + triCount * 50, 'Binary STL is truncated');
  const vertices: number[] = [];
  const indices: number[] = [];
  const triangles: number[][] = [];
  let offset = 84;

  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal (3 floats)
    for (let v = 0; v < 3; v++) {
      vertices.push(
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8)
      );
      offset += 12;
    }
    indices.push(i * 3, i * 3 + 1, i * 3 + 2);
    triangles.push([i * 3, i * 3 + 1, i * 3 + 2]);
    offset += 2; // attribute byte count
  }

  const { surfaceEdgeIndices } = buildSurfaceTopology({ triangles });

  return validateParsedMesh({
    vertices,
    indices,
    surfaceEdgeIndices,
    edgeIndices: buildElementEdgeIndices({ triangles }),
    elementCounts: {
      triangles: triangles.length,
      quadrilaterals: 0,
      tetrahedra: 0,
      hexahedra: 0
    }
  }, 'Binary STL');
}
