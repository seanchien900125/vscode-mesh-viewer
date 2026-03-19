import { ParsedMesh } from './types';
import { buildElementEdgeIndices, buildSurfaceTopology } from './topology';
import {
  ensure,
  parseNonNegativeCount,
  parseRequiredFloat,
  parseRequiredInt,
  requireLine,
  validateParsedMesh,
  validateVertexReference
} from './parserUtils';

/**
 * Parse VTK legacy ASCII format (DATASET UNSTRUCTURED_GRID).
 * Handles surface triangles (type 5) and tetrahedra (type 10).
 */
export function parseVtk(content: string): ParsedMesh {
  const lines = content.split(/\r?\n/);
  let i = 0;

  function nextLine(): string | undefined {
    while (i < lines.length) {
      const l = lines[i++].trim();
      if (l) return l;
    }
    return undefined;
  }

  const vertices: number[] = [];
  const cells: number[][] = [];
  const cellTypes: number[] = [];

  while (i < lines.length) {
    const line = nextLine();
    if (!line) break;

    if (line.startsWith('POINTS')) {
      const parts = line.split(/\s+/);
      const count = parseNonNegativeCount(parts[1], 'POINTS count');
      let read = 0;
      while (read < count) {
        const l = requireLine(nextLine(), 'POINTS data');
        const nums = l.split(/\s+/);
        for (let k = 0; k + 2 < nums.length && read < count; k += 3) {
          vertices.push(
            parseRequiredFloat(nums[k], `POINTS x ${read + 1}`),
            parseRequiredFloat(nums[k + 1], `POINTS y ${read + 1}`),
            parseRequiredFloat(nums[k + 2], `POINTS z ${read + 1}`)
          );
          read++;
        }
      }
    } else if (line.startsWith('CELLS')) {
      const parts = line.split(/\s+/);
      const count = parseNonNegativeCount(parts[1], 'CELLS count');
      for (let c = 0; c < count; c++) {
        const l = requireLine(nextLine(), `CELLS entry ${c + 1}`).split(/\s+/);
        const npts = parseNonNegativeCount(l[0], `CELLS entry ${c + 1} point count`);
        const cell: number[] = [];
        for (let k = 1; k <= npts; k++) {
          cell.push(parseRequiredInt(l[k], `CELLS entry ${c + 1} point ${k}`));
        }
        cells.push(cell);
      }
    } else if (line.startsWith('CELL_TYPES')) {
      const parts = line.split(/\s+/);
      const count = parseNonNegativeCount(parts[1], 'CELL_TYPES count');
      let read = 0;
      while (read < count) {
        const l = requireLine(nextLine(), 'CELL_TYPES data');
        const nums = l.split(/\s+/);
        for (const n of nums) {
          if (n) { cellTypes.push(parseRequiredInt(n, `CELL_TYPES entry ${read + 1}`)); read++; }
        }
      }
    }
  }

  ensure(cells.length === cellTypes.length, `VTK legacy: expected ${cells.length} CELL_TYPES entries, got ${cellTypes.length}`);

  const triangles: number[][] = [];
  const quadrilaterals: number[][] = [];
  const tetrahedra: number[][] = [];
  const hexahedra: number[][] = [];

  const vertexCount = vertices.length / 3;
  for (let c = 0; c < cells.length; c++) {
    const type = cellTypes[c];
    if (type === 5 || type === 22) {
      // Triangle or Triangle6 (quadratic)
      triangles.push([
        validateVertexReference(cells[c][0], vertexCount, `CELL ${c + 1} vertex 1`),
        validateVertexReference(cells[c][1], vertexCount, `CELL ${c + 1} vertex 2`),
        validateVertexReference(cells[c][2], vertexCount, `CELL ${c + 1} vertex 3`)
      ]);
    } else if (type === 9 || type === 23) {
      // Quad or Quad8
      quadrilaterals.push([
        validateVertexReference(cells[c][0], vertexCount, `CELL ${c + 1} vertex 1`),
        validateVertexReference(cells[c][1], vertexCount, `CELL ${c + 1} vertex 2`),
        validateVertexReference(cells[c][2], vertexCount, `CELL ${c + 1} vertex 3`),
        validateVertexReference(cells[c][3], vertexCount, `CELL ${c + 1} vertex 4`)
      ]);
    } else if (type === 10 || type === 24) {
      // Tetrahedron or Tet10
      tetrahedra.push([
        validateVertexReference(cells[c][0], vertexCount, `CELL ${c + 1} vertex 1`),
        validateVertexReference(cells[c][1], vertexCount, `CELL ${c + 1} vertex 2`),
        validateVertexReference(cells[c][2], vertexCount, `CELL ${c + 1} vertex 3`),
        validateVertexReference(cells[c][3], vertexCount, `CELL ${c + 1} vertex 4`)
      ]);
    } else if (type === 12 || type === 25) {
      // Hexahedron or Hex20
      hexahedra.push([
        validateVertexReference(cells[c][0], vertexCount, `CELL ${c + 1} vertex 1`),
        validateVertexReference(cells[c][1], vertexCount, `CELL ${c + 1} vertex 2`),
        validateVertexReference(cells[c][2], vertexCount, `CELL ${c + 1} vertex 3`),
        validateVertexReference(cells[c][3], vertexCount, `CELL ${c + 1} vertex 4`),
        validateVertexReference(cells[c][4], vertexCount, `CELL ${c + 1} vertex 5`),
        validateVertexReference(cells[c][5], vertexCount, `CELL ${c + 1} vertex 6`),
        validateVertexReference(cells[c][6], vertexCount, `CELL ${c + 1} vertex 7`),
        validateVertexReference(cells[c][7], vertexCount, `CELL ${c + 1} vertex 8`)
      ]);
    }
  }

  const topologyInput = { vertexPositions: vertices, triangles, quadrilaterals, tetrahedra, hexahedra };
  const { indices, surfaceEdgeIndices } = buildSurfaceTopology(topologyInput);
  const edgeIndices = buildElementEdgeIndices(topologyInput);

  return validateParsedMesh({
    vertices,
    indices,
    surfaceEdgeIndices,
    edgeIndices,
    elementCounts: {
      triangles: triangles.length,
      quadrilaterals: quadrilaterals.length,
      tetrahedra: tetrahedra.length,
      hexahedra: hexahedra.length
    }
  }, 'VTK legacy');
}
