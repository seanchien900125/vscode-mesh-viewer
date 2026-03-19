import * as fs from 'fs';
import * as path from 'path';
import { parseMeshFileBuffer } from './parsers/parseMeshFile';
import { ParsedMesh } from './parsers/types';

interface ExpectedCounts {
  tetrahedra?: number;
  hexahedra?: number;
}

const expectedByFile = new Map<string, ExpectedCounts>([
  ['Bellows.mesh', { tetrahedra: 471317 }],
  ['Bellows_hex.inp', { hexahedra: 20671 }],
  ['Bellows_hex.mesh', { hexahedra: 20671 }],
  ['Bellows_2.vtk', { tetrahedra: 471317 }]
]);

function parseFile(filePath: string): ParsedMesh {
  const buffer = fs.readFileSync(filePath);
  return parseMeshFileBuffer(filePath, buffer);
}

function validateCounts(fileName: string, parsed: ParsedMesh): void {
  const expected = expectedByFile.get(fileName);
  if (!expected) {
    return;
  }

  if (expected.tetrahedra !== undefined && parsed.elementCounts.tetrahedra !== expected.tetrahedra) {
    throw new Error(`${fileName}: expected ${expected.tetrahedra} tetrahedra, got ${parsed.elementCounts.tetrahedra}`);
  }

  if (expected.hexahedra !== undefined && parsed.elementCounts.hexahedra !== expected.hexahedra) {
    throw new Error(`${fileName}: expected ${expected.hexahedra} hexahedra, got ${parsed.elementCounts.hexahedra}`);
  }

  if (parsed.vertices.length === 0) {
    throw new Error(`${fileName}: parser returned no vertices`);
  }

  if (parsed.edgeIndices.length === 0) {
    throw new Error(`${fileName}: parser returned no mesh edges`);
  }
}

function main(): void {
  const testMeshDir = path.resolve(__dirname, '..', 'test_mesh');
  if (!fs.existsSync(testMeshDir)) {
    console.warn('Skipping sample mesh validation because test_mesh/ is not present.');
    return;
  }

  const files = fs.readdirSync(testMeshDir)
    .filter((name) => ['.mesh', '.msh', '.inp', '.vtk', '.stl'].includes(path.extname(name).toLowerCase()))
    .sort();

  for (const fileName of files) {
    const filePath = path.join(testMeshDir, fileName);
    const parsed = parseFile(filePath);
    validateCounts(fileName, parsed);

    console.log(JSON.stringify({
      file: fileName,
      vertices: parsed.vertices.length / 3,
      surfaceTriangles: parsed.indices.length / 3,
      meshEdges: parsed.edgeIndices.length / 2,
      elementCounts: parsed.elementCounts
    }));
  }
}

main();