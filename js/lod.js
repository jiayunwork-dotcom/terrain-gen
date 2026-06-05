import * as THREE from 'three';

class TerrainLOD {
    constructor(terrain, size = 512, resolution = 256) {
        this.terrain = terrain;
        this.size = size;
        this.resolution = resolution;
        this.blockResolutions = [64, 32, 16, 8];
        this.lodDistances = [100, 200, 350, 500];
        this.blocks = [];
        this.blockGroup = new THREE.Group();
        this.enabled = false;
        this.camera = null;
    }

    generateBlocks() {
        this.blocks = [];
        this.blockGroup.clear();
        
        const levels = this.blockResolutions.length;
        
        this.createBlockHierarchy(0, 0, this.size, this.resolution, 0);
        
        return this.blockGroup;
    }

    createBlockHierarchy(offsetX, offsetZ, size, resolution, level) {
        if (level >= this.blockResolutions.length) return;
        
        const blockResolution = this.blockResolutions[level];
        
        if (size <= this.size / 4 || level === this.blockResolutions.length - 1) {
            const block = this.createBlock(offsetX, offsetZ, size, blockResolution, level);
            this.blocks.push(block);
            this.blockGroup.add(block.mesh);
            return;
        }
        
        const halfSize = size / 2;
        const nextLevel = level + 1;
        
        this.createBlockHierarchy(offsetX, offsetZ, halfSize, resolution / 2, nextLevel);
        this.createBlockHierarchy(offsetX + halfSize, offsetZ, halfSize, resolution / 2, nextLevel);
        this.createBlockHierarchy(offsetX, offsetZ + halfSize, halfSize, resolution / 2, nextLevel);
        this.createBlockHierarchy(offsetX + halfSize, offsetZ + halfSize, halfSize, resolution / 2, nextLevel);
    }

    createBlock(offsetX, offsetZ, size, resolution, level) {
        const halfSize = this.size / 2;
        const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
        geometry.rotateX(-Math.PI / 2);
        
        const positions = geometry.attributes.position.array;
        const step = size / (resolution - 1);
        
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const worldX = offsetX + x * step - halfSize;
                const worldZ = offsetZ + z * step - halfSize;
                const height = this.terrain.getHeightAt(worldX, worldZ);
                const idx = (z * resolution + x) * 3;
                positions[idx + 1] = height;
                positions[idx] = worldX;
                positions[idx + 2] = worldZ;
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        const material = this.terrain.material.clone();
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        mesh.visible = false;
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        
        const centerX = offsetX + size / 2 - halfSize;
        const centerZ = offsetZ + size / 2 - halfSize;
        
        return {
            mesh,
            geometry,
            material,
            level,
            center: new THREE.Vector3(centerX, 0, centerZ),
            size,
            offsetX,
            offsetZ,
            resolution,
            neighbors: { left: null, right: null, top: null, bottom: null }
        };
    }

    fixCracks(block) {
        const positions = block.geometry.attributes.position.array;
        const res = block.resolution;
        const step = block.size / (res - 1);
        const halfSize = this.size / 2;
        
        const fixEdge = (edgeBlock, edge) => {
            if (!edgeBlock || edgeBlock.level >= block.level) return;
            
            const levelDiff = block.level - edgeBlock.level;
            const skipRate = Math.pow(2, levelDiff);
            
            switch (edge) {
                case 'left':
                    for (let z = 0; z < res; z++) {
                        if (z % skipRate === 0) continue;
                        const idx = (z * res) * 3;
                        const neighborZ = Math.round(z / skipRate) * skipRate;
                        const neighborIdx = (neighborZ * res) * 3;
                        positions[idx + 1] = (positions[idx + 1] + positions[neighborIdx + 1]) / 2;
                    }
                    break;
                case 'right':
                    for (let z = 0; z < res; z++) {
                        if (z % skipRate === 0) continue;
                        const idx = (z * res + res - 1) * 3;
                        const neighborZ = Math.round(z / skipRate) * skipRate;
                        const neighborIdx = (neighborZ * res + res - 1) * 3;
                        positions[idx + 1] = (positions[idx + 1] + positions[neighborIdx + 1]) / 2;
                    }
                    break;
                case 'top':
                    for (let x = 0; x < res; x++) {
                        if (x % skipRate === 0) continue;
                        const idx = x * 3;
                        const neighborX = Math.round(x / skipRate) * skipRate;
                        const neighborIdx = neighborX * 3;
                        positions[idx + 1] = (positions[idx + 1] + positions[neighborIdx + 1]) / 2;
                    }
                    break;
                case 'bottom':
                    for (let x = 0; x < res; x++) {
                        if (x % skipRate === 0) continue;
                        const idx = ((res - 1) * res + x) * 3;
                        const neighborX = Math.round(x / skipRate) * skipRate;
                        const neighborIdx = ((res - 1) * res + neighborX) * 3;
                        positions[idx + 1] = (positions[idx + 1] + positions[neighborIdx + 1]) / 2;
                    }
                    break;
            }
        };
        
        fixEdge(block.neighbors.left, 'left');
        fixEdge(block.neighbors.right, 'right');
        fixEdge(block.neighbors.top, 'top');
        fixEdge(block.neighbors.bottom, 'bottom');
        
        block.geometry.attributes.position.needsUpdate = true;
        block.geometry.computeVertexNormals();
    }

