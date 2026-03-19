export interface MeshElementCounts {
  triangles: number;
  quadrilaterals: number;
  tetrahedra: number;
  hexahedra: number;
}

export interface ParsedMesh {
  /** Flat array of vertex positions: [x0,y0,z0, x1,y1,z1, ...] */
  vertices: number[];
  /** Flat array of surface triangle indices (0-based) */
  indices: number[];
  /** Flat array of line indices for boundary/surface edges (0-based) */
  surfaceEdgeIndices: number[];
  /** Flat array of line indices representing all mesh element edges (0-based) */
  edgeIndices: number[];
  /** Parsed element counts by topology type */
  elementCounts: MeshElementCounts;
}
