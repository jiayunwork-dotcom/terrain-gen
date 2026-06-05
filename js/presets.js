const STORAGE_KEY = 'terrain_generator_custom_presets';

class PresetManager {
    constructor() {
        this.builtinPresets = this.createBuiltinPresets();
        this.customPresets = this.loadCustomPresets();
    }

    createBuiltinPresets() {
        return [
            {
                id: 'plains',
                name: '🏞️ 平原',
                description: '平缓丘陵',
                terrainParams: {
                    noiseType: 'perlin',
                    octaves: 4,
                    frequency: 0.01,
                    amplitude: 25,
                    lacunarity: 2.0,
                    persistence: 0.5,
                    seed: 42
                },
                textureParams: {
                    grassHeight: 15,
                    rockSlope: 0.7,
                    snowHeight: 80,
                    sandHeight: -5,
                    blendRange: 8
                },
                waterParams: {
                    enabled: true,
                    level: 0,
                    waveStrength: 0.3,
                    opacity: 0.8
                },
                vegetationParams: {
                    enabled: true,
                    treeDensity: 0.4,
                    grassDensity: 0.7,
                    maxHeight: 35,
                    maxSlope: 0.5
                },
                atmosphereParams: {
                    time: 12,
                    fogDensity: 0.003,
                    sunIntensity: 1.0
                }
            },
            {
                id: 'mountains',
                name: '⛰️ 山脉',
                description: '尖锐山峰',
                terrainParams: {
                    noiseType: 'ridged',
                    octaves: 8,
                    frequency: 0.025,
                    amplitude: 100,
                    lacunarity: 2.2,
                    persistence: 0.55,
                    seed: 1337
                },
                textureParams: {
                    grassHeight: 25,
                    rockSlope: 0.5,
                    snowHeight: 55,
                    sandHeight: -20,
                    blendRange: 12
                },
                waterParams: {
                    enabled: true,
                    level: -10,
                    waveStrength: 0.4,
                    opacity: 0.85
                },
                vegetationParams: {
                    enabled: true,
                    treeDensity: 0.2,
                    grassDensity: 0.3,
                    maxHeight: 45,
                    maxSlope: 0.4
                },
                atmosphereParams: {
                    time: 14,
                    fogDensity: 0.006,
                    sunIntensity: 1.1
                }
            },
            {
                id: 'dunes',
                name: '🏜️ 沙丘',
                description: '波浪起伏',
                terrainParams: {
                    noiseType: 'simplex',
                    octaves: 3,
                    frequency: 0.015,
                    amplitude: 35,
                    lacunarity: 2.5,
                    persistence: 0.4,
                    seed: 8888
                },
                textureParams: {
                    grassHeight: -100,
                    rockSlope: 0.9,
                    snowHeight: 200,
                    sandHeight: 100,
                    blendRange: 15
                },
                waterParams: {
                    enabled: false,
                    level: -50,
                    waveStrength: 0.2,
                    opacity: 0.8
                },
                vegetationParams: {
                    enabled: true,
                    treeDensity: 0.02,
                    grassDensity: 0.05,
                    maxHeight: 10,
                    maxSlope: 0.6
                },
                atmosphereParams: {
                    time: 15,
                    fogDensity: 0.004,
                    sunIntensity: 1.3
                }
            },
            {
                id: 'canyon',
                name: '🏔️ 峡谷',
                description: '深切谷地',
                terrainParams: {
                    noiseType: 'ridged',
                    octaves: 7,
                    frequency: 0.03,
                    amplitude: 80,
                    lacunarity: 2.0,
                    persistence: 0.6,
                    seed: 2024
                },
                textureParams: {
                    grassHeight: 10,
                    rockSlope: 0.4,
                    snowHeight: 100,
                    sandHeight: -30,
                    blendRange: 8
                },
                waterParams: {
                    enabled: true,
                    level: -25,
                    waveStrength: 0.6,
                    opacity: 0.9
                },
                vegetationParams: {
                    enabled: true,
                    treeDensity: 0.15,
                    grassDensity: 0.25,
                    maxHeight: 30,
                    maxSlope: 0.35
                },
                atmosphereParams: {
                    time: 10,
                    fogDensity: 0.005,
                    sunIntensity: 1.0
                }
            },
            {
                id: 'islands',
                name: '🏝️ 群岛',
                description: '海上小岛',
                terrainParams: {
                    noiseType: 'perlin',
                    octaves: 5,
                    frequency: 0.02,
                    amplitude: 45,
                    lacunarity: 2.0,
                    persistence: 0.5,
                    seed: 7777
                },
                textureParams: {
                    grassHeight: 12,
                    rockSlope: 0.6,
                    snowHeight: 100,
                    sandHeight: 5,
                    blendRange: 6
                },
                waterParams: {
                    enabled: true,
                    level: 15,
                    waveStrength: 0.8,
                    opacity: 0.85
                },
                vegetationParams: {
                    enabled: true,
                    treeDensity: 0.35,
                    grassDensity: 0.6,
                    maxHeight: 30,
                    maxSlope: 0.5
                },
                atmosphereParams: {
                    time: 13,
                    fogDensity: 0.002,
                    sunIntensity: 1.2
                }
            }
        ];
    }

    loadCustomPresets() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load custom presets:', e);
        }
        return [];
    }

    saveCustomPresets() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customPresets));
        } catch (e) {
            console.error('Failed to save custom presets:', e);
        }
    }

    getAllPresets() {
        return {
            builtin: this.builtinPresets,
            custom: this.customPresets
        };
    }

    getPresetById(id) {
        const builtin = this.builtinPresets.find(p => p.id === id);
        if (builtin) return builtin;
        return this.customPresets.find(p => p.id === id);
    }

    createCustomPreset(name, currentState) {
        const id = 'custom_' + Date.now();
        const preset = {
            id,
            name,
            isCustom: true,
            createdAt: Date.now(),
            ...currentState
        };
        this.customPresets.unshift(preset);
        this.saveCustomPresets();
        return preset;
    }

    deleteCustomPreset(id) {
        const index = this.customPresets.findIndex(p => p.id === id);
        if (index !== -1) {
            this.customPresets.splice(index, 1);
            this.saveCustomPresets();
            return true;
        }
        return false;
    }

    renameCustomPreset(id, newName) {
        const preset = this.customPresets.find(p => p.id === id);
        if (preset) {
            preset.name = newName;
            this.saveCustomPresets();
            return true;
        }
        return false;
    }

    extractCurrentState(editor) {
        return {
            terrainParams: { ...editor.terrain.params },
            textureParams: { ...editor.terrain.textureParams },
            waterParams: { ...editor.water.params },
            vegetationParams: { ...editor.vegetation.params },
            atmosphereParams: { ...editor.atmosphere.params }
        };
    }

    applyPreset(preset, editor) {
        if (!preset) return false;

        if (preset.terrainParams) {
            Object.assign(editor.terrain.params, preset.terrainParams);
        }
        if (preset.textureParams) {
            Object.assign(editor.terrain.textureParams, preset.textureParams);
        }
        if (preset.waterParams) {
            Object.assign(editor.water.params, preset.waterParams);
        }
        if (preset.vegetationParams) {
            Object.assign(editor.vegetation.params, preset.vegetationParams);
        }
        if (preset.atmosphereParams) {
            Object.assign(editor.atmosphere.params, preset.atmosphereParams);
        }

        return true;
    }
}

export default PresetManager;
