import * as THREE from 'three';

class AtmosphereSystem {
    constructor() {
        this.sunLight = null;
        this.ambientLight = null;
        this.sky = null;
        
        this.params = {
            time: 12,
            fogDensity: 0.005,
            sunIntensity: 1.0
        };
    }

    createLights() {
        this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
        
        this.sunLight = new THREE.DirectionalLight(0xffffff, this.params.sunIntensity);
        this.sunLight.position.set(100, 150, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -300;
        this.sunLight.shadow.camera.right = 300;
        this.sunLight.shadow.camera.top = 300;
        this.sunLight.shadow.camera.bottom = -300;
        
        return { ambient: this.ambientLight, sun: this.sunLight };
    }

    createSky() {
        const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
        
        const vertexShader = `
            varying vec3 vWorldPosition;
            
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float uTime;
            uniform vec3 uSunDirection;
            
            varying vec3 vWorldPosition;
            
            vec3 getDaySky(float height) {
                vec3 horizonColor = vec3(0.6, 0.8, 1.0);
                vec3 zenithColor = vec3(0.2, 0.4, 0.8);
                return mix(horizonColor, zenithColor, height);
            }
            
            vec3 getSunsetSky(float height) {
                vec3 horizonColor = vec3(1.0, 0.5, 0.2);
                vec3 zenithColor = vec3(0.4, 0.2, 0.5);
                return mix(horizonColor, zenithColor, height);
            }
            
            vec3 getNightSky(float height) {
                vec3 horizonColor = vec3(0.05, 0.05, 0.15);
                vec3 zenithColor = vec3(0.0, 0.0, 0.05);
                return mix(horizonColor, zenithColor, height);
            }
            
            void main() {
                vec3 dir = normalize(vWorldPosition);
                float height = max(0.0, dir.y);
                
                vec3 dayColor = getDaySky(height);
                vec3 sunsetColor = getSunsetSky(height);
                vec3 nightColor = getNightSky(height);
                
                float dayFactor = 0.0;
                float sunsetFactor = 0.0;
                float nightFactor = 0.0;
                
                float time = uTime;
                
                if (time >= 6.0 && time <= 8.0) {
                    sunsetFactor = 1.0 - (time - 6.0) / 2.0;
                    dayFactor = (time - 6.0) / 2.0;
                } else if (time > 8.0 && time < 17.0) {
                    dayFactor = 1.0;
                } else if (time >= 17.0 && time <= 19.0) {
                    dayFactor = 1.0 - (time - 17.0) / 2.0;
                    sunsetFactor = (time - 17.0) / 2.0;
                } else if (time > 19.0 || time < 5.0) {
                    nightFactor = 1.0;
                } else if (time >= 5.0 && time < 6.0) {
                    nightFactor = 1.0 - (time - 5.0) / 1.0;
                    sunsetFactor = (time - 5.0) / 1.0;
                }
                
                vec3 skyColor = dayColor * dayFactor + sunsetColor * sunsetFactor + nightColor * nightFactor;
                
                vec3 sunDir = normalize(uSunDirection);
                float sunDot = max(0.0, dot(dir, sunDir));
                if (dayFactor > 0.0 || sunsetFactor > 0.0) {
                    float sunGlow = pow(sunDot, 32.0) * 0.5;
                    skyColor += vec3(1.0, 0.9, 0.7) * sunGlow * max(dayFactor, sunsetFactor);
                }
                
                if (nightFactor > 0.0) {
                    float stars = 0.0;
                    vec3 starDir = floor(dir * 200.0) / 200.0;
                    float starHash = fract(sin(dot(starDir.xy, vec2(12.9898, 78.233))) * 43758.5453);
                    if (starHash > 0.998 && height > 0.1) {
                        stars = (starHash - 0.998) * 500.0;
                    }
                    skyColor += vec3(stars) * nightFactor;
                }
                
                gl_FragColor = vec4(skyColor, 1.0);
            }
        `;
        
        const skyMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: this.params.time },
                uSunDirection: { value: new THREE.Vector3(0, 1, 0) }
            },
            side: THREE.BackSide
        });
        
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        return this.sky;
    }

    addToScene(scene) {
        const lights = this.createLights();
        scene.add(lights.ambient);
        scene.add(lights.sun);
        
        const sky = this.createSky();
        scene.add(sky);
    }

    updateSunPosition() {
        const time = this.params.time;
        const angle = ((time - 6) / 24) * Math.PI * 2;
        
        const sunX = Math.cos(angle) * 150;
        const sunY = Math.sin(angle) * 150;
        const sunZ = 100;
        
        if (this.sunLight) {
            this.sunLight.position.set(sunX, sunY, sunZ);
        }
        
        if (this.sky) {
            const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
            this.sky.material.uniforms.uSunDirection.value.copy(sunDir);
            this.sky.material.uniforms.uTime.value = this.params.time;
        }
    }

    updateLighting() {
        if (!this.sunLight) return;
        
        const time = this.params.time;
        let intensity = this.params.sunIntensity;
        let color = new THREE.Color(0xffffff);
        
        if (time < 6 || time > 20) {
            intensity *= 0.1;
            color.setHex(0x404080);
        } else if (time >= 6 && time < 8) {
            const t = (time - 6) / 2;
            intensity *= 0.1 + t * 0.9;
            color.lerpColors(new THREE.Color(0xff6600), new THREE.Color(0xffffff), t);
        } else if (time >= 17 && time < 20) {
            const t = (time - 17) / 3;
            intensity *= 1.0 - t * 0.9;
            color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0xff6600), t);
        }
        
        this.sunLight.intensity = intensity;
        this.sunLight.color.copy(color);
        
        if (this.ambientLight) {
            let ambientIntensity = 0.4;
            let ambientColor = new THREE.Color(0x404060);
            
            if (time < 6 || time > 20) {
                ambientIntensity = 0.1;
                ambientColor.setHex(0x101030);
            }
            
            this.ambientLight.intensity = ambientIntensity;
            this.ambientLight.color.copy(ambientColor);
        }
    }

    getSunDirection() {
        const time = this.params.time;
        const angle = ((time - 6) / 24) * Math.PI * 2;
        
        const sunX = Math.cos(angle);
        const sunY = Math.max(0, Math.sin(angle));
        const sunZ = 0.5;
        
        return new THREE.Vector3(sunX, sunY, sunZ).normalize();
    }

    getFogColor() {
        const time = this.params.time;
        let color = new THREE.Color(0x87ceeb);
        
        if (time < 6 || time > 20) {
            color.setHex(0x0a0a20);
        } else if (time >= 6 && time < 8) {
            const t = (time - 6) / 2;
            color.lerpColors(new THREE.Color(0xffa060), new THREE.Color(0x87ceeb), t);
        } else if (time >= 17 && time < 20) {
            const t = (time - 17) / 3;
            color.lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xffa060), t);
        }
        
        return color;
    }

    update() {
        this.updateSunPosition();
        this.updateLighting();
    }

    getFogParams() {
        return {
            density: this.params.fogDensity,
            color: this.getFogColor()
        };
    }
}

export default AtmosphereSystem;
