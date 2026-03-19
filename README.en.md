# 3D Mesh Viewer

[繁體中文](README.md) | [English](README.en.md)

3D Mesh Viewer is a Visual Studio Code extension for inspecting common engineering and simulation mesh formats directly inside the editor.

It is intended for workflows where switching to a separate desktop mesh viewer is too slow or too disruptive. You can open a mesh file in VS Code, inspect the geometry immediately, switch between solid and wireframe modes, and quickly verify whether the parsed model looks correct without leaving your development environment.

## Features

- Open mesh files in a custom 3D viewer inside VS Code.
- Support both surface meshes and volumetric meshes.
- Extract and render outer surfaces for tetrahedral and hexahedral volume meshes.
- Provide solid mode, surface wireframe mode, and full mesh wireframe mode.
- Include a sidebar explorer for quickly locating mesh files in the workspace.

## Supported Formats

- `.mesh`: MEDIT ASCII mesh
- `.msh`: Gmsh ASCII mesh
- `.inp`: Abaqus input mesh
- `.vtk`: VTK legacy ASCII unstructured grid
- `.stl`: ASCII and binary STL

## Typical Use Cases

- Verify exported meshes before downstream simulation.
- Inspect boundary surfaces of tetrahedral or hexahedral volume meshes.
- Compare parser output while developing mesh import pipelines.
- Review mesh assets stored in a repository without switching tools.

## Viewer Capabilities

- Solid rendering for surface inspection
- Surface wireframe overlay for boundary review
- Mesh wireframe mode for element-edge inspection
- Adjustable shell opacity
- Color picker for quick visual contrast changes
- Orbit controls for rotate, pan, and zoom

## Installation

To install from a packaged release:

1. Download the `.vsix` file from the GitHub Releases page.
2. In VS Code, run `Extensions: Install from VSIX...`.
3. Select the downloaded `.vsix` file.

To package it locally:

```bash
npm ci
npm run package:vsix
```

## Development

Install dependencies:

```bash
npm ci
```

Run the local CI validation flow:

```bash
npm run ci
```

Start a development build:

```bash
npm run dev
```

Package the extension:

```bash
npm run package:vsix
```

## GitHub Release Flow

1. Push the repository to GitHub.
2. Update the version in `package.json`.
3. Push a matching tag such as `v0.1.0`.
4. GitHub Actions will run CI, package the extension, and publish a GitHub Release with the `.vsix` file attached.

## Project Notes

- The current `publisher` is set to `local-build` so the project can be packaged locally.
- Change the `publisher` field in `package.json` before publishing to the VS Code Marketplace.
- The current repository setup focuses on local packaging and GitHub Releases rather than direct Marketplace publishing.