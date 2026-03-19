import { MeshElementCounts, ParsedMesh } from './parsers/types';

export interface TransferredMeshData {
  vertices: ArrayBuffer;
  indices: ArrayBuffer;
  surfaceEdgeIndices: ArrayBuffer;
  edgeIndices: ArrayBuffer;
  elementCounts: MeshElementCounts;
}

export interface DecodedMeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  surfaceEdgeIndices: Uint32Array;
  edgeIndices: Uint32Array;
  elementCounts: MeshElementCounts;
}

export function encodeParsedMesh(mesh: ParsedMesh): TransferredMeshData {
  return {
    vertices: new Float32Array(mesh.vertices).buffer,
    indices: new Uint32Array(mesh.indices).buffer,
    surfaceEdgeIndices: new Uint32Array(mesh.surfaceEdgeIndices).buffer,
    edgeIndices: new Uint32Array(mesh.edgeIndices).buffer,
    elementCounts: mesh.elementCounts
  };
}

export function decodeTransferredMesh(data: TransferredMeshData): DecodedMeshData {
  return {
    vertices: new Float32Array(data.vertices),
    indices: new Uint32Array(data.indices),
    surfaceEdgeIndices: new Uint32Array(data.surfaceEdgeIndices),
    edgeIndices: new Uint32Array(data.edgeIndices),
    elementCounts: data.elementCounts
  };
}