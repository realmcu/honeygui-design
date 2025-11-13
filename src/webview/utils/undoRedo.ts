/**
 * Undo/Redo Command System
 * Implements command pattern for undo/redo functionality
 */

import { Component } from '../types';

export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
  getName(): string;
}

export class AddComponentCommand implements Command {
  private component: Component;
  private store: any;

  constructor(component: Component, store: any) {
    this.component = component;
    this.store = store;
  }

  execute(): void {
    // 直接修改store的组件列表，而不是再次调用addComponent，避免无限递归
    this.store.setComponents([...this.store.components, this.component]);
  }

  undo(): void {
    this.store.removeComponent(this.component.id);
  }

  redo(): void {
    // 直接修改store的组件列表，而不是再次调用addComponent
    this.store.setComponents([...this.store.components, this.component]);
  }

  getName(): string {
    return `Add ${this.component.type}`;
  }
}

export class DeleteComponentCommand implements Command {
  private component: Component;
  private children: Component[];
  private store: any;

  constructor(component: Component, children: Component[], store: any) {
    this.component = component;
    this.children = children;
    this.store = store;
  }

  execute(): void {
    this.store.removeComponent(this.component.id);
  }

  undo(): void {
    this.store.addComponent(this.component);
    this.children.forEach(child => this.store.addComponent(child));
  }

  redo(): void {
    this.store.removeComponent(this.component.id);
  }

  getName(): string {
    return `Delete ${this.component.type}`;
  }
}

export class MoveComponentCommand implements Command {
  private componentId: string;
  private oldPosition: { x: number; y: number };
  private newPosition: { x: number; y: number };
  private store: any;

  constructor(
    componentId: string,
    oldPosition: { x: number; y: number },
    newPosition: { x: number; y: number },
    store: any
  ) {
    this.componentId = componentId;
    this.oldPosition = oldPosition;
    this.newPosition = newPosition;
    this.store = store;
  }

  execute(): void {
    const component = this.store.getComponentById(this.componentId);
    if (component) {
      this.store.updateComponent(this.componentId, {
        position: { ...component.position, ...this.newPosition }
      });
    }
  }

  undo(): void {
    const component = this.store.getComponentById(this.componentId);
    if (component) {
      this.store.updateComponent(this.componentId, {
        position: { ...component.position, ...this.oldPosition }
      });
    }
  }

  redo(): void {
    this.execute();
  }

  getName(): string {
    return 'Move component';
  }
}

export class UpdatePropertyCommand implements Command {
  private componentId: string;
  private oldProperties: Partial<Component>;
  private newProperties: Partial<Component>;
  private store: any;

  constructor(
    componentId: string,
    oldProperties: Partial<Component>,
    newProperties: Partial<Component>,
    store: any
  ) {
    this.componentId = componentId;
    this.oldProperties = oldProperties;
    this.newProperties = newProperties;
    this.store = store;
  }

  execute(): void {
    this.store.updateComponent(this.componentId, this.newProperties);
  }

  undo(): void {
    this.store.updateComponent(this.componentId, this.oldProperties);
  }

  redo(): void {
    this.execute();
  }

  getName(): string {
    return 'Update properties';
  }
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number = 50;

  constructor(maxStackSize?: number) {
    if (maxStackSize) {
      this.maxStackSize = maxStackSize;
    }
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // Clear redo stack when new command is executed
    this.redoStack = [];

    // Limit undo stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    if (this.canUndo()) {
      const command = this.undoStack.pop()!;
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo(): void {
    if (this.canRedo()) {
      const command = this.redoStack.pop()!;
      command.redo();
      this.undoStack.push(command);
    }
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoLabel(): string | null {
    if (this.canUndo()) {
      const command = this.undoStack[this.undoStack.length - 1];
      return command.getName();
    }
    return null;
  }

  getRedoLabel(): string | null {
    if (this.canRedo()) {
      const command = this.redoStack[this.redoStack.length - 1];
      return command.getName();
    }
    return null;
  }
}
