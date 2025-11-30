"use strict";
/**
 * 改进的HML解析器
 * 修复了组件过滤问题，支持更灵活的组件识别
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentRegistry = exports.HmlParser = void 0;
var fast_xml_parser_1 = require("fast-xml-parser");
var Logger_1 = require("../utils/Logger");
/**
 * 组件注册表 - 集中管理所有支持的组件类型
 */
var ComponentRegistry = /** @class */ (function () {
    function ComponentRegistry() {
    }
    ComponentRegistry.isValidComponent = function (name) {
        return this.VALID_COMPONENTS.has(name) || name.startsWith('hg_') || name.startsWith('custom_');
    };
    ComponentRegistry.register = function (componentName) {
        this.VALID_COMPONENTS.add(componentName);
    };
    ComponentRegistry.VALID_COMPONENTS = new Set([
        // HoneyGUI标准组件 (hg_前缀)
        'hg_button', 'hg_panel', 'hg_text', 'hg_image', 'hg_input',
        'hg_checkbox', 'hg_radio', 'hg_progressbar', 'hg_slider',
        'hg_switch', 'hg_canvas', 'hg_list', 'hg_grid', 'hg_tab',
        'hg_label',
        // 容器组件
        'hg_window', 'hg_dialog', 'hg_container', 'hg_view'
    ]);
    return ComponentRegistry;
}());
exports.ComponentRegistry = ComponentRegistry;
/**
 * HML解析器 (改进版本)
 */
