import * as THREE from 'three';

class Exporter {
    constructor(terrain, size = 512) {
        this.terrain = terrain;
        this.size = size;
    }

    exportHeightMap(resolution = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;
        
        const minMax = this.getHeightMinMax();
        const range = minMax.max - minMax.min;
        
        const srcStep = this.terrain.resolution / resolution;
        
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const srcX = Math.floor(x * srcStep);
                const srcY = Math.floor(y * srcStep);
                const srcIdx = srcY * this.terrain.resolution + srcX;
                const height = this.terrain.heightMap[srcIdx];
                
                const normalized = (height - minMax.min) / range;
                const grayValue = Math.floor(normalized * 65535);
                
                const highByte = (grayValue >> 8) & 0xFF;
                const lowByte = grayValue & 0xFF;
                
                const dstIdx = (y * resolution + x) * 4;
                data[dstIdx] = highByte;
                data[dstIdx + 1] = highByte;
                data[dstIdx + 2] = highByte;
                data[dstIdx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const link = document.createElement('a');
        link.download = `heightmap_${resolution}x${resolution}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        return { min: minMax.min, max: minMax.max };
    }

    getHeightMinMax() {
        let min = Infinity;
        let max = -Infinity;
        
        for (let i = 0; i < this.terrain.heightMap.length; i++) {
            const h = this.terrain.heightMap[i];
            if (h < min) min = h;
            if (h > max) max = h;
        }
        
        return { min, max };
    }

    exportOBJ() {
        const geometry = this.terrain.geometry;
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const uvs = geometry.attributes.uv.array;
        const indices = geometry.index.array;
        
        let obj = '# Terrain OBJ Export\n';
        obj += `# Vertices: ${positions.length / 3}\n`;
        obj += `# Faces: ${indices.length / 3}\n\n`;
        
        for (let i = 0; i < positions.length; i += 3) {
            obj += `v ${positions[i].toFixed(4)} ${positions[i + 1].toFixed(4)} ${positions[i + 2].toFixed(4)}\n`;
        }
        
        obj += '\n';
        
        for (let i = 0; i < normals.length; i += 3) {
            obj += `vn ${normals[i].toFixed(4)} ${normals[i + 1].toFixed(4)} ${normals[i + 2].toFixed(4)}\n`;
        }
        
        obj += '\n';
        
        for (let i = 0; i < uvs.length; i += 2) {
            obj += `vt ${uvs[i].toFixed(4)} ${uvs[i + 1].toFixed(4)}\n`;
        }
        
        obj += '\n';
        
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i] + 1;
            const i1 = indices[i + 1] + 1;
            const i2 = indices[i + 2] + 1;
            obj += `f ${i0}/${i0}/${i0} ${i1}/${i1}/${i1} ${i2}/${i2}/${i2}\n`;
        }
        
        const blob = new Blob([obj], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = 'terrain.obj';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }
}

export default Exporter;
