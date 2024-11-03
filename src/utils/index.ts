export interface IMessage {
  payload: any
  action: 'updateEdit' | 'generateImage' | 'initIframe' | 'toggleFullscreen'
}

export const requestFullscreen = (element: HTMLElement) => {
  ;(element.requestFullscreen && element.requestFullscreen()) ||
    ((element as any).msRequestFullscreen &&
      (element as any).msRequestFullscreen()) ||
    ((element as any).mozRequestFullScreen &&
      (element as any).mozRequestFullScreen()) ||
    ((element as any).webkitRequestFullscreen &&
      (element as any).webkitRequestFullscreen())
}

export const exitFullscreen = () => {
  ;(document.exitFullscreen && document.exitFullscreen()) ||
    ((document as any).msExitFullscreen &&
      (document as any).msExitFullscreen()) ||
    ((document as any).mozCancelFullScreen &&
      (document as any).mozCancelFullScreen()) ||
    ((document as any).webkitExitFullscreen &&
      (document as any).webkitExitFullscreen())
}

// @ts-ignore
export const isFullScreen = () => {
  return !!(
    document.fullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  )
}

export function debounce(func: Function, delay = 200) {
  let timerId: NodeJS.Timeout

  return function (...args: any[]) {
    clearTimeout(timerId)

    timerId = setTimeout(() => {
      // @ts-ignore
      func.apply(this, args)
    }, delay)
  }
}

export const sendMessage = (data: IMessage) => {
  window.parent.postMessage(JSON.stringify(data), '*')
}

export const blobToBase64 = (blob: Blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result
      resolve(base64String)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const isDarkColorRGB = (color: string) => {
  // 如果颜色值是三位缩写形式，转换为六位完整形式
  if (color.length === 4) {
    color =
      '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }

  // 将颜色值转换为RGB分量
  const r = parseInt(color.substr(1, 2), 16)
  const g = parseInt(color.substr(3, 2), 16)
  const b = parseInt(color.substr(5, 2), 16)

  // 计算亮度值
  const brightness = (r + g + b) / (255 * 3)

  // 判断亮度是否低于某个阈值
  return brightness < 0.5 // 阈值可以根据需要进行调整
}