    update(camera) {
        if (!this.enabled) {
            this.blocks.forEach(block => block.mesh.visible = false);
            return;
        }
        
        this.camera = camera;
        
        let totalTriangles = 0;
        let totalVertices = 0;
        
        this.blocks.forEach(block => {
            const distance = camera.position.distanceTo(block.center);
            let targetLevel = 0;
            
            for (let i = 0; i < this.lodDistances.length; i++) {
                if (distance > this.lodDistances[i]) {
                    targetLevel = i + 1;
                }
            }
            
            targetLevel = Math.min(targetLevel, this.blockResolutions.length - 1);
            const visible = block.level === targetLevel;
            block.mesh.visible = visible;
            
            if (visible) {
                totalTriangles += (block.resolution - 1) * (block.resolution - 1) * 2;
                totalVertices += block.resolution * block.resolution;
            }
        });
        
        return { triangles: totalTriangles, vertices: totalVertices };
    }

    updateAllHeights() {
        this.blocks.forEach(block => {
            const positions = block.geometry.attributes.position.array;
            const res = block.resolution;
            const step = block.size / (res - 1);
            const halfSize = this.size / 2;
            
            for (let z = 0; z < res; z++) {
                for (let x = 0; x < res; x++) {
                    const worldX = block.offsetX + x * step - halfSize;
                    const worldZ = block.offsetZ + z * step - halfSize;
                    const height = this.terrain.getHeightAt(worldX, worldZ);
                    const idx = (z * res + x) * 3;
                    positions[idx + 1] = height;
                }
            }
            
            block.geometry.attributes.position.needsUpdate = true;
            block.geometry.computeVertexNormals();
        });
    }

    setSunDirection(direction) {
        this.blocks.forEach(block => {
            if (block.material.uniforms) {
                block.material.uniforms.uSunDirection.value.copy(direction);
            }
        });
    }

    updateTime(time) {
        this.blocks.forEach(block => {
            if (block.material.uniforms) {
                block.material.uniforms.uTime.value = time;
            }
        });
    }

    getTriangleCount() {
        return this.blocks.reduce((sum, block) => {
            return sum + (block.mesh.visible ? (block.resolution - 1) * (block.resolution - 1) * 2 : 0);
        }, 0);
    }

    getVertexCount() {
        return this.blocks.reduce((sum, block) => {
            return sum + (block.mesh.visible ? block.resolution * block.resolution : 0);
        }, 0);
    }

    getMemoryUsage() {
        let totalBytes = 0;
        this.blocks.forEach(block => {
            const posBytes = block.resolution * block.resolution * 3 * 4;
            const normBytes = block.resolution * block.resolution * 3 * 4;
            const uvBytes = block.resolution * block.resolution * 2 * 4;
            const idxBytes = (block.resolution - 1) * (block.resolution - 1) * 6 * 4;
            totalBytes += posBytes + normBytes + uvBytes + idxBytes;
        });
        return totalBytes;
    }
}

export default TerrainLOD;
