import { ParsedMesh } from './types';
import { buildElementEdgeIndices, buildSurfaceTopology } from './topology';
import {
  parseNonNegativeCount,
  parseRequiredFloat,
  parseRequiredInt,
  requireLine,
  validateParsedMesh,
  validateVertexReference
} from './parserUtils';

/**
 * Parse Gmsh MSH ASCII format (v2 and v4).
 * Extracts surface triangles and performs boundary extraction for volume elements.
 */
export function parseMsh(content: string): ParsedMesh {
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
  const triangles: number[][] = [];
  const quadrilaterals: number[][] = [];
  const tetrahedra: number[][] = [];
  const hexahedra: number[][] = [];
  // nodeIndex[1-based id] = 0-based index into vertices/3
  const nodeIndex = new Map<number, number>();

  while (i < lines.length) {
    const line = nextLine();
    if (!line) break;

    if (line === '$Nodes') {
      // v2: first line = count; v4: first line = "numEntityBlocks numNodes ..."
      const first = requireLine(nextLine(), '$Nodes header');
      const parts = first.split(/\s+/);

      if (parts.length === 1) {
        // v2 format: count nodes
        const count = parseNonNegativeCount(parts[0], '$Nodes count');
        for (let n = 0; n < count; n++) {
          const l = requireLine(nextLine(), `$Nodes entry ${n + 1}`).split(/\s+/);
          const id = parseRequiredInt(l[0], `$Nodes entry ${n + 1} id`);
          const vidx = vertices.length / 3;
          nodeIndex.set(id, vidx);
          vertices.push(
            parseRequiredFloat(l[1], `$Nodes entry ${n + 1} x`),
            parseRequiredFloat(l[2], `$Nodes entry ${n + 1} y`),
            parseRequiredFloat(l[3], `$Nodes entry ${n + 1} z`)
          );
        }
      } else {
        // v4 format: numEntityBlocks numNodes minNodeTag maxNodeTag
        const numBlocks = parseNonNegativeCount(parts[0], '$Nodes block count');
        for (let b = 0; b < numBlocks; b++) {
          const blockHeader = requireLine(nextLine(), `$Nodes block ${b + 1} header`).split(/\s+/);
          const numNodesInBlock = parseNonNegativeCount(blockHeader[3], `$Nodes block ${b + 1} node count`);
          // First: node tags
          const tags: number[] = [];
          for (let n = 0; n < numNodesInBlock; n++) {
            tags.push(parseRequiredInt(requireLine(nextLine(), `$Nodes block ${b + 1} tag ${n + 1}`), `$Nodes block ${b + 1} tag ${n + 1}`));
          }
          // Then: coordinates
          for (let n = 0; n < numNodesInBlock; n++) {
            const coords = requireLine(nextLine(), `$Nodes block ${b + 1} coordinates ${n + 1}`).split(/\s+/);
            const vidx = vertices.length / 3;
            nodeIndex.set(tags[n], vidx);
            vertices.push(
              parseRequiredFloat(coords[0], `$Nodes block ${b + 1} x`),
              parseRequiredFloat(coords[1], `$Nodes block ${b + 1} y`),
              parseRequiredFloat(coords[2], `$Nodes block ${b + 1} z`)
            );
          }
        }
      }
    } else if (line === '$Elements') {
      const first = requireLine(nextLine(), '$Elements header');
      const parts = first.split(/\s+/);

      if (parts.length === 1) {
        // v2 format
        const count = parseNonNegativeCount(parts[0], '$Elements count');
        for (let e = 0; e < count; e++) {
          const l = requireLine(nextLine(), `$Elements entry ${e + 1}`).split(/\s+/);
          const elemType = parseRequiredInt(l[1], `$Elements entry ${e + 1} type`);
          const numTags = parseNonNegativeCount(l[2], `$Elements entry ${e + 1} tag count`);
          const nodeStart = 3 + numTags;
          const vertexCount = vertices.length / 3;
          if (elemType === 2) {
            // Triangle (3 nodes)
            triangles.push([
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart], `$Elements entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 1`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 1], `$Elements entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 2`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 2], `$Elements entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 3`)
            ]);
          } else if (elemType === 3) {
            // Quadrilateral (4 nodes)
            quadrilaterals.push([
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart], `$Elements entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 1`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 1], `$Elements entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 2`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 2], `$Elements entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 3`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 3], `$Elements entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 4`)
            ]);
          } else if (elemType === 4) {
            // Tetrahedron (4 nodes)
            tetrahedra.push([
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart], `$Elements entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 1`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 1], `$Elements entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 2`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 2], `$Elements entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 3`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 3], `$Elements entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 4`)
            ]);
          } else if (elemType === 5) {
            // Hexahedron (8 nodes)
            hexahedra.push([
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart], `$Elements entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 1`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 1], `$Elements entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 2`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 2], `$Elements entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 3`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 3], `$Elements entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 4`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 4], `$Elements entry ${e + 1} node 5`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 5`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 5], `$Elements entry ${e + 1} node 6`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 6`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 6], `$Elements entry ${e + 1} node 7`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 7`),
              validateVertexReference(nodeIndex.get(parseRequiredInt(l[nodeStart + 7], `$Elements entry ${e + 1} node 8`)) ?? -1, vertexCount, `$Elements entry ${e + 1} node 8`)
            ]);
          }
        }
      } else {
        // v4 format: numEntityBlocks numElements ...
        const numBlocks = parseNonNegativeCount(parts[0], '$Elements block count');
        for (let b = 0; b < numBlocks; b++) {
          const blockHeader = requireLine(nextLine(), `$Elements block ${b + 1} header`).split(/\s+/);
          const elemType = parseRequiredInt(blockHeader[2], `$Elements block ${b + 1} type`);
          const numElemsInBlock = parseNonNegativeCount(blockHeader[3], `$Elements block ${b + 1} element count`);
          const vertexCount = vertices.length / 3;
          for (let e = 0; e < numElemsInBlock; e++) {
            const l = requireLine(nextLine(), `$Elements block ${b + 1} entry ${e + 1}`).split(/\s+/);
            // l[0] = element tag, rest = node tags
            if (elemType === 2) {
              triangles.push([
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[1], `$Elements block ${b + 1} entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 1`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[2], `$Elements block ${b + 1} entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 2`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[3], `$Elements block ${b + 1} entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 3`)
              ]);
            } else if (elemType === 3) {
              quadrilaterals.push([
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[1], `$Elements block ${b + 1} entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 1`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[2], `$Elements block ${b + 1} entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 2`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[3], `$Elements block ${b + 1} entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 3`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[4], `$Elements block ${b + 1} entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 4`)
              ]);
            } else if (elemType === 4) {
              tetrahedra.push([
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[1], `$Elements block ${b + 1} entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 1`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[2], `$Elements block ${b + 1} entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 2`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[3], `$Elements block ${b + 1} entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 3`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[4], `$Elements block ${b + 1} entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 4`)
              ]);
            } else if (elemType === 5) {
              hexahedra.push([
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[1], `$Elements block ${b + 1} entry ${e + 1} node 1`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 1`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[2], `$Elements block ${b + 1} entry ${e + 1} node 2`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 2`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[3], `$Elements block ${b + 1} entry ${e + 1} node 3`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 3`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[4], `$Elements block ${b + 1} entry ${e + 1} node 4`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 4`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[5], `$Elements block ${b + 1} entry ${e + 1} node 5`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 5`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[6], `$Elements block ${b + 1} entry ${e + 1} node 6`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 6`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[7], `$Elements block ${b + 1} entry ${e + 1} node 7`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 7`),
                validateVertexReference(nodeIndex.get(parseRequiredInt(l[8], `$Elements block ${b + 1} entry ${e + 1} node 8`)) ?? -1, vertexCount, `$Elements block ${b + 1} entry ${e + 1} node 8`)
              ]);
            }
          }
        }
      }
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
  }, 'Gmsh .msh');
}
