/**
 * Export Utilities for Interior Design Studio:
 * - Download Coloured 3D Model (.GLB) using Three.js GLTFExporter
 * - Download Viewport Snapshot (.PNG)
 * - Download Design State (.JSON)
 */

import * as THREE from 'three';

export class StudioExporter {
  constructor(viewer, wallPainter, furnitureManager, architectureManager = null) {
    this.viewer = viewer;
    this.wallPainter = wallPainter;
    this.furnitureManager = furnitureManager;
    this.architectureManager = architectureManager;
  }

  downloadJSON(designData, conversionId) {
    const filename = `plan2space_design_${conversionId || 'export'}.json`;
    const jsonStr = JSON.stringify(designData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.triggerDownload(blob, filename);
  }

  downloadSnapshot(conversionId) {
    const dataUrl = this.viewer.captureSnapshot();
    const filename = `plan2space_render_${conversionId || 'export'}.png`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async downloadGLB(conversionId, onProgress = null) {
    if (onProgress) onProgress('Preparing 3D model export...');

    // Attempt to dynamically load GLTFExporter
    let GLTFExporterClass = null;
    try {
      const module = await import('three/addons/exporters/GLTFExporter.js');
      GLTFExporterClass = module.GLTFExporter;
    } catch (e1) {
      try {
        const cdnModule = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/exporters/GLTFExporter.js');
        GLTFExporterClass = cdnModule.GLTFExporter;
      } catch (e2) {
        console.error('Failed to load GLTFExporter:', e1, e2);
        throw new Error('GLTFExporter module could not be loaded. Please ensure internet access is available.');
      }
    }

    if (!GLTFExporterClass) {
      throw new Error('GLTFExporter not available.');
    }

    // Clone exportable elements into an export scene (exclude grid, lights, and helpers)
    const exportScene = new THREE.Scene();

    if (this.viewer.currentModel) {
      exportScene.add(this.viewer.currentModel.clone(true));
    }

    if (this.architectureManager && this.architectureManager.wallCutoutGroups) {
      this.architectureManager.wallCutoutGroups.forEach((group) => {
        if (group.visible) exportScene.add(group.clone(true));
      });
    }

    if (this.architectureManager && this.architectureManager.openings) {
      this.architectureManager.openings.forEach((op) => {
        if (op.visible) exportScene.add(op.clone(true));
      });
    }

    // Hide any demolished walls or base walls replaced by cutout submeshes
    exportScene.traverse((child) => {
      if (child.isMesh && child.userData.wallId) {
        const wallId = child.userData.wallId;
        if (this.architectureManager?.demolishedWallIds?.has(wallId)) {
          child.visible = false;
        } else if (this.architectureManager?.wallCutoutGroups?.has(wallId) && !child.userData.isWallCutoutSegment) {
          child.visible = false;
        }
      }
    });

    this.furnitureManager.items.forEach((item) => {
      exportScene.add(item.clone(true));
    });

    const exporter = new GLTFExporterClass();
    const options = {
      binary: true,
      onlyVisible: true,
      embedImages: true,
    };

    return new Promise((resolve, reject) => {
      exporter.parse(
        exportScene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const filename = `plan2space_interior_${conversionId || 'model'}.glb`;
            this.triggerDownload(blob, filename);
            resolve(filename);
          } else {
            const output = JSON.stringify(result, null, 2);
            const blob = new Blob([output], { type: 'application/json' });
            const filename = `plan2space_interior_${conversionId || 'model'}.gltf`;
            this.triggerDownload(blob, filename);
            resolve(filename);
          }
        },
        (error) => {
          console.error('GLTF Export error:', error);
          reject(error);
        },
        options
      );
    });
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