var HmlParser = /** @class */ (function () {
    function HmlParser() {
        this.idCounter = 0;
        this.xmlParser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            textNodeName: '_text',
            parseAttributeValue: true,
            trimValues: true
        });
    }
    /**
     * 解析HML内容
     */
    HmlParser.prototype.parse = function (content) {
        try {
            var parsed = this.xmlParser.parse(content);
            if (!parsed.hml) {
                throw new Error('Invalid HML: missing <hml> root element');
            }
            var meta = this._parseMeta(parsed.hml.meta || {});
            var view = this._parseView(parsed.hml.view || {}, meta);
            return { meta: meta, view: view };
        }
        catch (error) {
            throw new Error("HML parsing failed: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    /**
     * 解析元数据
     */
    HmlParser.prototype._parseMeta = function (metaElement) {
        var meta = {};
        // 基本属性
        if (metaElement.title)
            meta.title = String(metaElement.title);
        if (metaElement.description)
            meta.description = String(metaElement.description);
        // 项目信息
        if (metaElement.project) {
            meta.project = __assign({}, metaElement.project);
        }
        // 作者信息
        if (metaElement.author) {
            meta.author = __assign({}, metaElement.author);
        }
        // 默认值
        if (!meta.title)
            meta.title = '未命名页面';
        return meta;
    };
    /**
     * 解析视图
     */
    HmlParser.prototype._parseView = function (viewElement, meta) {
        var _this = this;
        var components = [];
        var componentMap = new Map();
        if (viewElement && typeof viewElement === 'object') {
            Object.keys(viewElement).forEach(function (key) {
                if (key === '_attributes' || key === '_text') {
                    return;
                }
                // 使用改进的组件验证
                if (!ComponentRegistry.isValidComponent(key)) {
                    Logger_1.logger.warn("[HoneyGUI] \u8DF3\u8FC7\u672A\u77E5\u7EC4\u4EF6: ".concat(key, ", \u63D0\u793A: \u5982\u679C\u8FD9\u662F\u81EA\u5B9A\u4E49\u7EC4\u4EF6\uFF0C\u8BF7\u4F7F\u7528 'custom_' \u524D\u7F00\u6216\u6CE8\u518C\u5230\u7EC4\u4EF6\u8868"));
                    return;
                }
                var element = viewElement[key];
                if (element && typeof element === 'object') {
                    var elements = Array.isArray(element) ? element : [element];
                    elements.forEach(function (child) {
                        var component = _this._parseComponent(key, child, componentMap, undefined);
                        components.push(component);
                    });
                }
            });
        }
        return {
            components: Array.from(componentMap.values())
        };
    };
    /**
     * 解析组件
     */
    HmlParser.prototype._parseComponent = function (tagName, element, componentMap, parentId) {
        // 优先从 _attributes 中获取，如果不存在则从 element 本身获取
        var attributes = element._attributes || element;
        // 确保正确提取 id，避免生成新ID
        var componentId = attributes.id || element.id || this._generateId(tagName);
        // 检查是否已存在
        if (componentMap.has(componentId)) {
            return componentMap.get(componentId);
        }
        // 直接使用tagName作为组件类型
        var normalizedType = tagName;
        // 解析位置和尺寸
        var position = {
            x: parseInt(attributes.x || '0'),
            y: parseInt(attributes.y || '0'),
            width: parseInt(attributes.width || '100'),
            height: parseInt(attributes.height || '40')
        };
        // 分离属性
        var _a = this._categorizeAttributes(attributes), style = _a.style, data = _a.data, events = _a.events;
        // 创建组件
        var component = {
            id: componentId,
            type: normalizedType,
            name: attributes.name || componentId,
            position: position,
            style: style,
            data: data,
            events: events,
            children: [],
            parent: parentId || null,
            visible: attributes.visible !== false,
            enabled: attributes.enabled !== false,
            locked: attributes.locked === true,
            zIndex: parseInt(attributes.zIndex || '0')
        };
        // 添加到映射
        componentMap.set(componentId, component);
        // 解析子组件
        this._parseChildren(element, componentMap, componentId, component);
        return component;
    };
    /**
     * 分类属性到style、data、events
     */
    HmlParser.prototype._categorizeAttributes = function (attributes) {
        var style = {};
        var data = {};
        var events = {};
        var styleProps = new Set([
            'color', 'backgroundColor', 'fontSize', 'fontWeight',
            'border', 'borderRadius', 'padding', 'margin',
            'opacity', 'overflow', 'title', 'titleBarHeight', 'titleBarColor'
        ]);
        var dataProps = new Set([
            'text', 'src', 'value', 'placeholder', 'options',
            'min', 'max', 'step', 'checked', 'selected'
        ]);
        var metaProps = new Set([
            'id', 'name', 'x', 'y', 'width', 'height',
            'visible', 'enabled', 'locked', 'zIndex', 'parent'
        ]);
        Object.keys(attributes).forEach(function (key) {
            if (metaProps.has(key)) {
                return; // 跳过元属性
            }
            // 跳过组件类型属性（如 hg_button, hg_panel 等），这些是冗余数据
            if (ComponentRegistry.isValidComponent(key)) {
                return;
            }
            if (key.startsWith('on')) {
                events[key] = attributes[key];
            }
            else if (styleProps.has(key)) {
                style[key] = attributes[key];
            }
            else if (dataProps.has(key)) {
                data[key] = attributes[key];
            }
            else {
                // 未知属性放入data
                data[key] = attributes[key];
            }
        });
        return { style: style, data: data, events: events };
    };
    /**
     * 解析子组件
     */
    HmlParser.prototype._parseChildren = function (element, componentMap, parentId, parentComponent) {
        var _this = this;
        Object.keys(element).forEach(function (key) {
            if (key === '_attributes' || key === '_text') {
                return;
            }
            if (!ComponentRegistry.isValidComponent(key)) {
                return;
            }
            var childElement = element[key];
            if (childElement && typeof childElement === 'object') {
                var children = Array.isArray(childElement) ? childElement : [childElement];
                children.forEach(function (child) {
                    var childComponent = _this._parseComponent(key, child, componentMap, parentId);
                    parentComponent.children.push(childComponent.id);
                });
            }
        });
    };
    /**
     * 生成唯一ID
     */
    HmlParser.prototype._generateId = function (prefix) {
        return "".concat(prefix, "_").concat(Date.now(), "_").concat(this.idCounter++);
    };
    return HmlParser;
}());
exports.HmlParser = HmlParser;
