import * as vscode from 'vscode';
import { HmlController } from '../hml/HmlController';

/**
 * DesignerService provides shared services for the designer.
 * It acts as a singleton to manage shared state like HmlController.
 */
export class DesignerService {
    private static _instance: DesignerService;
    private readonly _hmlController: HmlController;

    private constructor() {
        this._hmlController = new HmlController();
    }

    public static getInstance(): DesignerService {
        if (!DesignerService._instance) {
            DesignerService._instance = new DesignerService();
        }
        return DesignerService._instance;
    }

    public get hmlController(): HmlController {
        return this._hmlController;
    }
}
