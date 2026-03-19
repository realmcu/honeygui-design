/**
 * LVGL 事件代码生成器接口
 * 定义各组件类型的事件回调生成规范
 */
import { Component } from '../../../hml/types';

export interface LvglEventCodeGenerator {
  /** 生成事件绑定代码（在 ui_create 函数体内，由组件生成器调用） */
  generateEventBindings(component: Component): string;

  /** 收集需要生成的回调函数名列表 */
  collectCallbackFunctions(component: Component): string[];

  /** 获取回调函数实现代码（static void 格式，用于解析为 CallbackImpl） */
  getEventCallbackImpl(component: Component): string[];
}
