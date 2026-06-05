import * as THREE from 'three';
import Noise from './noise.js';
import { LayerManager } from './layers.js';

class TerrainGenerator {
    constructor(size = 512, resolution = 256) {
        this.size = size;
        this.resolution = resolution;
        this.noise = new Noise(12345);
        this.layerManager = new LayerManager(resolution);
        this.geometry = null;
        this.mesh = null;
        this.material = null;
        
        this.params = {
            noiseType: 'perlin',
            octaves: 6,
            frequency: 0.02,
            amplitude: 50,
            lacunarity: 2.0,
            persistence: 0.5,
            seed: 12345
        };

        this.textureParams = {
            grassHeight: 20,
            rockSlope: 0.6,
            snowHeight: 60,
            sandHeight: -10,
            blendRange: 10
        };
    }

    get heightMap() {
        return this.layerManager.combineLayers();
    }

    set heightMap(value) {
        if (this.layerManager.layers.length === 0) {
            this.layerManager.createLayer('基础图层', value);
        } else {
            const activeLayer = this.layerManager.getActiveLayer();
            if (activeLayer) {
                activeLayer.heightMap = new Float32Array(value);
            }
        }
    }

    generateHeightMap() {
        this.noise.setSeed(this.params.seed);
        const heightMap = new Float32Array(this.resolution * this.resolution);
        
        const halfSize = this.size / 2;
        const step = this.size / (this.resolution - 1);

        for (let z = 0; z < this.resolution; z++) {
            for (let x = 0; x < this.resolution; x++) {
                const worldX = x * step - halfSize;
                const worldZ = z * step - halfSize;
                
                let height = this.noise.fbm(worldX, worldZ, {
                    octaves: this.params.octaves,
                    frequency: this.params.frequency,
                    amplitude: this.params.amplitude,
                    lacunarity: this.params.lacunarity,
                    persistence: this.params.persistence,
                    type: this.params.noiseType
                });
                
                heightMap[z * this.resolution + x] = height;
            }
        }

        if (this.layerManager.layers.length === 0) {
            this.layerManager.createLayer('基础图层', heightMap);
        } else {
            const activeLayer = this.layerManager.getActiveLayer();
            if (activeLayer) {
                activeLayer.heightMap = heightMap;
            }
        }
        return heightMap;
    }

    createGeometry() {
        this.generateHeightMap();
        
        const geometry = new THREE.PlaneGeometry(
            this.size, 
            this.size, 
            this.resolution - 1, 
            this.resolution - 1
        );
        
        geometry.rotateX(-Math.PI / 2);
        
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < this.resolution * this.resolution; i++) {
            positions[i * 3 + 1] = this.heightMap[i];
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        this.geometry = geometry;
        return geometry;
    }

