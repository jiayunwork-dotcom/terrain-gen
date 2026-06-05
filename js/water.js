import * as THREE from 'three';

class WaterSystem {
    constructor(size = 512) {
        this.size = size;
        this.mesh = null;
        this.material = null;
        this.geometry = null;
        
        this.params = {
            enabled: true,
            level: 5,
            waveStrength: 0.5,
            opacity: 0.8
        };
    }

    createMesh() {
        this.geometry = new THREE.PlaneGeometry(this.size, this.size, 128, 128);
        this.geometry.rotateX(-Math.PI / 2);
        
        const vertexShader = `
            uniform float uTime;
            uniform float uWaveStrength;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vWaveHeight;
            
            void main() {
                vPosition = position;
                vUv = uv;
                
                vec3 pos = position;
                float wave1 = sin(pos.x * 0.05 + uTime * 0.5) * cos(pos.z * 0.05 + uTime * 0.3);
                float wave2 = sin(pos.x * 0.08 + uTime * 0.7 + 1.0) * cos(pos.z * 0.06 + uTime * 0.4 + 2.0);
                float wave3 = sin(pos.x * 0.12 + uTime * 0.9 + 3.0) * cos(pos.z * 0.1 + uTime * 0.6 + 1.5);
                float waveHeight = (wave1 + wave2 * 0.5 + wave3 * 0.25) * uWaveStrength;
                
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
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vWaveHeight;
            
            void main() {
                vec3 viewDir = normalize(uCameraPos - vPosition);
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(uSunDirection);
                
                float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);
                
                vec3 reflectDir = reflect(-viewDir, normal);
                float skyGrad = reflectDir.y * 0.5 + 0.5;
                vec3 skyColor = mix(vec3(0.4, 0.6, 0.8), vec3(0.7, 0.85, 0.95), skyGrad);
                
                vec3 waterColor = mix(uDeepColor, uWaterColor, 0.5 + vWaveHeight * 0.5);
                
                float specular = pow(max(0.0, dot(reflect(lightDir, normal), viewDir)), 64.0);
                vec3 specularColor = vec3(1.0) * specular * 0.8;
                
                vec3 finalColor = mix(waterColor, skyColor, fresnel * 0.6);
                finalColor += specularColor;
                
                float depth = length(uCameraPos - vPosition);
                float fogFactor = 1.0 - exp(-depth * uFogDensity);
                finalColor = mix(finalColor, uFogColor, fogFactor * 0.5);
                
                gl_FragColor = vec4(finalColor, uOpacity);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uWaveStrength: { value: this.params.waveStrength },
                uOpacity: { value: this.params.opacity },
                uWaterColor: { value: new THREE.Color(0x3a86ff) },
                uDeepColor: { value: new THREE.Color(0x1a365d) },
                uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
                uCameraPos: { value: new THREE.Vector3() },
                uFogDensity: { value: 0.005 },
                uFogColor: { value: new THREE.Color(0x87ceeb) }
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
        }
    }

    setVisible(visible) {
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }
}

export default WaterSystem;
