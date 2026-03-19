export interface MeshTopologyInput {
  vertexPositions?: number[];
  triangles?: number[][];
  quadrilaterals?: number[][];
  tetrahedra?: number[][];
  hexahedra?: number[][];
}

interface StoredFace {
  vertices: number[];
  cellCenter?: [number, number, number];
}

export interface SurfaceTopology {
  indices: number[];
  surfaceEdgeIndices: number[];
}

export const TET_FACES: [number, number, number][] = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 2, 3],
  [1, 2, 3]
];

export const TET_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3]
];

export const HEX_FACES: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7]
];

export const HEX_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
];

function faceKey(vertices: number[]): string {
  return [...vertices].sort((left, right) => left - right).join(',');
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function addUniqueEdge(edgeMap: Map<string, [number, number]>, a: number, b: number): void {
  const key = edgeKey(a, b);
  if (!edgeMap.has(key)) {
    edgeMap.set(key, [a, b]);
  }
}

function triangulateFace(face: number[]): number[] {
  if (face.length === 3) {
    return [face[0], face[1], face[2]];
  }

  if (face.length === 4) {
    return [face[0], face[1], face[2], face[0], face[2], face[3]];
  }

  throw new Error(`Unsupported face size: ${face.length}`);
}

function getVertex(input: MeshTopologyInput, index: number): [number, number, number] | undefined {
  const positions = input.vertexPositions;
  if (!positions) {
    return undefined;
  }

  const offset = index * 3;
  if (offset + 2 >= positions.length) {
    return undefined;
  }

  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function computeCellCenter(input: MeshTopologyInput, element: number[]): [number, number, number] | undefined {
  if (!input.vertexPositions) {
    return undefined;
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const vertexIndex of element) {
    const vertex = getVertex(input, vertexIndex);
    if (!vertex) {
      return undefined;
    }

    sumX += vertex[0];
    sumY += vertex[1];
    sumZ += vertex[2];
  }

  const scale = 1 / element.length;
  return [sumX * scale, sumY * scale, sumZ * scale];
}

function orientFaceOutward(input: MeshTopologyInput, face: number[], cellCenter?: [number, number, number]): number[] {
  if (!cellCenter || face.length < 3) {
    return face;
  }

  const p0 = getVertex(input, face[0]);
  const p1 = getVertex(input, face[1]);
  const p2 = getVertex(input, face[2]);
  if (!p0 || !p1 || !p2) {
    return face;
  }

  let centerX = 0;
  let centerY = 0;
  let centerZ = 0;
  for (const vertexIndex of face) {
    const vertex = getVertex(input, vertexIndex);
    if (!vertex) {
      return face;
    }

    centerX += vertex[0];
    centerY += vertex[1];
    centerZ += vertex[2];
  }

  const inv = 1 / face.length;
  centerX *= inv;
  centerY *= inv;
  centerZ *= inv;

  const ux = p1[0] - p0[0];
  const uy = p1[1] - p0[1];
  const uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0];
  const vy = p2[1] - p0[1];
  const vz = p2[2] - p0[2];

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  const toFaceX = centerX - cellCenter[0];
  const toFaceY = centerY - cellCenter[1];
  const toFaceZ = centerZ - cellCenter[2];

  const dot = nx * toFaceX + ny * toFaceY + nz * toFaceZ;
  if (dot >= 0) {
    return face;
  }

  return [...face].reverse();
}

function collectBoundaryFaces(input: MeshTopologyInput): { explicitFaces: number[][]; boundaryVolumeFaces: number[][] } {
  const triangles = input.triangles ?? [];
  const quadrilaterals = input.quadrilaterals ?? [];
  const tetrahedra = input.tetrahedra ?? [];
  const hexahedra = input.hexahedra ?? [];

  const faceCount = new Map<string, number>();
  const faceStore = new Map<string, StoredFace>();

  const addFace = (face: number[], cellCenter?: [number, number, number]): void => {
    const key = faceKey(face);
    faceCount.set(key, (faceCount.get(key) ?? 0) + 1);
    if (!faceStore.has(key)) {
      faceStore.set(key, { vertices: face, cellCenter });
    }
  };

  for (const tetrahedron of tetrahedra) {
    const cellCenter = computeCellCenter(input, tetrahedron);
    for (const [i0, i1, i2] of TET_FACES) {
      addFace([tetrahedron[i0], tetrahedron[i1], tetrahedron[i2]], cellCenter);
    }
  }

  for (const hexahedron of hexahedra) {
    const cellCenter = computeCellCenter(input, hexahedron);
    for (const [i0, i1, i2, i3] of HEX_FACES) {
      addFace([hexahedron[i0], hexahedron[i1], hexahedron[i2], hexahedron[i3]], cellCenter);
    }
  }

  const boundaryVolumeFaces: number[][] = [];
  if (tetrahedra.length > 0 || hexahedra.length > 0) {
    for (const [key, count] of faceCount) {
      if (count !== 1) {
        continue;
      }

      const storedFace = faceStore.get(key);
      if (storedFace) {
        boundaryVolumeFaces.push(orientFaceOutward(input, storedFace.vertices, storedFace.cellCenter));
      }
    }
  }

  return {
    explicitFaces: [...triangles, ...quadrilaterals],
    boundaryVolumeFaces
  };
}

export function buildSurfaceIndices(input: MeshTopologyInput): number[] {
  return buildSurfaceTopology(input).indices;
}

export function buildSurfaceTopology(input: MeshTopologyInput): SurfaceTopology {
  const { explicitFaces, boundaryVolumeFaces } = collectBoundaryFaces(input);

  const indices: number[] = [];
  const edgeMap = new Map<string, [number, number]>();

  const addFaceEdges = (face: number[]): void => {
    for (let index = 0; index < face.length; index++) {
      const nextIndex = (index + 1) % face.length;
      addUniqueEdge(edgeMap, face[index], face[nextIndex]);
    }
  };

  for (const face of boundaryVolumeFaces) {
    indices.push(...triangulateFace(face));
    addFaceEdges(face);
  }

  for (const face of explicitFaces) {
    indices.push(...triangulateFace(face));
    addFaceEdges(face);
  }

  return {
    indices,
    surfaceEdgeIndices: [...edgeMap.values()].flatMap(([a, b]) => [a, b])
  };
}

export function buildSurfaceEdgeIndices(input: MeshTopologyInput): number[] {
  return buildSurfaceTopology(input).surfaceEdgeIndices;
}

export function buildElementEdgeIndices(input: MeshTopologyInput): number[] {
  const triangles = input.triangles ?? [];
  const quadrilaterals = input.quadrilaterals ?? [];
  const tetrahedra = input.tetrahedra ?? [];
  const hexahedra = input.hexahedra ?? [];

  const edgeMap = new Map<string, [number, number]>();

  for (const triangle of triangles) {
    addUniqueEdge(edgeMap, triangle[0], triangle[1]);
    addUniqueEdge(edgeMap, triangle[1], triangle[2]);
    addUniqueEdge(edgeMap, triangle[2], triangle[0]);
  }

  for (const quadrilateral of quadrilaterals) {
    addUniqueEdge(edgeMap, quadrilateral[0], quadrilateral[1]);
    addUniqueEdge(edgeMap, quadrilateral[1], quadrilateral[2]);
    addUniqueEdge(edgeMap, quadrilateral[2], quadrilateral[3]);
    addUniqueEdge(edgeMap, quadrilateral[3], quadrilateral[0]);
  }

  for (const tetrahedron of tetrahedra) {
    for (const [i0, i1] of TET_EDGES) {
      addUniqueEdge(edgeMap, tetrahedron[i0], tetrahedron[i1]);
    }
  }

  for (const hexahedron of hexahedra) {
    for (const [i0, i1] of HEX_EDGES) {
      addUniqueEdge(edgeMap, hexahedron[i0], hexahedron[i1]);
    }
  }

  return [...edgeMap.values()].flatMap(([a, b]) => [a, b]);
}