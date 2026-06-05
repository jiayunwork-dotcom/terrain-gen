import * as THREE from 'three';
import Noise from './noise.js';

class VegetationSystem {
    constructor(terrain, size = 512) {
        this.terrain = terrain;
        this.size = size;
        this.noise = new Noise(54321);
        
        this.trees = [];
        this.grass = [];
        this.treeInstancedMesh = null;
        this.grassInstancedMesh = null;
        this.treeCount = 0;
        this.grassCount = 0;
        
        this.params = {
            enabled: true,
            treeDensity: 0.3,
            grassDensity: 0.5,
            maxHeight: 50,
            maxSlope: 0.5
        };
        
        this.grassMaterial = null;
    }

    createTreeGeometry() {
        const group = new THREE.Group();
        
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        group.add(trunk);
        
        const foliageGeometry1 = new THREE.ConeGeometry(2, 4, 8);
        const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
        const foliage1 = new THREE.Mesh(foliageGeometry1, foliageMaterial);
        foliage1.position.y = 4;
        foliage1.castShadow = true;
        group.add(foliage1);
        
        const foliageGeometry2 = new THREE.ConeGeometry(1.5, 3, 8);
        const foliage2 = new THREE.Mesh(foliageGeometry2, foliageMaterial);
        foliage2.position.y = 6;
        foliage2.castShadow = true;
        group.add(foliage2);
        
        const foliageGeometry3 = new THREE.ConeGeometry(1, 2, 8);
        const foliage3 = new THREE.Mesh(foliageGeometry3, foliageMaterial);
        foliage3.position.y = 7.5;
        foliage3.castShadow = true;
        group.add(foliage3);
        
        return group;
    }

    createGrassGeometry() {
        const geometry = new THREE.PlaneGeometry(0.3, 0.8, 1, 3);
        geometry.translate(0, 0.4, 0);
        return geometry;
    }

