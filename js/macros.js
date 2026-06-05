class MacroManager {
    constructor() {
        this.isRecording = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.recordingStartTime = 0;
        this.currentMacro = null;
        this.playbackSpeed = 1;
        this.playbackIndex = 0;
        this.playbackStartTime = 0;
        this.pausedTime = 0;
        this.playbackTimer = null;
        
        this.transform = {
            offsetX: 0,
            offsetZ: 0,
            rotation: 0
        };
        
        this.isBatchPlaying = false;
        this.isBatchPaused = false;
        this.batchItems = [];
        this.batchCurrentIndex = 0;
        this.batchCancelRequested = false;
        
        this.batchTemplates = [];
        
        this.savedMacros = [];
        this._listeners = {};
        this._loadFromLocalStorage();
        this._loadBatchTemplatesFromLocalStorage();
    }

    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    off(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        }
    }

    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    }

    startRecording() {
        if (this.isRecording || this.isPlaying) return;
        
        this.isRecording = true;
        this.recordingStartTime = performance.now();
        this.currentMacro = {
            id: 'macro_' + Date.now(),
            name: '未命名宏',
            createdAt: Date.now(),
            operations: []
        };
        this._emit('recordingStarted');
    }

    recordOperation(brushType, x, z, size, strength, flattenHeight = 0) {
        if (!this.isRecording || !this.currentMacro) return;
        
        const timestamp = performance.now() - this.recordingStartTime;
        this.currentMacro.operations.push({
            timestamp,
            brushType,
            x,
            z,
            size,
            strength,
            flattenHeight
        });
    }

    stopRecording() {
        if (!this.isRecording) return null;
        
        this.isRecording = false;
        const macro = this.currentMacro;
        this.currentMacro = null;
        this._emit('recordingStopped', macro);
        return macro;
    }

    _applyTransform(x, z) {
        const rad = (this.transform.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const cx = x - 0.5;
        const cz = z - 0.5;
        
        const rotatedX = cx * cos - cz * sin + 0.5;
        const rotatedZ = cx * sin + cz * cos + 0.5;
        
        return {
            x: Math.max(0, Math.min(1, rotatedX + this.transform.offsetX)),
            z: Math.max(0, Math.min(1, rotatedZ + this.transform.offsetZ))
        };
    }

    playMacro(macro, onApplyBrush) {
        if (this.isPlaying || this.isRecording) return;
        
        this.isPlaying = true;
        this.isPaused = false;
        this.playbackIndex = 0;
        this.playbackStartTime = performance.now();
        this.pausedTime = 0;
        
        const totalDuration = macro.operations.length > 0 
            ? macro.operations[macro.operations.length - 1].timestamp 
            : 0;
        
        this._emit('playbackStarted', { macro, totalDuration });
        
        const playNext = () => {
            if (!this.isPlaying) return;
            
            if (this.isPaused) {
                this.playbackTimer = setTimeout(playNext, 50);
                return;
            }
            
            const currentTime = (performance.now() - this.playbackStartTime - this.pausedTime) * this.playbackSpeed;
            
            while (this.playbackIndex < macro.operations.length) {
                const op = macro.operations[this.playbackIndex];
                if (op.timestamp <= currentTime) {
                    const transformed = this._applyTransform(op.x, op.z);
                    onApplyBrush(
                        op.brushType,
                        transformed.x,
                        transformed.z,
                        op.size,
                        op.strength,
                        op.flattenHeight
                    );
                    this.playbackIndex++;
                    this._emit('playbackProgress', {
                        index: this.playbackIndex,
                        total: macro.operations.length,
                        currentTime,
                        totalDuration,
                        x: transformed.x,
                        z: transformed.z
                    });
                } else {
                    break;
                }
            }
            
            if (this.playbackIndex >= macro.operations.length) {
                this.isPlaying = false;
                this._emit('playbackFinished');
                return;
            }
            
            this.playbackTimer = setTimeout(playNext, 16);
        };
        
        playNext();
    }

    pausePlayback() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.isPaused = true;
        this.pauseStartTime = performance.now();
        this._emit('playbackPaused');
    }

    resumePlayback() {
        if (!this.isPlaying || !this.isPaused) return;
        
        this.isPaused = false;
        this.pausedTime += performance.now() - this.pauseStartTime;
        this._emit('playbackResumed');
    }

    stopPlayback() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        this._emit('playbackStopped');
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        this._emit('speedChanged', speed);
    }

    setTransform(offsetX, offsetZ, rotation) {
        this.transform.offsetX = offsetX;
        this.transform.offsetZ = offsetZ;
        this.transform.rotation = rotation;
    }

    saveMacro(macro, name) {
        const savedMacro = {
            ...macro,
            name: name || macro.name,
            savedAt: Date.now()
        };
        this.savedMacros.push(savedMacro);
        this._saveToLocalStorage();
        this._emit('macroSaved', savedMacro);
        return savedMacro;
    }

    deleteMacro(macroId) {
        this.savedMacros = this.savedMacros.filter(m => m.id !== macroId);
        this._saveToLocalStorage();
        this._emit('macroDeleted', macroId);
    }

    renameMacro(macroId, newName) {
        const macro = this.savedMacros.find(m => m.id === macroId);
        if (macro) {
            macro.name = newName;
            this._saveToLocalStorage();
            this._emit('macroRenamed', { id: macroId, name: newName });
        }
    }

    getMacros() {
        return this.savedMacros;
    }

    getMacro(macroId) {
        return this.savedMacros.find(m => m.id === macroId);
    }

    _saveToLocalStorage() {
        try {
            localStorage.setItem('terrain_macros', JSON.stringify(this.savedMacros));
        } catch (e) {
            console.error('保存宏失败:', e);
        }
    }

    _loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('terrain_macros');
            if (data) {
                this.savedMacros = JSON.parse(data);
            }
        } catch (e) {
            console.error('加载宏失败:', e);
            this.savedMacros = [];
        }
    }

    playBatch(batchItems, onApplyBrush) {
        if (this.isPlaying || this.isRecording || batchItems.length === 0) return;
        
        this.batchItems = batchItems;
        this.batchCurrentIndex = 0;
        this.isBatchPlaying = true;
        this.isBatchPaused = false;
        this.batchCancelRequested = false;
        
        this._emit('batchStarted', { total: batchItems.length });
        this._playNextBatchItem(onApplyBrush);
    }

    _playNextBatchItem(onApplyBrush) {
        if (this.batchCancelRequested || this.batchCurrentIndex >= this.batchItems.length) {
            this.isBatchPlaying = false;
            this.isBatchPaused = false;
            this._emit('batchFinished', { cancelled: this.batchCancelRequested });
            return;
        }
        
        if (this.isBatchPaused) {
            setTimeout(() => this._playNextBatchItem(onApplyBrush), 50);
            return;
        }
        
        const item = this.batchItems[this.batchCurrentIndex];
        const macro = this.getMacro(item.macroId);
        
        if (!macro) {
            this.batchCurrentIndex++;
            this._playNextBatchItem(onApplyBrush);
            return;
        }
        
        this.transform.offsetX = item.offsetX || 0;
        this.transform.offsetZ = item.offsetZ || 0;
        this.transform.rotation = item.rotation || 0;
        
        this._emit('batchItemStarted', {
            index: this.batchCurrentIndex,
            total: this.batchItems.length,
            macro: macro
        });
        
        this.playMacro(macro, onApplyBrush);
        
        const onSingleFinished = () => {
            this.off('playbackFinished', onSingleFinished);
            this.off('playbackStopped', onSingleFinished);
            this.batchCurrentIndex++;
            this._emit('batchItemFinished', {
                index: this.batchCurrentIndex - 1,
                total: this.batchItems.length
            });
            setTimeout(() => this._playNextBatchItem(onApplyBrush), 0);
        };
        
        this.on('playbackFinished', onSingleFinished);
        this.on('playbackStopped', onSingleFinished);
    }

    pauseBatch() {
        if (!this.isBatchPlaying || this.isBatchPaused) return;
        this.isBatchPaused = true;
        this.pausePlayback();
        this._emit('batchPaused');
    }

    resumeBatch() {
        if (!this.isBatchPlaying || !this.isBatchPaused) return;
        this.isBatchPaused = false;
        this.resumePlayback();
        this._emit('batchResumed');
    }

    cancelBatch() {
        if (!this.isBatchPlaying) return;
        this.batchCancelRequested = true;
        this.stopPlayback();
        this._emit('batchCancelled');
    }

    saveBatchTemplate(name, items) {
        const template = {
            id: 'batch_template_' + Date.now(),
            name: name,
            items: items.map(item => ({
                macroId: item.macroId,
                offsetX: item.offsetX || 0,
                offsetZ: item.offsetZ || 0,
                rotation: item.rotation || 0
            })),
            createdAt: Date.now()
        };
        this.batchTemplates.push(template);
        this._saveBatchTemplatesToLocalStorage();
        this._emit('batchTemplateSaved', template);
        return template;
    }

    deleteBatchTemplate(templateId) {
        this.batchTemplates = this.batchTemplates.filter(t => t.id !== templateId);
        this._saveBatchTemplatesToLocalStorage();
        this._emit('batchTemplateDeleted', templateId);
    }

    renameBatchTemplate(templateId, newName) {
        const template = this.batchTemplates.find(t => t.id === templateId);
        if (template) {
            template.name = newName;
            this._saveBatchTemplatesToLocalStorage();
            this._emit('batchTemplateRenamed', { id: templateId, name: newName });
        }
    }

    getBatchTemplates() {
        return this.batchTemplates;
    }

    getBatchTemplate(templateId) {
        return this.batchTemplates.find(t => t.id === templateId);
    }

    _saveBatchTemplatesToLocalStorage() {
        try {
            localStorage.setItem('terrain_batch_templates', JSON.stringify(this.batchTemplates));
        } catch (e) {
            console.error('保存批量模板失败:', e);
        }
    }

    _loadBatchTemplatesFromLocalStorage() {
        try {
            const data = localStorage.getItem('terrain_batch_templates');
            if (data) {
                this.batchTemplates = JSON.parse(data);
            }
        } catch (e) {
            console.error('加载批量模板失败:', e);
            this.batchTemplates = [];
        }
    }
}

export default MacroManager;
