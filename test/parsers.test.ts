import { describe, expect, it } from 'vitest';
import { decodeTransferredMesh, encodeParsedMesh } from '../src/meshDataTransfer';
import { parseMesh } from '../src/parsers/meshParser';
import { parseMeshFileBuffer } from '../src/parsers/parseMeshFile';
import { parseStl } from '../src/parsers/stlParser';
import { parseVtk } from '../src/parsers/vtkParser';

describe('mesh data transfer', () => {
  it('encodes and decodes parsed mesh buffers', () => {
    const decoded = decodeTransferredMesh(encodeParsedMesh({
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      surfaceEdgeIndices: [0, 1, 1, 2, 2, 0],
      edgeIndices: [0, 1, 1, 2, 2, 0],
      elementCounts: {
        triangles: 1,
        quadrilaterals: 0,
        tetrahedra: 0,
        hexahedra: 0
      }
    }));

    expect(Array.from(decoded.vertices)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(decoded.indices)).toEqual([0, 1, 2]);
    expect(decoded.elementCounts.triangles).toBe(1);
  });
});

describe('parseVtk', () => {
  it('rejects mismatched cell type counts', () => {
    const vtk = [
      '# vtk DataFile Version 3.0',
      'example',
      'ASCII',
      'DATASET UNSTRUCTURED_GRID',
      'POINTS 4 float',
      '0 0 0 1 0 0 0 1 0 0 0 1',
      'CELLS 1 5',
      '4 0 1 2 3',
      'CELL_TYPES 0'
    ].join('\n');

    expect(() => parseVtk(vtk)).toThrow(/CELL_TYPES entries/);
  });
});

describe('parseStl', () => {
  it('rejects non-finite ascii vertex coordinates', () => {
    const stl = [
      'solid test',
      'facet normal 0 0 1',
      ' outer loop',
      '  vertex 0 0 0',
      '  vertex 1e999 0 0',
      '  vertex 0 1 0',
      ' endloop',
      'endfacet',
      'endsolid test'
    ].join('\n');

    expect(() => parseStl(Buffer.from(stl, 'utf8'))).toThrow(/Invalid numeric value/);
  });
});

describe('parseMesh', () => {
  it('treats unknown keywords as unknown instead of partial matches', () => {
    const mesh = [
      'MeshVersionFormatted 1',
      'Dimension 3',
      'Vertices',
      '3',
      '0 0 0 0',
      '1 0 0 0',
      '0 1 0 0',
      'TrianglesExtra',
      '1',
      '1 2 3 0',
      'Triangles',
      '1',
      '1 2 3 0',
      'End'
    ].join('\n');

    const parsed = parseMesh(mesh);
    expect(parsed.elementCounts.triangles).toBe(1);
    expect(parsed.indices).toEqual([0, 1, 2]);
  });
});

describe('parseMeshFileBuffer', () => {
  it('rejects unsupported extensions', () => {
    expect(() => parseMeshFileBuffer('example.foo', Buffer.from(''))).toThrow(/Unsupported file format/);
  });
});