    createMaterial() {
        const vertexShader = `
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            
            void main() {
                vPosition = position;
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform vec3 uSunDirection;
            uniform float uTime;
            
            uniform float uGrassHeight;
            uniform float uRockSlope;
            uniform float uSnowHeight;
            uniform float uSandHeight;
            uniform float uBlendRange;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            
            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 4; i++) {
                    value += amplitude * noise(p);
                    p *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
            
            vec3 getGrassColor(vec2 uv) {
                float variation = fbm(uv * 50.0);
                vec3 grassBase = vec3(0.25, 0.5, 0.2);
                vec3 grassDark = vec3(0.15, 0.35, 0.1);
                return mix(grassBase, grassDark, variation);
            }
            
            vec3 getRockColor(vec2 uv) {
                float variation = fbm(uv * 30.0);
                vec3 rockBase = vec3(0.4, 0.38, 0.35);
                vec3 rockDark = vec3(0.25, 0.23, 0.2);
                return mix(rockBase, rockDark, variation);
            }
            
            vec3 getSnowColor(vec2 uv) {
                float variation = fbm(uv * 40.0);
                vec3 snowBase = vec3(0.95, 0.97, 1.0);
                vec3 snowDark = vec3(0.8, 0.85, 0.9);
                return mix(snowBase, snowDark, variation);
            }
            
            vec3 getSandColor(vec2 uv) {
                float variation = fbm(uv * 60.0);
                vec3 sandBase = vec3(0.76, 0.7, 0.5);
                vec3 sandDark = vec3(0.6, 0.55, 0.4);
                return mix(sandBase, sandDark, variation);
            }
            
            float smoothBlend(float value, float low, float high, float range) {
                if (value < low - range) return 0.0;
                if (value > high + range) return 1.0;
                if (value < low + range) {
                    return smoothstep(low - range, low + range, value);
                }
                if (value > high - range) {
                    return smoothstep(high - range, high + range, value);
                }
                return 0.5;
            }
            
            void main() {
                float height = vPosition.y;
                float slope = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 1.0, 0.0)));
                vec2 uv = vUv * 20.0;
                
                vec3 grassColor = getGrassColor(uv);
                vec3 rockColor = getRockColor(uv);
                vec3 snowColor = getSnowColor(uv);
                vec3 sandColor = getSandColor(uv);
                
                vec3 finalColor = sandColor;
                
                float sandToGrass = smoothstep(uSandHeight - uBlendRange, uSandHeight + uBlendRange, height);
                finalColor = mix(finalColor, grassColor, sandToGrass);
                
                float grassToRock = smoothstep(uRockSlope - 0.1, uRockSlope + 0.1, slope);
                float rockFactor = grassToRock * (1.0 - smoothstep(uSnowHeight - uBlendRange, uSnowHeight, height));
                finalColor = mix(finalColor, rockColor, rockFactor);
                
                float grassToSnow = smoothstep(uSnowHeight - uBlendRange, uSnowHeight + uBlendRange, height);
                float snowFactor = grassToSnow * (1.0 - slope * 0.5);
                finalColor = mix(finalColor, snowColor, snowFactor);
                
                vec3 lightDir = normalize(uSunDirection);
                float diffuse = max(0.0, dot(vNormal, lightDir));
                float ambient = 0.3;
                
                float shadow = diffuse * 0.7 + ambient;
                
                vec3 finalColorLit = finalColor * shadow;
                
                gl_FragColor = vec4(finalColorLit, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
                uTime: { value: 0 },
                uGrassHeight: { value: this.textureParams.grassHeight },
                uRockSlope: { value: this.textureParams.rockSlope },
                uSnowHeight: { value: this.textureParams.snowHeight },
                uSandHeight: { value: this.textureParams.sandHeight },
                uBlendRange: { value: this.textureParams.blendRange }
            }
        });

        this.material = material;
        return material;
    }

    createMesh() {
        this.createGeometry();
        this.createMaterial();
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        return this.mesh;
    }

    updateTextureParams() {
        if (this.material) {
            this.material.uniforms.uGrassHeight.value = this.textureParams.grassHeight;
            this.material.uniforms.uRockSlope.value = this.textureParams.rockSlope;
            this.material.uniforms.uSnowHeight.value = this.textureParams.snowHeight;
            this.material.uniforms.uSandHeight.value = this.textureParams.sandHeight;
            this.material.uniforms.uBlendRange.value = this.textureParams.blendRange;
        }
    }

    regenerate() {
        if (this.mesh) {
            this.generateHeightMap();
            this.updateGeometryFromHeightMap();
        }
    }

    updateGeometryFromHeightMap() {
        const positions = this.geometry.attributes.position.array;
        
        for (let i = 0; i < this.resolution * this.resolution; i++) {
            positions[i * 3 + 1] = this.heightMap[i];
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }

    getHeightAt(x, z) {
        const halfSize = this.size / 2;
        const step = this.size / (this.resolution - 1);
        
        const gridX = Math.floor((x + halfSize) / step);
        const gridZ = Math.floor((z + halfSize) / step);
        
        if (gridX < 0 || gridX >= this.resolution - 1 || gridZ < 0 || gridZ >= this.resolution - 1) {
            return 0;
        }
        
        const x0 = gridX * step - halfSize;
        const z0 = gridZ * step - halfSize;
        const tx = (x - x0) / step;
        const tz = (z - z0) / step;
        
        const h00 = this.heightMap[gridZ * this.resolution + gridX];
        const h10 = this.heightMap[gridZ * this.resolution + gridX + 1];
        const h01 = this.heightMap[(gridZ + 1) * this.resolution + gridX];
        const h11 = this.heightMap[(gridZ + 1) * this.resolution + gridX + 1];
        
        const h0 = h00 * (1 - tx) + h10 * tx;
        const h1 = h01 * (1 - tx) + h11 * tx;
        
        return h0 * (1 - tz) + h1 * tz;
    }

    getSlopeAt(x, z) {
        const eps = 0.5;
        const hL = this.getHeightAt(x - eps, z);
        const hR = this.getHeightAt(x + eps, z);
        const hD = this.getHeightAt(x, z - eps);
        const hU = this.getHeightAt(x, z + eps);
        
        const dx = (hR - hL) / (2 * eps);
        const dz = (hU - hD) / (2 * eps);
        
        return Math.sqrt(dx * dx + dz * dz);
    }

    setHeightAt(x, z, height) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.locked) return;
        
        const halfSize = this.size / 2;
        const step = this.size / (this.resolution - 1);
        
        const gridX = Math.floor((x + halfSize) / step);
        const gridZ = Math.floor((z + halfSize) / step);
        
        if (gridX >= 0 && gridX < this.resolution && gridZ >= 0 && gridZ < this.resolution) {
            activeLayer.heightMap[gridZ * this.resolution + gridX] = height;
        }
    }

    applyBrush(centerX, centerZ, brushType, size, strength, flattenHeight = 0) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.locked) return;
        
        const halfSize = this.size / 2;
        const step = this.size / (this.resolution - 1);
        
        const gridSize = Math.ceil(size / step);
        const centerGridX = Math.floor((centerX + halfSize) / step);
        const centerGridZ = Math.floor((centerZ + halfSize) / step);
        
        const layerHeightMap = activeLayer.heightMap;
        
        for (let dz = -gridSize; dz <= gridSize; dz++) {
            for (let dx = -gridSize; dx <= gridSize; dx++) {
                const gridX = centerGridX + dx;
                const gridZ = centerGridZ + dz;
                
                if (gridX < 0 || gridX >= this.resolution || gridZ < 0 || gridZ >= this.resolution) {
                    continue;
                }
                
                const worldX = gridX * step - halfSize;
                const worldZ = gridZ * step - halfSize;
                
                const dist = Math.sqrt(
                    Math.pow(worldX - centerX, 2) + 
                    Math.pow(worldZ - centerZ, 2)
                );
                
                if (dist > size) continue;
                
                const falloff = 1 - (dist / size);
                const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
                const weight = smoothFalloff * strength * 0.1;
                
                const idx = gridZ * this.resolution + gridX;
                let height = layerHeightMap[idx];
                
                switch (brushType) {
                    case 'raise':
                        height += weight * 10;
                        break;
                    case 'lower':
                        height -= weight * 10;
                        break;
                    case 'flatten':
                        height = height * (1 - weight) + flattenHeight * weight;
                        break;
                    case 'erode':
                        const slope = this.getSlopeAt(worldX, worldZ);
                        height -= slope * weight * 5;
                        break;
                    case 'noise':
                        const noiseVal = (Math.random() - 0.5) * 2;
                        height += noiseVal * weight * 10;
                        break;
                }
                
                layerHeightMap[idx] = height;
            }
        }
        
        this.updateGeometryFromHeightMap();
    }

    cloneHeightMap() {
        return this.layerManager.toJSON();
    }

    restoreHeightMap(state) {
        if (state instanceof Float32Array) {
            if (this.layerManager.layers.length === 0) {
                this.layerManager.createLayer('基础图层', state);
            } else {
                const activeLayer = this.layerManager.getActiveLayer();
                if (activeLayer) {
                    activeLayer.heightMap = new Float32Array(state);
                }
            }
        } else if (state && state.layers) {
            const manager = LayerManager.fromJSON(state);
            this.layerManager = manager;
        }
        this.updateGeometryFromHeightMap();
    }

    getTriangleCount() {
        return (this.resolution - 1) * (this.resolution - 1) * 2;
    }

    getVertexCount() {
        return this.resolution * this.resolution;
    }
}

export default TerrainGenerator;
