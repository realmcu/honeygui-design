import * as path from 'path';

/**
 * HML模板管理类 - 集中管理所有HML模板生成逻辑
 * 用于统一生成项目中的各种HML模板，避免代码重复
 */
export class HmlTemplateManager {
    /**
     * 生成标准项目HML文件内容（用于普通HML文件，不包含screen容器）
     * @param projectName 项目名称
     * @param resolution 分辨率 (格式: "WIDTHXHEIGHT")
     * @param appId 应用ID
     * @param minSdk 最小SDK版本
     * @param pixelMode 像素模式
     * @returns 格式化的HML文件内容
     */
    static generateProjectHml(
        projectName: string,
        resolution: string,
        appId?: string,
        minSdk?: string,
        pixelMode?: string
    ): string {
        // 解析分辨率
        const [width, height] = resolution.split('X').map(Number);

        // 生成注释头
        let headerComments = `<!-- ${projectName} UI definition -->`;
        if (appId) headerComments += `\n<!-- APP ID: ${appId} -->`;
        headerComments += `\n<!-- Resolution: ${resolution} -->`;
        if (minSdk) headerComments += `\n<!-- Min SDK: ${minSdk} -->`;
        if (pixelMode) headerComments += `\n<!-- Pixel Mode: ${pixelMode} -->`;

        // 生成HML内容（不包含screen容器）
        return `${headerComments}
<hml id="${projectName}" width="${width}" height="${height}">
  <container id="root" layout="column" padding="16">
    <text id="title" value="${projectName}" fontSize="24" marginTop="16" align="center"></text>
    <button id="welcomeButton" text="Click Me" marginTop="32" align="center" onclickhandler="OnWelcomeButtonClick"></button>
  </container>
</hml>`;
    }

    /**
     * 生成主HML文件内容（main.hml，包含screen容器）
     * @param projectName 项目名称
     * @param resolution 分辨率 (格式: "WIDTHXHEIGHT")
     * @param appId 应用ID
     * @param minSdk 最小SDK版本
     * @param pixelMode 像素模式
     * @returns 格式化的HML文件内容
     */
    static generateMainHml(
        projectName: string,
        resolution: string,
        appId?: string,
        minSdk?: string,
        pixelMode?: string
    ): string {
        // 解析分辨率
        const [width, height] = resolution.split('X').map(Number);

        // 生成注释头
        let headerComments = `<!-- ${projectName} Main UI - main.hml -->`;
        if (appId) headerComments += `\n<!-- APP ID: ${appId} -->`;
        headerComments += `\n<!-- Resolution: ${resolution} -->`;
        if (minSdk) headerComments += `\n<!-- Min SDK: ${minSdk} -->`;
        if (pixelMode) headerComments += `\n<!-- Pixel Mode: ${pixelMode} -->`;

        // 生成包含screen容器的HML内容
        return `${headerComments}
<hml id="${projectName}" width="${width}" height="${height}">
  <screen id="mainScreen" width="${width}" height="${height}">
    <container id="root" layout="column" padding="16">
      <text id="title" value="${projectName}" fontSize="24" marginTop="16" align="center"></text>
      <button id="welcomeButton" text="Click Me" marginTop="32" align="center" onclickhandler="OnWelcomeButtonClick"></button>
    </container>
  </screen>
</hml>`;
    }
    
    /**
     * 生成项目主C++文件内容
     * @param projectName 项目名称
     * @param appId 应用ID
     * @returns 格式化的C++文件内容
     */
    static generateMainCpp(projectName: string, appId?: string): string {
        let headerComments = `// ${projectName} Main Program`;
        if (appId) headerComments += `\n// APP ID: ${appId}`;
        
        return `${headerComments}

#include <iostream>

// <honeygui-protect-begin:handler>
void OnWelcomeButtonClick() {
    std::cout << "Welcome to ${projectName}!" << std::endl;
}
// <honeygui-protect-end:handler>

int main() {
    std::cout << "${projectName} starting..." << std::endl;
    return 0;
}`;
    }
    
