class TerrainLayer {
    constructor(name, resolution) {
        this.id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.visible = true;
        this.locked = false;
        this.opacity = 1.0;
        this.blendMode = 'add';
        this.resolution = resolution;
        this.heightMap = new Float32Array(resolution * resolution);
    }

    clone() {
        const layer = new TerrainLayer(this.name + ' 副本', this.resolution);
        layer.heightMap = new Float32Array(this.heightMap);
        layer.opacity = this.opacity;
        layer.blendMode = this.blendMode;
        return layer;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            visible: this.visible,
            locked: this.locked,
            opacity: this.opacity,
            blendMode: this.blendMode,
            resolution: this.resolution,
            heightMap: Array.from(this.heightMap)
        };
    }

    static fromJSON(data) {
        const layer = new TerrainLayer(data.name, data.resolution);
        layer.id = data.id;
        layer.visible = data.visible;
        layer.locked = data.locked;
        layer.opacity = data.opacity;
        layer.blendMode = data.blendMode;
        layer.heightMap = new Float32Array(data.heightMap);
        return layer;
    }

    generateThumbnail(size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);

        const globalMin = -100;
        const globalMax = 150;
        const globalRange = globalMax - globalMin;

        const step = this.resolution / size;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const srcX = Math.floor(x * step);
                const srcY = Math.floor(y * step);
                const idx = Math.min(srcY * this.resolution + srcX, this.heightMap.length - 1);
                const height = this.heightMap[idx];
                const normalized = Math.max(0, Math.min(1, (height - globalMin) / globalRange));
                const gray = Math.floor(normalized * 255);
                const pixelIdx = (y * size + x) * 4;
                imageData.data[pixelIdx] = gray;
                imageData.data[pixelIdx + 1] = gray;
                imageData.data[pixelIdx + 2] = gray;
                imageData.data[pixelIdx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }
}

class LayerManager {
    constructor(resolution) {
        this.resolution = resolution;
        this.layers = [];
        this.activeLayerId = null;
        this.combinedHeightMap = new Float32Array(resolution * resolution);
        this._listeners = [];
    }

    addChangeListener(callback) {
        this._listeners.push(callback);
    }

    removeChangeListener(callback) {
        this._listeners = this._listeners.filter(cb => cb !== callback);
    }

    _notifyChanged() {
        this._listeners.forEach(cb => cb());
    }

    createLayer(name, fromHeightMap = null) {
        const layer = new TerrainLayer(name, this.resolution);
        if (fromHeightMap) {
            layer.heightMap = new Float32Array(fromHeightMap);
        }
        this.layers.push(layer);
        if (!this.activeLayerId) {
            this.activeLayerId = layer.id;
        }
        this._notifyChanged();
        return layer;
    }

    deleteLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1 || this.layers.length <= 1) return;
        
        this.layers.splice(index, 1);
        
        if (this.activeLayerId === layerId) {
            this.activeLayerId = this.layers[Math.max(0, index - 1)]?.id || null;
        }
        this._notifyChanged();
    }

    getLayer(layerId) {
        return this.layers.find(l => l.id === layerId);
    }

    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId);
    }

    setActiveLayer(layerId) {
        if (this.layers.find(l => l.id === layerId)) {
            this.activeLayerId = layerId;
            this._notifyChanged();
        }
    }

    moveLayer(layerId, direction) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return;
        
        const newIndex = direction === 'up' ? index + 1 : index - 1;
        if (newIndex < 0 || newIndex >= this.layers.length) return;
        
        [this.layers[index], this.layers[newIndex]] = [this.layers[newIndex], this.layers[index]];
        this._notifyChanged();
    }

    mergeDown(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index <= 0) return;
        
        const layer = this.layers[index];
        const targetLayer = this.layers[index - 1];
        
        if (!layer || !targetLayer) return;
        
        const tempCombined = new Float32Array(this.resolution * this.resolution);
        this._blendLayer(targetLayer, tempCombined, tempCombined);
        this._blendLayer(layer, tempCombined, tempCombined);
        
        targetLayer.heightMap = tempCombined;
        this.layers.splice(index, 1);
        
        if (this.activeLayerId === layerId) {
            this.activeLayerId = targetLayer.id;
        }
        this._notifyChanged();
    }

    duplicateLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer) return;
        
        const newLayer = layer.clone();
        const index = this.layers.findIndex(l => l.id === layerId);
        this.layers.splice(index + 1, 0, newLayer);
        this._notifyChanged();
        return newLayer;
    }

    _blendLayer(layer, baseMap, resultMap) {
        if (!layer.visible) {
            if (resultMap !== baseMap) {
                resultMap.set(baseMap);
            }
            return;
        }

        const opacity = layer.opacity;
        
        for (let i = 0; i < this.resolution * this.resolution; i++) {
            const baseHeight = baseMap[i];
            const layerHeight = layer.heightMap[i];
            
            let result;
            switch (layer.blendMode) {
                case 'add':
                    result = baseHeight + layerHeight * opacity;
                    break;
                case 'max':
                    result = baseHeight * (1 - opacity) + Math.max(baseHeight, layerHeight) * opacity;
                    break;
                case 'min':
                    result = baseHeight * (1 - opacity) + Math.min(baseHeight, layerHeight) * opacity;
                    break;
                case 'multiply':
                    const multiplyFactor = 1 + (layerHeight / 50);
                    result = baseHeight * (1 - opacity) + (baseHeight * multiplyFactor) * opacity;
                    break;
                case 'difference':
                    const diff = Math.abs(baseHeight - layerHeight);
                    result = baseHeight * (1 - opacity) + diff * opacity;
                    break;
                default:
                    result = baseHeight + layerHeight * opacity;
            }
            
            resultMap[i] = result;
        }
    }

    combineLayers() {
        this.combinedHeightMap.fill(0);
        const tempMap = new Float32Array(this.resolution * this.resolution);
        
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (i === 0) {
                if (layer.visible) {
                    for (let j = 0; j < this.combinedHeightMap.length; j++) {
                        this.combinedHeightMap[j] = layer.heightMap[j] * layer.opacity;
                    }
                }
            } else {
                tempMap.set(this.combinedHeightMap);
                this._blendLayer(layer, tempMap, this.combinedHeightMap);
            }
        }
        
        return this.combinedHeightMap;
    }

    toJSON() {
        return {
            resolution: this.resolution,
            activeLayerId: this.activeLayerId,
            layers: this.layers.map(l => l.toJSON())
        };
    }

    static fromJSON(data) {
        const manager = new LayerManager(data.resolution);
        manager.activeLayerId = data.activeLayerId;
        manager.layers = data.layers.map(l => TerrainLayer.fromJSON(l));
        return manager;
    }

    saveToLocalStorage(key = 'terrain_layers') {
        try {
            localStorage.setItem(key, JSON.stringify(this.toJSON()));
        } catch (e) {
            console.error('保存图层失败:', e);
        }
    }

    loadFromLocalStorage(key = 'terrain_layers') {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                const manager = LayerManager.fromJSON(parsed);
                this.resolution = manager.resolution;
                this.layers = manager.layers;
                this.activeLayerId = manager.activeLayerId;
                this.combinedHeightMap = manager.combinedHeightMap;
                this._notifyChanged();
                return true;
            }
        } catch (e) {
            console.error('加载图层失败:', e);
        }
        return false;
    }
}

export { TerrainLayer, LayerManager };
