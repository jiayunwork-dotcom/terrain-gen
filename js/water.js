import * as THREE from 'three';

class WaterSystem {
    constructor(size = 512) {
        this.size = size;
        this.mesh = null;
        this.material = null;
        this.geometry = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        
        this.params = {
            enabled: true,
            level: 5,
            waveStrength: 0.5,
            opacity: 0.8
        };
    }

    createMesh() {
        this.geometry = new THREE.PlaneGeometry(this.size, this.size, 256, 256);
        this.geometry.rotateX(-Math.PI / 2);
        
        const vertexShader = `
            uniform float uTime;
            uniform float uWaveStrength;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vWaveHeight;
            varying vec3 vViewDir;
            
            void main() {
                vPosition = position;
                vUv = uv;
                
                vec3 pos = position;
                
                float wave1 = sin(pos.x * 0.05 + uTime * 0.5) * cos(pos.z * 0.05 + uTime * 0.3);
                float wave2 = sin(pos.x * 0.08 + uTime * 0.7 + 1.0) * cos(pos.z * 0.06 + uTime * 0.4 + 2.0);
                float wave3 = sin(pos.x * 0.12 + uTime * 0.9 + 3.0) * cos(pos.z * 0.1 + uTime * 0.6 + 1.5);
                float wave4 = sin(pos.x * 0.2 + uTime * 1.2 + 5.0) * cos(pos.z * 0.18 + uTime * 0.8 + 2.5) * 0.3;
                float waveHeight = (wave1 + wave2 * 0.5 + wave3 * 0.25 + wave4 * 0.15) * uWaveStrength;
                
                pos.y += waveHeight;
                vWaveHeight = waveHeight;
                
                float eps = 0.1;
                float h1 = sin((pos.x + eps) * 0.05 + uTime * 0.5) * cos(pos.z * 0.05 + uTime * 0.3);
                float h2 = sin((pos.x - eps) * 0.05 + uTime * 0.5) * cos(pos.z * 0.05 + uTime * 0.3);
                float h3 = sin(pos.x * 0.05 + uTime * 0.5) * cos((pos.z + eps) * 0.05 + uTime * 0.3);
                float h4 = sin(pos.x * 0.05 + uTime * 0.5) * cos((pos.z - eps) * 0.05 + uTime * 0.3);
                
                vec3 tangentX = normalize(vec3(2.0 * eps, (h1 - h2) * uWaveStrength, 0.0));
                vec3 tangentZ = normalize(vec3(0.0, (h3 - h4) * uWaveStrength, 2.0 * eps));
                vNormal = normalize(cross(tangentZ, tangentX));
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                vViewDir = normalize(-mvPosition.xyz);
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uWaterColor;
            uniform vec3 uDeepColor;
            uniform vec3 uSunDirection;
            uniform vec3 uCameraPos;
            uniform float uFogDensity;
            uniform vec3 uFogColor;
            uniform vec3 uSkyColor;
            uniform vec3 uHorizonColor;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vWaveHeight;
            varying vec3 vViewDir;
            
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
            
            void main() {
                vec3 viewDir = normalize(uCameraPos - vPosition);
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(uSunDirection);
                
                float fresnelPower = 5.0;
                float fresnelFactor = pow(1.0 - max(0.0, dot(viewDir, normal)), fresnelPower);
                fresnelFactor = mix(0.02, 1.0, fresnelFactor);
                
                vec3 reflectDir = reflect(-viewDir, normal);
                
                float skyHeight = max(0.0, reflectDir.y);
                vec3 skyReflection = mix(uHorizonColor, uSkyColor, pow(skyHeight, 0.5));
                
                vec3 sunReflectDir = reflect(lightDir, normal);
                float sunSpecular = pow(max(0.0, dot(sunReflectDir, viewDir)), 256.0);
                vec3 sunColor = vec3(1.0, 0.95, 0.8) * sunSpecular * 2.0;
                
                float sunGlow = pow(max(0.0, dot(reflectDir, lightDir)), 8.0);
                vec3 sunGlowColor = vec3(1.0, 0.8, 0.5) * sunGlow * 0.3;
                
                vec3 reflectionColor = skyReflection + sunColor + sunGlowColor;
                
                float depthFactor = smoothstep(-1.0, 1.0, vWaveHeight);
                vec3 waterBodyColor = mix(uDeepColor, uWaterColor, depthFactor);
                
                float foam = 0.0;
                float waveNoise = noise(vUv * 50.0 + uTime * 0.5);
                float normalizedWave = max(0.0, vWaveHeight / max(0.1, 0.5));
                if (normalizedWave > 0.7) {
                    foam = smoothstep(0.5, 0.8, waveNoise) * smoothstep(0.7, 1.0, normalizedWave);
                }
                waterBodyColor = mix(waterBodyColor, vec3(0.9, 0.95, 1.0), foam * 0.5);
                
                float subsurface = max(0.0, dot(-lightDir, normal)) * 0.3;
                waterBodyColor += vec3(0.0, 0.3, 0.2) * subsurface;
                
                vec3 finalColor = mix(waterBodyColor, reflectionColor, fresnelFactor);
                
                float specularHigh = pow(max(0.0, dot(reflect(lightDir, normal), viewDir)), 32.0);
                finalColor += vec3(1.0) * specularHigh * 0.5;
                
                float depth = length(uCameraPos - vPosition);
                float fogFactor = 1.0 - exp(-depth * uFogDensity);
                finalColor = mix(finalColor, uFogColor, fogFactor * 0.4);
                
                float alpha = mix(uOpacity, 1.0, fresnelFactor * 0.5);
                alpha = min(1.0, alpha + foam * 0.3);
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uWaveStrength: { value: this.params.waveStrength },
                uOpacity: { value: this.params.opacity },
                uWaterColor: { value: new THREE.Color(0x2196f3) },
                uDeepColor: { value: new THREE.Color(0x0d47a1) },
                uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
                uCameraPos: { value: new THREE.Vector3() },
                uFogDensity: { value: 0.005 },
                uFogColor: { value: new THREE.Color(0x87ceeb) },
                uSkyColor: { value: new THREE.Color(0x64b5f6) },
                uHorizonColor: { value: new THREE.Color(0x90caf9) }
            },
            transparent: true,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.y = this.params.level;
        this.mesh.receiveShadow = true;
        
        return this.mesh;
    }

    update(time, camera) {
        if (!this.mesh || !this.params.enabled) return;
        
        this.material.uniforms.uTime.value = time;
        this.material.uniforms.uWaveStrength.value = this.params.waveStrength;
        this.material.uniforms.uOpacity.value = this.params.opacity;
        this.material.uniforms.uCameraPos.value.copy(camera.position);
    }

    updateLevel() {
        if (this.mesh) {
            this.mesh.position.y = this.params.level;
        }
    }

    setSunDirection(direction) {
        if (this.material) {
            this.material.uniforms.uSunDirection.value.copy(direction);
        }
    }

    setFog(density, color) {
        if (this.material) {
            this.material.uniforms.uFogDensity.value = density;
            this.material.uniforms.uFogColor.value.set(color);
            this.material.uniforms.uHorizonColor.value.set(color).lerp(new THREE.Color(0xffffff), 0.3);
        }
    }

    setSkyColor(skyColor, horizonColor) {
        if (this.material) {
            this.material.uniforms.uSkyColor.value.set(skyColor);
            if (horizonColor) {
                this.material.uniforms.uHorizonColor.value.set(horizonColor);
            }
        }
    }

    setVisible(visible) {
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }

    getMemoryUsage() {
        let bytes = 0;
        if (this.geometry) {
            bytes += this.geometry.attributes.position.array.byteLength;
            bytes += this.geometry.attributes.normal.array.byteLength;
            bytes += this.geometry.attributes.uv.array.byteLength;
            bytes += this.geometry.index.array.byteLength;
        }
        return bytes;
    }
}

export default WaterSystem;
