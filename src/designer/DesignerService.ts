import { HmlController } from '../hml/HmlController';

/**
 * DesignerService provides shared services for the designer.
 * 
 * Note: Each DesignerPanel should have its own HmlController instance
 * to support multiple files being edited simultaneously.
 * This service now acts as a factory for creating HmlController instances.
 */
export class DesignerService {
    private static _instance: DesignerService;

    private constructor() {}

    public static getInstance(): DesignerService {
        if (!DesignerService._instance) {
            DesignerService._instance = new DesignerService();
        }
        return DesignerService._instance;
    }

    /**
     * Creates a new HmlController instance for each editor.
     * Each editor should have its own controller to avoid conflicts.
     */
    public createHmlController(): HmlController {
        return new HmlController();
    }

    /**
     * @deprecated Use createHmlController() instead.
     * Kept for backward compatibility during transition.
     */
    public get hmlController(): HmlController {
        // Return a new instance to avoid shared state issues
        return new HmlController();
    }
}
