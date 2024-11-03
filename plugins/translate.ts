import languages from './config/i18n'
import colors from './config/colors'
import type { IMatch } from './types'

// 匹配和注入的代码
const injectCode = {
  search: 'store.dispatch(initResize());',
  replace: `store.dispatch(initResize());
  window.jbyKetcher={
    store,
    load,
    getFormatMimeTypeByFileName,
    serverTransform,
    saveSettings,
    onAction
  };`
}

// 转换
const matchHandle = (code: string, arrs: IMatch[]) => {
  arrs.forEach(({ search, replace }: IMatch) => {
    const tempSearch = search.replace(/'/g, '"')
    // 转换一层 vite 把部分单引号改成了双引号
    const tempReplace = replace.replace(/'/g, '"')
    code = code.replaceAll(search, replace)
    code = code.replaceAll(tempSearch, tempReplace)
  })
  return code
}

const translate = (env: string) => {
  return {
    name: 'translate',
    enforce: 'pre',
    transform: (code: string, id: string) => {
      // 注入代码
      code = code.replaceAll(injectCode.search, injectCode.replace)

      // 开发环境vite会缓存不可变的包目录和文件名会发生变化 所以开发环境匹配内容 进行 英译汉
      if (env === 'development') {
        if (
          code.indexOf('Livermorium') !== -1 ||
          code.indexOf('command: TextCommand.Bold') !== -1
        ) {
          // 英译汉
          code = matchHandle(code, languages)
        }

        if (id.includes('ketcher-react/dist/index.css')) {
          // 更换全局颜色
          colors.forEach(({ search, replace }) => {
            code = code.replaceAll(search, replace)
          })
        }
      }

      // 生成环境
      if (
        env !== 'development' &&
        (id.includes('node_modules/ketcher-core/dist') ||
          id.includes('node_modules/ketcher-react/dist'))
      ) {
        if (id.endsWith('.js')) {
          // 英译汉
          code = matchHandle(code, languages)
        }

        if (id.endsWith('.css')) {
          // 更换全局颜色
          colors.forEach(({ search, replace }) => {
            code = code.replaceAll(search, replace)
          })
        }
      }
      return code
    }
  }
}

export default translate
