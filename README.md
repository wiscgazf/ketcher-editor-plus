# Ketcher Editor

### 项目简介
采用 React + TypeScript + Vite + iframe通信

- Tip： Nodejs 20以上

---
数据来源 https://pubchem.ncbi.nlm.nih.gov/
#### 打包模式【开发和iframe会启动iframe通信，另外两种是作为普通项目使用】
##### 我们项目采用iframe模式
```ts
// 开发模式
yarn dev
// 打包测试
yarn build:test
// 打包线上
yarn build:live
// 打包iframe模式，带有iframe通信【我们项目用这个】
yarn build:iframe
```

#### window.jbyKetcher

定义
```ts
// 以下都是暴露的Ketcher-react包的redux，使用需要dispatch
interface IJbyKetcher {
  // 配合 load使用，可自定义添加struct到舞台，带有缩略图
  getFormatMimeTypeByFileName: (fileName: string) => string
  load: (struct: string, options?: Object) => any
  // 芳香化
  serverTransform: (method: string, data?: any, struct?: string) => any
  // 保存设置（可采用编辑器的保存，但是无法同步更新，内置包里的设置，建议采用dispatch更新）
  saveSettings: (settings: { [key: string]: number | boolean | string }) => void
  store: any
  // 触发action
  onAction
}
````
使用
```ts
window.jbyKetcher.store.dispatch(functionName)
````
---
#### 组件传递的属性
```ts
// 选项参数
export interface IOptions {
  // 普通结构 sdf string
  struct: string
  // 编辑器类型（3d只能预览）
  type: '3d' | 'edit'
  // 编辑器模式 简单 和 默认
  editMode: 'simple' | 'normal'
  // 额外参数
  extra?: IExtra
}

// extra 额外参数
export interface IExtra {
  // 是否显示顶部3d和2d切换，只有简单版编辑器配置才有效
  showStructTab: boolean
  // 3d结构
  threeStruct?: string
  // 3d结构列表
  threeStructList?: string[]
  // 预览3d背景色
  bgColor?: string
}
````
---
#### 挂在window的全局属性
```ts
declare global {
  interface Window {
    // 编辑器实例
    ketcher: Ketcher
    miew: any
    // （这个是源码中进行了更改，loader方式）抛出的ketcher-react包中没公开的方法 可用于自定义按钮 具体查看源码 ketcher-react2.25.0 Open.Container.tsx
    jbyKetcher: IJbyKetcher
    initRDKitModule: any
    RDKit: any
  }
}
```
