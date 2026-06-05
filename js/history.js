class HistoryManager {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
    }

    pushState(state) {
        this.undoStack.push(state);
        this.redoStack = [];
        
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) return null;
        
        const state = this.undoStack.pop();
        this.redoStack.push(state);
        
        return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
    }

    redo() {
        if (this.redoStack.length === 0) return null;
        
        const state = this.redoStack.pop();
        this.undoStack.push(state);
        
        return state;
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export default HistoryManager;