    /**
     * 生成项目README文件内容
     * @param projectName 项目名称
     * @param appId 应用ID
     * @param resolution 分辨率
     * @returns 格式化的README文件内容
     */
    static generateReadme(
        projectName: string,
        appId?: string,
        resolution?: string
    ): string {
        let readme = `# ${projectName}\n\nA HoneyGUI project created with the following configuration:\n\n`;
        
        if (appId) readme += `- **APP ID**: ${appId}\n`;
        if (resolution) readme += `- **Resolution**: ${resolution}\n`;
        
        readme += `\n## Getting Started\n\nOpen this project in HoneyGUI Visual Designer to start editing your UI.\n\n## Project Structure\n\n- **ui/**: Contains HML UI definition files\n- **src/**: Contains C++ source code\n- **assets/**: Contains project assets (images, fonts, etc.)\n`;
        
        return readme;
    }
    
    /**
     * 生成项目配置JSON内容
     * @param projectName 项目名称
     * @param appId 应用ID
     * @param resolution 分辨率
     * @param minSdk 最小SDK版本
     * @returns 格式化的项目配置JSON内容
     */
    static generateProjectConfig(
        projectName: string,
        appId: string,
        resolution: string,
        minSdk?: string
    ): string {
        const config = {
            name: projectName,
            appId,
            resolution,
            minSdk: minSdk || '1.0.0',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        return JSON.stringify(config, null, 2);
    }
    
    /**
     * 获取HML文件的标准文件名
     * @param projectName 项目名称
     * @returns HML文件名
     */
    static getHmlFileName(projectName: string): string {
        return `${projectName}.hml`;
    }
    
    /**
     * 获取项目文件的标准路径
     * @param projectRootPath 项目根目录路径
     * @param projectName 项目名称
     * @returns 项目文件路径对象
     */
    static getProjectFilePaths(projectRootPath: string, projectName: string): {
        hml: string;
        cpp: string;
        config: string;
        readme: string;
    } {
        return {
            hml: path.join(projectRootPath, 'ui', `${projectName}.hml`),
            cpp: path.join(projectRootPath, 'src', 'main.cpp'),
            config: path.join(projectRootPath, 'project.json'),
            readme: path.join(projectRootPath, 'README.md')
        };
    }

    /**
     * 生成空白的HML文件内容（用于右键菜单新建文件，不包含任何组件）
     * @param fileName 文件名（不包含扩展名）
     * @param resolution 分辨率 (格式: "WIDTHXHEIGHT")
     * @returns 格式化的HML文件内容
     */
    static generateEmptyHml(fileName: string, resolution: string): string {
        // 解析分辨率
        const [width, height] = resolution.split('X').map(Number);

        // 生成HML内容（不包含任何组件）
        return `<!-- Empty HML file: ${fileName}.hml -->
<!-- Created: ${new Date().toISOString()} -->
<hml id="${fileName}" width="${width}" height="${height}">
  <!-- Add your components here -->
</hml>`;
    }

    /**
     * 生成简单的HML文件内容（用于右键菜单新建文件，不包含screen容器）
     * @param fileName 文件名（不包含扩展名）
     * @param resolution 分辨率 (格式: "WIDTHXHEIGHT")
     * @returns 格式化的HML文件内容
     */
    static generateSimpleHml(fileName: string, resolution: string): string {
        // 解析分辨率
        const [width, height] = resolution.split('X').map(Number);

        // 生成包含基本容器但不包含screen的HML内容
        return `<!-- Simple HML file: ${fileName}.hml -->
<!-- Created: ${new Date().toISOString()} -->
<hml id="${fileName}" width="${width}" height="${height}">
  <container id="root" layout="column">
    <!-- Add your components here -->
  </container>
</hml>`;
    }
}