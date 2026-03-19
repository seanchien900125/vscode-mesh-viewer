import * as path from 'path';
import { parseInp } from './inpParser';
import { parseMesh } from './meshParser';
import { parseMsh } from './mshParser';
import { parseStl } from './stlParser';
import { ParsedMesh } from './types';
import { parseVtk } from './vtkParser';

export function parseMeshFileBuffer(filePath: string, buffer: Buffer): ParsedMesh {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.mesh':
      return parseMesh(buffer.toString('utf8'));
    case '.stl':
      return parseStl(buffer);
    case '.msh':
      return parseMsh(buffer.toString('utf8'));
    case '.inp':
      return parseInp(buffer.toString('utf8'));
    case '.vtk':
      return parseVtk(buffer.toString('utf8'));
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}