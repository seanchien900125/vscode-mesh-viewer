import { ParsedMesh } from './types';
import { buildElementEdgeIndices, buildSurfaceTopology } from './topology';
import {
  parseRequiredFloat,
  parseRequiredInt,
  validateParsedMesh,
  validateVertexReference
} from './parserUtils';

type SupportedElementKind = 'triangle' | 'quadrilateral' | 'tetrahedron' | 'hexahedron';

interface SupportedElementType {
  kind: SupportedElementKind;
  cornerCount: number;
}

function parseKeyword(line: string): { name: string; params: Map<string, string> } {
  const segments = line.split(',').map((segment) => segment.trim()).filter(Boolean);
  const name = segments[0].slice(1).toUpperCase();
  const params = new Map<string, string>();

  for (const segment of segments.slice(1)) {
    const eqIndex = segment.indexOf('=');
    if (eqIndex === -1) {
      params.set(segment.toUpperCase(), '');
      continue;
    }

    const key = segment.slice(0, eqIndex).trim().toUpperCase();
    const value = segment.slice(eqIndex + 1).trim().toUpperCase();
    params.set(key, value);
  }

  return { name, params };
}

function resolveElementType(typeName: string | undefined): SupportedElementType | undefined {
  if (!typeName) {
    return undefined;
  }

  const normalized = typeName.toUpperCase();

  if (/^(S3|STRI3|CPS3|CPE3|M3D3)/.test(normalized)) {
    return { kind: 'triangle', cornerCount: 3 };
  }

  if (/^(S4|S8|S9|CPS4|CPE4|M3D4)/.test(normalized)) {
    return { kind: 'quadrilateral', cornerCount: 4 };
  }

  if (/^C3D4/.test(normalized) || /^C3D10/.test(normalized)) {
    return { kind: 'tetrahedron', cornerCount: 4 };
  }

  if (/^(C3D8|C3D20|SC8)/.test(normalized)) {
    return { kind: 'hexahedron', cornerCount: 8 };
  }

  return undefined;
}

function isIgnorableLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed.startsWith('**');
}

function collectDataRecords(lines: string[], startIndex: number): { records: string[][]; nextIndex: number } {
  const records: string[][] = [];
  let index = startIndex;
  let pending: string[] = [];

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('**')) {
      index++;
      continue;
    }

    if (trimmed.startsWith('*')) {
      break;
    }

    const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      index++;
      continue;
    }

    pending.push(...parts);
    const hasContinuation = /,\s*$/.test(rawLine);
    if (!hasContinuation) {
      records.push(pending);
      pending = [];
    }

    index++;
  }

  if (pending.length > 0) {
    records.push(pending);
  }

  return { records, nextIndex: index };
}

export function parseInp(content: string): ParsedMesh {
  const lines = content.split(/\r?\n/);
  const vertices: number[] = [];
  const triangles: number[][] = [];
  const quadrilaterals: number[][] = [];
  const tetrahedra: number[][] = [];
  const hexahedra: number[][] = [];
  const nodeIndex = new Map<number, number>();

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    if (isIgnorableLine(line)) {
      lineIndex++;
      continue;
    }

    if (!line.startsWith('*')) {
      lineIndex++;
      continue;
    }

    const keyword = parseKeyword(line);
    lineIndex++;

    if (keyword.name === 'NODE') {
      const { records, nextIndex } = collectDataRecords(lines, lineIndex);
      for (const record of records) {
        if (record.length < 4) {
          continue;
        }

        const nodeId = Number.parseInt(record[0], 10);
        if (!Number.isFinite(nodeId)) {
          continue;
        }

        const vertexIndex = vertices.length / 3;
        nodeIndex.set(nodeId, vertexIndex);
        vertices.push(
          parseRequiredFloat(record[1], `*NODE ${nodeId} x`),
          parseRequiredFloat(record[2], `*NODE ${nodeId} y`),
          parseRequiredFloat(record[3], `*NODE ${nodeId} z`)
        );
      }

      lineIndex = nextIndex;
      continue;
    }

    if (keyword.name === 'ELEMENT') {
      const elementType = resolveElementType(keyword.params.get('TYPE'));
      const { records, nextIndex } = collectDataRecords(lines, lineIndex);

      if (elementType) {
        const vertexCount = vertices.length / 3;
        for (const record of records) {
          if (record.length < elementType.cornerCount + 1) {
            continue;
          }

          const nodeIds = record.slice(1, elementType.cornerCount + 1);
          const corners = nodeIds.map((value, index) => {
            const nodeId = parseRequiredInt(value, `*ELEMENT node ${index + 1}`);
            return validateVertexReference(nodeIndex.get(nodeId) ?? -1, vertexCount, `*ELEMENT node ${index + 1}`);
          });

          switch (elementType.kind) {
            case 'triangle':
              triangles.push(corners as number[]);
              break;
            case 'quadrilateral':
              quadrilaterals.push(corners as number[]);
              break;
            case 'tetrahedron':
              tetrahedra.push(corners as number[]);
              break;
            case 'hexahedron':
              hexahedra.push(corners as number[]);
              break;
          }
        }
      }

      lineIndex = nextIndex;
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
  }, 'Abaqus .inp');
}