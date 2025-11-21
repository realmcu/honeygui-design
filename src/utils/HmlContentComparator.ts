/**
 * HML内容对比工具
 * 提供智能的内容对比功能，防止误判和竞态条件
 */
export class HmlContentComparator {
    /**
     * 标准化HML内容用于对比
     * 移除无关的空白、格式化差异，保留语义结构
     */
    static normalizeContent(content: string): string {
        if (!content) return '';
        
        // 1. 移除XML声明和多余的空白
        let normalized = content
            .replace(/<\?xml[^>]*>\s*/g, '')  // 移除XML声明
            .replace(/\s+/g, ' ')              // 合并多个空白字符
            .replace(/>\s+</g, '><')           // 移除标签间的空白
            .trim();
        
        // 2. 属性排序：确保属性顺序一致
        normalized = this.sortAttributes(normalized);
        
        // 3. 移除注释和不必要的空白
        normalized = normalized
            .replace(/<!--[\s\S]*?-->/g, '')   // 移除注释
            .replace(/\s*=\s*"/g, '="')       // 标准化属性赋值
            .replace(/\s*=\s*'/g, "='");
        
        return normalized;
    }
    
    /**
     * 对XML标签的属性进行排序，确保对比一致性
     */
    private static sortAttributes(xmlContent: string): string {
        return xmlContent.replace(/<([^>]+)>/g, (match, tagContent) => {
            // 分离标签名和属性
            const spaceIndex = tagContent.indexOf(' ');
            if (spaceIndex === -1) return match; // 无属性，直接返回
            
            const tagName = tagContent.substring(0, spaceIndex);
            const attributesStr = tagContent.substring(spaceIndex + 1);
            
            // 解析并排序属性
            const attributes = this.parseAttributes(attributesStr);
            const sortedAttributes = attributes.sort((a, b) => a.name.localeCompare(b.name));
            
            // 重新构建标签
            const sortedAttrStr = sortedAttributes.map(attr => `${attr.name}="${attr.value}"`).join(' ');
            return `<${tagName} ${sortedAttrStr}>`;
        });
    }
    
    /**
     * 解析属性字符串为对象数组
     */
    private static parseAttributes(attrStr: string): Array<{name: string, value: string}> {
        const attributes: Array<{name: string, value: string}> = [];
        const regex = /(\w+)=["']([^"']*)["']/g;
        let match;
        
        while ((match = regex.exec(attrStr)) !== null) {
            attributes.push({
                name: match[1],
                value: match[2]
            });
        }
        
        return attributes;
    }
    
    /**
     * 智能对比两个HML内容是否语义相等
     * @returns 返回对比结果和详细信息
     */
    static smartCompare(content1: string, content2: string): {
        isEqual: boolean;
        reason?: string;
        normalized1?: string;
        normalized2?: string;
    } {
        if (!content1 && !content2) return { isEqual: true };
        if (!content1 || !content2) return { isEqual: false, reason: '内容为空' };
        
        const normalized1 = this.normalizeContent(content1);
        const normalized2 = this.normalizeContent(content2);
        
        if (normalized1 === normalized2) {
            return { isEqual: true };
        }
        
        // 如果不相等，提供详细原因
        const diffInfo = this.findDifferences(normalized1, normalized2);
        return {
            isEqual: false,
            reason: diffInfo.reason,
            normalized1: normalized1.substring(0, 200),  // 返回前200字符用于调试
            normalized2: normalized2.substring(0, 200)
        };
    }
    
    /**
     * 查找两个内容的差异
     */
    private static findDifferences(str1: string, str2: string): {reason: string} {
        if (str1.length !== str2.length) {
            return { reason: `长度不同 (${str1.length} vs ${str2.length})` };
        }
        
        // 找到第一个不同的位置
        for (let i = 0; i < str1.length; i++) {
            if (str1[i] !== str2[i]) {
                const context = 20;
                const start = Math.max(0, i - context);
                const end = Math.min(str1.length, i + context);
                
                const diff1 = str1.substring(start, end);
                const diff2 = str2.substring(start, end);
                
                return {
                    reason: `内容差异位置 ${i}: "${diff1}" vs "${diff2}"`
                };
            }
        }
        
        return { reason: '未知差异' };
    }
    
    /**
     * 快速哈希对比
     * 用于快速判断内容是否可能相等
     */
    static getContentHash(content: string): string {
        if (!content) return '';
        
        const normalized = this.normalizeContent(content);
        let hash = 0;
        
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return hash.toString(36); // 转换为36进制字符串
    }
}