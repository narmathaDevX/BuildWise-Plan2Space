/**
 * 50-step Undo / Redo History Manager for Interior Design Studio.
 * Handles paint actions, furniture placement, movement, rotation, resizing, and deletion.
 */

export class HistoryManager {
  constructor(maxSteps = 50, onStateChange = null) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.onStateChange = onStateChange;

    this.bindKeyboardShortcuts();
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if ((modKey && e.shiftKey && e.key.toLowerCase() === 'z') || (modKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  pushAction(action) {
    if (!action || typeof action.undo !== 'function' || typeof action.redo !== 'function') {
      console.warn('Invalid action passed to history manager');
      return;
    }

    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];

    this.notify();
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();
    try {
      action.undo();
      this.redoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to execute undo action:', err);
      return false;
    }
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();
    try {
      action.redo();
      this.undoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to execute redo action:', err);
      return false;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length,
      });
    }
  }
}