    createGrassMaterial() {
        const vertexShader = `
            uniform float uTime;
            uniform float uWindStrength;
            
            attribute float aHeight;
            attribute float aSeed;
            attribute vec3 aBasePosition;
            
            varying vec3 vColor;
            varying float vHeight;
            
            void main() {
                vec3 pos = position;
                
                float heightFactor = aHeight;
                
                float timeOffset = aSeed * 10.0;
                float wave1 = sin(uTime * 2.0 + aBasePosition.x * 0.1 + timeOffset);
                float wave2 = sin(uTime * 3.5 + aBasePosition.z * 0.15 + timeOffset + 1.5);
                float wave3 = cos(uTime * 1.5 + aBasePosition.x * 0.08 + aBasePosition.z * 0.08 + timeOffset);
                
                float windX = (wave1 + wave2 * 0.5 + wave3 * 0.3) * uWindStrength * heightFactor * 0.3;
                float windZ = (wave2 + wave1 * 0.5) * uWindStrength * heightFactor * 0.2;
                
                pos.x += windX;
                pos.z += windZ;
                
                pos.y += abs(windX + windZ) * heightFactor * 0.05;
                
                vHeight = aHeight;
                vColor = color;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;

        const fragmentShader = `
            varying vec3 vColor;
            varying float vHeight;
            
            void main() {
                vec3 color = vColor;
                
                float tipLighten = vHeight * 0.2;
                color += tipLighten;
                
                float alpha = 1.0;
                if (vHeight > 0.8) {
                    alpha = smoothstep(1.0, 0.8, vHeight);
                }
                
                gl_FragColor = vec4(color, alpha);
            }
        `;

        this.grassMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uWindStrength: { value: 1.0 }
            },
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true
        });

        return this.grassMaterial;
    }

    generate() {
        this.clear();
        
        const halfSize = this.size / 2;
        const treeSpacing = 5 / Math.max(0.1, this.params.treeDensity);
        const grassSpacing = 1.5 / Math.max(0.1, this.params.grassDensity);
        
        const treePositions = [];
        
        for (let x = -halfSize; x < halfSize; x += treeSpacing) {
            for (let z = -halfSize; z < halfSize; z += treeSpacing) {
                const offsetX = (Math.random() - 0.5) * treeSpacing * 0.5;
                const offsetZ = (Math.random() - 0.5) * treeSpacing * 0.5;
                const px = x + offsetX;
                const pz = z + offsetZ;
                
                const height = this.terrain.getHeightAt(px, pz);
                const slope = this.terrain.getSlopeAt(px, pz);
                
                if (height < this.params.maxHeight && 
                    height > this.terrain.textureParams.sandHeight &&
                    slope < this.params.maxSlope) {
                    
                    const noiseVal = this.noise.perlin2(px * 0.1, pz * 0.1);
                    if (noiseVal > 0.2) {
                        treePositions.push({ x: px, y: height, z: pz });
                    }
                }
            }
        }
        
        this.treeCount = treePositions.length;
        if (this.treeCount > 0) {
            const treeGroup = this.createTreeGeometry();
            const mergedGeometry = new THREE.BufferGeometry();
            const positions = [];
            const normals = [];
            const uvs = [];
            const indices = [];
            
            treeGroup.traverse((child) => {
                if (child.isMesh) {
                    const geo = child.geometry;
                    const posAttr = geo.attributes.position;
                    const normAttr = geo.attributes.normal;
                    const uvAttr = geo.attributes.uv;
                    const idxAttr = geo.index;
                    
                    const idxOffset = positions.length / 3;
                    
                    for (let i = 0; i < posAttr.count; i++) {
                        const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
                        v.applyMatrix4(child.matrixWorld);
                        positions.push(v.x, v.y, v.z);
                        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
                        if (uvAttr) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
                    }
                    
                    if (idxAttr) {
                        for (let i = 0; i < idxAttr.count; i++) {
                            indices.push(idxAttr.getX(i) + idxOffset);
                        }
                    }
                }
            });
            
            const basePositions = new Float32Array(positions);
            const baseNormals = new Float32Array(normals);
            const baseUVs = new Float32Array(uvs);
            const baseIndices = new Uint32Array(indices);
            const vertexCount = basePositions.length / 3;
            
            const instancedPositions = new Float32Array(this.treeCount * vertexCount * 3);
            const instancedNormals = new Float32Array(this.treeCount * vertexCount * 3);
            const instancedUVs = new Float32Array(this.treeCount * vertexCount * 2);
            const instancedIndices = new Uint32Array(this.treeCount * baseIndices.length);
            
            for (let i = 0; i < this.treeCount; i++) {
                const pos = treePositions[i];
                const scale = 0.7 + Math.random() * 0.6;
                const rotation = Math.random() * Math.PI * 2;
                
                const vertexOffset = i * vertexCount;
                const indexOffset = i * baseIndices.length;
                
                for (let v = 0; v < vertexCount; v++) {
                    const srcIdx = v * 3;
                    const dstIdx = vertexOffset * 3 + v * 3;
                    
                    let vx = basePositions[srcIdx] * scale;
                    let vy = basePositions[srcIdx + 1] * scale;
                    let vz = basePositions[srcIdx + 2] * scale;
                    
                    const cosR = Math.cos(rotation);
                    const sinR = Math.sin(rotation);
                    const rx = vx * cosR - vz * sinR;
                    const rz = vx * sinR + vz * cosR;
                    
                    instancedPositions[dstIdx] = rx + pos.x;
                    instancedPositions[dstIdx + 1] = vy + pos.y;
                    instancedPositions[dstIdx + 2] = rz + pos.z;
                    
                    instancedNormals[dstIdx] = baseNormals[srcIdx];
                    instancedNormals[dstIdx + 1] = baseNormals[srcIdx + 1];
                    instancedNormals[dstIdx + 2] = baseNormals[srcIdx + 2];
                    
                    instancedUVs[(vertexOffset + v) * 2] = baseUVs[v * 2];
                    instancedUVs[(vertexOffset + v) * 2 + 1] = baseUVs[v * 2 + 1];
                }
                
                for (let idx = 0; idx < baseIndices.length; idx++) {
                    instancedIndices[indexOffset + idx] = baseIndices[idx] + vertexOffset;
                }
            }
            
            const treeGeometry = new THREE.BufferGeometry();
            treeGeometry.setAttribute('position', new THREE.BufferAttribute(instancedPositions, 3));
            treeGeometry.setAttribute('normal', new THREE.BufferAttribute(instancedNormals, 3));
            treeGeometry.setAttribute('uv', new THREE.BufferAttribute(instancedUVs, 2));
            treeGeometry.setIndex(new THREE.BufferAttribute(instancedIndices, 1));
            
            const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: false });
            this.treeInstancedMesh = new THREE.Mesh(treeGeometry, treeMaterial);
            this.treeInstancedMesh.castShadow = true;
            this.treeInstancedMesh.receiveShadow = true;
        }
        
        const grassPositions = [];
        for (let x = -halfSize; x < halfSize; x += grassSpacing) {
            for (let z = -halfSize; z < halfSize; z += grassSpacing) {
                const offsetX = (Math.random() - 0.5) * grassSpacing * 0.8;
                const offsetZ = (Math.random() - 0.5) * grassSpacing * 0.8;
                const px = x + offsetX;
                const pz = z + offsetZ;
                
                const height = this.terrain.getHeightAt(px, pz);
                const slope = this.terrain.getSlopeAt(px, pz);
                
                if (height < this.params.maxHeight && 
                    height > this.terrain.textureParams.sandHeight + 5 &&
                    slope < this.params.maxSlope + 0.2) {
                    
                    const noiseVal = this.noise.perlin2(px * 0.15 + 1000, pz * 0.15 + 1000);
                    if (noiseVal > 0) {
                        grassPositions.push({ x: px, y: height, z: pz, seed: Math.random() });
                    }
                }
            }
        }
        
        this.grassCount = grassPositions.length;
        if (this.grassCount > 0) {
            const grassBaseGeo = this.createGrassGeometry();
            const basePos = grassBaseGeo.attributes.position.array;
            const baseUV = grassBaseGeo.attributes.uv.array;
            const grassVertexCount = 8;
            
            const instancedPos = new Float32Array(this.grassCount * grassVertexCount * 3);
            const instancedUV = new Float32Array(this.grassCount * grassVertexCount * 2);
            const instancedIdx = new Uint32Array(this.grassCount * 12);
            const colors = new Float32Array(this.grassCount * grassVertexCount * 3);
            const heights = new Float32Array(this.grassCount * grassVertexCount);
            const seeds = new Float32Array(this.grassCount * grassVertexCount);
            const basePositions = new Float32Array(this.grassCount * grassVertexCount * 3);
            
            for (let i = 0; i < this.grassCount; i++) {
                const pos = grassPositions[i];
                const rotation = Math.random() * Math.PI * 2;
                const scale = 0.8 + Math.random() * 0.4;
                
                const grassColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.6, 0.35 + Math.random() * 0.1);
                
                const vertexOffset = i * grassVertexCount;
                const indexOffset = i * 12;
                
                for (let v = 0; v < grassVertexCount; v++) {
                    const srcIdx = v * 3;
                    const dstIdx = vertexOffset * 3 + v * 3;
                    
                    let vx = basePos[srcIdx] * scale;
                    let vy = basePos[srcIdx + 1] * scale;
                    let vz = basePos[srcIdx + 2] * scale;
                    
                    const cosR = Math.cos(rotation);
                    const sinR = Math.sin(rotation);
                    const rx = vx * cosR - vz * sinR;
                    const rz = vx * sinR + vz * cosR;
                    
                    instancedPos[dstIdx] = rx + pos.x;
                    instancedPos[dstIdx + 1] = vy + pos.y;
                    instancedPos[dstIdx + 2] = rz + pos.z;
                    
                    basePositions[dstIdx] = pos.x;
                    basePositions[dstIdx + 1] = pos.y;
                    basePositions[dstIdx + 2] = pos.z;
                    
                    instancedUV[(vertexOffset + v) * 2] = baseUV[v * 2];
                    instancedUV[(vertexOffset + v) * 2 + 1] = baseUV[v * 2 + 1];
                    
                    colors[dstIdx] = grassColor.r;
                    colors[dstIdx + 1] = grassColor.g;
                    colors[dstIdx + 2] = grassColor.b;
                    
                    const normalizedHeight = basePos[srcIdx + 1] / 0.8;
                    heights[vertexOffset + v] = Math.max(0, normalizedHeight);
                    seeds[vertexOffset + v] = pos.seed;
                }
                
                const idx = vertexOffset;
                instancedIdx[indexOffset] = idx;
                instancedIdx[indexOffset + 1] = idx + 1;
                instancedIdx[indexOffset + 2] = idx + 2;
                instancedIdx[indexOffset + 3] = idx + 2;
                instancedIdx[indexOffset + 4] = idx + 1;
                instancedIdx[indexOffset + 5] = idx + 3;
                instancedIdx[indexOffset + 6] = idx + 4;
                instancedIdx[indexOffset + 7] = idx + 5;
                instancedIdx[indexOffset + 8] = idx + 6;
                instancedIdx[indexOffset + 9] = idx + 6;
                instancedIdx[indexOffset + 10] = idx + 5;
                instancedIdx[indexOffset + 11] = idx + 7;
            }
            
            const grassGeometry = new THREE.BufferGeometry();
            grassGeometry.setAttribute('position', new THREE.BufferAttribute(instancedPos, 3));
            grassGeometry.setAttribute('uv', new THREE.BufferAttribute(instancedUV, 2));
            grassGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            grassGeometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
            grassGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
            grassGeometry.setAttribute('aBasePosition', new THREE.BufferAttribute(basePositions, 3));
            grassGeometry.setIndex(new THREE.BufferAttribute(instancedIdx, 1));
            
            this.createGrassMaterial();
            this.grassInstancedMesh = new THREE.Mesh(grassGeometry, this.grassMaterial);
        }
    }

    update(time) {
        if (this.grassMaterial && this.grassInstancedMesh && this.grassInstancedMesh.visible) {
            this.grassMaterial.uniforms.uTime.value = time;
        }
    }

    addToScene(scene) {
        if (this.treeInstancedMesh && this.params.enabled) {
            scene.add(this.treeInstancedMesh);
        }
        if (this.grassInstancedMesh && this.params.enabled) {
            scene.add(this.grassInstancedMesh);
        }
    }

    removeFromScene(scene) {
        if (this.treeInstancedMesh) {
            scene.remove(this.treeInstancedMesh);
        }
        if (this.grassInstancedMesh) {
            scene.remove(this.grassInstancedMesh);
        }
    }

    clear() {
        this.trees = [];
        this.grass = [];
        this.treeCount = 0;
        this.grassCount = 0;
        this.treeInstancedMesh = null;
        this.grassInstancedMesh = null;
        this.grassMaterial = null;
    }

    getTotalCount() {
        return this.treeCount + this.grassCount;
    }

    setVisible(visible) {
        if (this.treeInstancedMesh) {
            this.treeInstancedMesh.visible = visible;
        }
        if (this.grassInstancedMesh) {
            this.grassInstancedMesh.visible = visible;
        }
    }

    getMemoryUsage() {
        let bytes = 0;
        if (this.treeInstancedMesh) {
            const geo = this.treeInstancedMesh.geometry;
            bytes += geo.attributes.position.array.byteLength;
            bytes += geo.attributes.normal.array.byteLength;
            bytes += geo.attributes.uv.array.byteLength;
            bytes += geo.index.array.byteLength;
        }
        if (this.grassInstancedMesh) {
            const geo = this.grassInstancedMesh.geometry;
            bytes += geo.attributes.position.array.byteLength;
            bytes += geo.attributes.uv.array.byteLength;
            bytes += geo.attributes.color.array.byteLength;
            bytes += geo.attributes.aHeight.array.byteLength;
            bytes += geo.attributes.aSeed.array.byteLength;
            bytes += geo.attributes.aBasePosition.array.byteLength;
            bytes += geo.index.array.byteLength;
        }
        return bytes;
    }
}

export default VegetationSystem;
