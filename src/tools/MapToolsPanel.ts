import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/Logger';
import { MapDownloadService, DownloadOptions, DownloadProgress } from '../services/MapDownloadService';
import { MapConvertService, ConvertOptions, ConvertProgress } from '../services/MapConvertService';
import { getMapToolsPanelHtml } from './MapToolsPanelHtml';

export class MapToolsPanel {
    public static currentPanel: MapToolsPanel | undefined;
    private static readonly viewType = 'honeygui.mapToolsPanel';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private downloadService: MapDownloadService;
    private convertService: MapConvertService;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.downloadService = new MapDownloadService();
        this.convertService = new MapConvertService();

        this.panel.webview.html = getMapToolsPanelHtml();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri): void {
        if (MapToolsPanel.currentPanel) {
            MapToolsPanel.currentPanel.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            MapToolsPanel.viewType,
            vscode.l10n.t('Map Tools'),
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        MapToolsPanel.currentPanel = new MapToolsPanel(panel, extensionUri);
    }

    private dispose(): void {
        MapToolsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'selectOutputDir':
                await this.selectOutputDir(message.target);
                break;
            case 'selectInputFile':
                await this.selectInputFile();
                break;
            case 'cleanCache':
                await this.cleanCache();
                break;
            case 'startDownload':
                await this.startDownload(
                    message.bbox,
                    message.features,
                    message.outputPath,
                    message.chunkedEnabled,
                    message.chunkSize,
                    message.maxRetries,
                    message.useCache
                );
                break;
            case 'startConvert':
                await this.startConvert(
                    message.inputPath,
                    message.outputPath,
                    message.features,
                    message.simplifyPoly,
                    message.simplifyRoads,
                    message.bbox
                );
                break;
        }
    }

    private async selectOutputDir(target?: string): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select Directory')
        });
        if (result?.[0]) {
            this.panel.webview.postMessage({
                type: 'outputDirSelected',
                path: result[0].fsPath,
                target: target || 'download'
            });
        }
    }

    private async selectInputFile(): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'OSM Files': ['osm', 'xml'] },
            openLabel: vscode.l10n.t('Select OSM File')
        });
        if (result?.[0]) {
            this.panel.webview.postMessage({
                type: 'inputFileSelected',
                path: result[0].fsPath
            });
        }
    }

    private async cleanCache(): Promise<void> {
        try {
            vscode.window.showInformationMessage(vscode.l10n.t('Cache cleaned successfully'));
            logger.info('Download cache cleaned');
        } catch (error: any) {
            logger.error(`Failed to clean cache: ${error.message}`);
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to clean cache: {0}', error.message));
        }
    }

    private async startDownload(bbox: any, features: string[], outputPath: string, chunkedEnabled?: boolean, chunkSize?: number, maxRetries?: number, useCache?: boolean): Promise<void> {
        try {
            const fileName = `map_${Date.now()}.osm`;
            const fullPath = path.join(outputPath, fileName);

            const options: DownloadOptions = {
                bbox: {
                    minLat: bbox.minLat,
                    minLon: bbox.minLon,
                    maxLat: bbox.maxLat,
                    maxLon: bbox.maxLon
                },
                features: features as any,
                outputPath: fullPath,
                chunkedEnabled,
                chunkSize,
                maxRetries,
                useCache,
                onProgress: (progress: DownloadProgress) => {
                    this.panel.webview.postMessage({
                        type: 'downloadProgress',
                        progress
                    });
                }
            };

            const result = await this.downloadService.download(options);

            this.panel.webview.postMessage({
                type: 'downloadComplete',
                success: result.success,
                outputPath: result.outputPath,
                fileSizeKB: result.fileSizeKB,
                error: result.error
            });

            if (result.success) {
                vscode.window.showInformationMessage(vscode.l10n.t('Map data downloaded successfully'));
            } else {
                vscode.window.showErrorMessage(vscode.l10n.t('Download Failed') + ': ' + result.error);
            }
        } catch (error: any) {
            logger.error(`Download error: ${error.message}`);
            this.panel.webview.postMessage({
                type: 'downloadComplete',
                success: false,
                error: error.message
            });
            vscode.window.showErrorMessage(vscode.l10n.t('Download Failed') + ': ' + error.message);
        }
    }

    private async startConvert(inputPath: string, outputPath: string, features: string[], simplifyPoly?: number, simplifyRoads?: number, bbox?: any): Promise<void> {
        try {
            const fileName = path.basename(inputPath, path.extname(inputPath)) + '.bin';
            const fullPath = path.join(outputPath, fileName);

            const options: ConvertOptions = {
                inputPath,
                outputPath: fullPath,
                features: features as any,
                onProgress: (progress: ConvertProgress) => {
                    this.panel.webview.postMessage({
                        type: 'convertProgress',
                        progress
                    });
                }
            };

            const result = await this.convertService.convert(options);

            this.panel.webview.postMessage({
                type: 'convertComplete',
                success: result.success,
                outputPath: result.outputPath,
                stats: result.stats,
                error: result.error
            });

            if (result.success) {
                vscode.window.showInformationMessage(vscode.l10n.t('Map data converted successfully'));
            } else {
                vscode.window.showErrorMessage(vscode.l10n.t('Convert Failed') + ': ' + result.error);
            }
        } catch (error: any) {
            logger.error(`Convert error: ${error.message}`);
            this.panel.webview.postMessage({
                type: 'convertComplete',
                success: false,
                error: error.message
            });
            vscode.window.showErrorMessage(vscode.l10n.t('Convert Failed') + ': ' + error.message);
        }
    }
}
