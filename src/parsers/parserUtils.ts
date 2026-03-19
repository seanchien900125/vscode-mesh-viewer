import { ParsedMesh } from './types';

const MAX_ENTITY_COUNT = 10_000_000;

export class MeshFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeshFormatError';
  }
}

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MeshFormatError(message);
  }
}

export function parseRequiredInt(value: string | undefined, context: string): number {
  ensure(value !== undefined && value.trim().length > 0, `Missing integer value for ${context}`);
  const parsed = Number.parseInt(value, 10);
  ensure(Number.isInteger(parsed), `Invalid integer value for ${context}: ${value}`);
  return parsed;
}

export function parseNonNegativeCount(value: string | undefined, context: string): number {
  const parsed = parseRequiredInt(value, context);
  ensure(parsed >= 0, `Negative count for ${context}: ${parsed}`);
  ensure(parsed <= MAX_ENTITY_COUNT, `Unreasonable count for ${context}: ${parsed}`);
  return parsed;
}

export function parseRequiredFloat(value: string | undefined, context: string): number {
  ensure(value !== undefined && value.trim().length > 0, `Missing numeric value for ${context}`);
  const parsed = Number.parseFloat(value);
  ensure(Number.isFinite(parsed), `Invalid numeric value for ${context}: ${value}`);
  return parsed;
}

export function toZeroBasedIndex(value: string | undefined, context: string): number {
  const parsed = parseRequiredInt(value, context);
  ensure(parsed > 0, `Expected 1-based positive index for ${context}, got ${parsed}`);
  return parsed - 1;
}

export function requireLine(line: string | undefined, context: string): string {
  ensure(line !== undefined, `Unexpected end of file while reading ${context}`);
  return line;
}

export function validateVertexReference(index: number, vertexCount: number, context: string): number {
  ensure(Number.isInteger(index), `Invalid vertex index for ${context}: ${index}`);
  ensure(index >= 0 && index < vertexCount, `Vertex index out of range for ${context}: ${index}`);
  return index;
}

export function validateParsedMesh(mesh: ParsedMesh, context: string): ParsedMesh {
  ensure(mesh.vertices.length % 3 === 0, `${context}: vertex buffer length is not divisible by 3`);

  for (const coordinate of mesh.vertices) {
    ensure(Number.isFinite(coordinate), `${context}: vertex buffer contains a non-finite coordinate`);
  }

  const vertexCount = mesh.vertices.length / 3;
  const validateIndexBuffer = (buffer: number[], label: string): void => {
    for (const index of buffer) {
      ensure(Number.isInteger(index), `${context}: ${label} contains a non-integer index`);
      ensure(index >= 0 && index < vertexCount, `${context}: ${label} contains out-of-range index ${index}`);
    }
  };

  validateIndexBuffer(mesh.indices, 'surface indices');
  validateIndexBuffer(mesh.surfaceEdgeIndices, 'surface edge indices');
  validateIndexBuffer(mesh.edgeIndices, 'edge indices');

  return mesh;
}