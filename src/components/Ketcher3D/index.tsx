import {
  FC,
  useEffect,
  useRef,
  useState,
  memo,
  forwardRef,
  useImperativeHandle,
  useMemo
} from 'react'
// @ts-ignore
import initRDKitModule, { RDKitModule } from '@rdkit/rdkit'
// @ts-ignore
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import { Editor, ButtonsConfig } from 'ketcher-react'
import type { Ketcher, MolfileFormat } from 'ketcher-core'
import { message } from 'antd'
import styles from './index.module.scss'
import {
  requestFullscreen,
  isFullScreen,
  exitFullscreen,
  debounce,
  sendMessage,
  isDarkColorRGB
} from '@/utils'
import Miew from 'miew'
import { threeDLeftBar, rightBar, IBarItem, arrows } from '@/config/customBar'

interface IProps {
  struct: string
  type?: '3d' | 'edit'
  bgColor?: string
  threeStructList?: string[]
}

// 模型
/**
 * const models: IModels[] = [
 {
 title: '球棍模型',
 value: 'BS'
 }, {
 title: '棒状模型',
 value: 'LC'
 }, {
 title: '空间填充模型',
 value: 'VW'
 },
 {
 title: '线模型',
 value: 'LN'
 }, {
 title: 'QS模型',
 value: 'QS'
 }, {
 title: 'SA模型',
 value: 'SA'
 }, {
 title: 'SE模型',
 value: 'SE'
 }, {
 title: 'CS模型',
 value: 'CS'
 }
 ]*/

/**
 * 保留
 // 颜色
 const colors: string[] = [
 'EL', 'RT', 'SQ', 'CH', 'SS', 'UN', 'CO', 'CF', 'TM', 'OC', 'HY', 'MO', 'CB'
 ]

 // 主题
 const themes = [
 'SF', 'DF', 'PL', 'ME', 'TR', 'GL', 'BA', 'TN', 'FL'
 ]

 // 调色板
 const palettes = [
 'JM', 'CP', 'VM'
 ]*/

interface ILeftBarFlag {
  h: boolean
  animation: boolean
}

const flagKey: string[] = ['animation', 'h']

const structServiceProvider = new StandaloneStructServiceProvider()

const Ketcher3D: FC<IProps & { ref?: any }> = forwardRef(
  ({ struct, type = 'edit', bgColor = '#000', threeStructList = [] }, ref) => {
    // 预览 dom ref
    const previewDom = useRef<HTMLDivElement | null>(null)
    // 模型
    const [model, setModel] = useState<string>('BS')

    const [leftBarFlg, setLeftBarFlag] = useState<ILeftBarFlag>({
      h: false,
      animation: false
    })
    const [messageApi, contextHolder] = message.useMessage()

    const tempKetcher = useRef<null | Ketcher>(null)

    const timer = useRef<NodeJS.Timeout | undefined>(undefined)

    const retry = useRef(0)

    // 初始化RDKitModule 用于3D H元素切换
    useEffect(() => {
      if (window.RDKit) {
        return
      }
      // @ts-ignore
      initRDKitModule({
        locateFile: () => '/RDKit_minimal.wasm'
      }).then((ins: RDKitModule) => {
        window.RDKit = ins
      })

      return () => {
        resetTimer()
      }
    }, [])

    useEffect(() => {
      if (!previewDom.current) {
        return
      }
      setLeftBarFlag({ ...leftBarFlg, h: struct.includes('H') })
      if (window.miew) {
        preview3D(struct)
        return
      }
      type === 'edit' && initMiew()
    }, [struct, type])

    useImperativeHandle(ref, () => {
      return {
        preview3D,
        generateImage
      }
    })

    const buttonConfig = useMemo(() => {
      const obj: ButtonsConfig = {}
      const buttons = [
        'miew',
        'about',
        'help',
        'images',
        'transform-flip-h',
        'transform-flip-v',
        'settings',
        'fullscreen'
      ]
      buttons.forEach((value) => {
        obj[value] = {
          hidden: true
        }
      })
      return obj
    }, [])

    // 初始化中转2d edit
    const handleOnInit = (ins: Ketcher) => {
      tempKetcher.current = ins
      // 必须要有ketcher实例抛出到window
      window.ketcher = ins
      initMiew()
    }

    const initMiew = () => {
      window.miew = new Miew({
        container: previewDom.current,
        load: '',
        settings: {
          camDistance: 5,
          axes: false,
          fps: false,
          zooming: true,
          resolution: 'high',
          editing: true,
          autoRotation: 0,
          fogFarFactor: 3,
          ao: true,
          aromatic: true,
          autoResolution: true,
          bg: {
            color: bgColor
          }
        }
      })
      if (window.miew.init()) {
        window.miew.run()
        preview3D(struct)
      }
    }

    // 获取mol
    const getMol = async (molfile: MolfileFormat = 'v2000') => {
      if (tempKetcher.current?.containsReaction()) {
        messageApi.warning('该结构不能保存为*.MOL，由反应箭头表示。')
        return
      }
      const res = await tempKetcher.current?.getMolfile(molfile)
      return res
    }

    const resetTimer = () => {
      retry.current = 0
      timer.current && clearInterval(timer.current)
    }

    // 预览3d
    const preview3D = debounce(async (sdf: string) => {
      let mol = sdf || ''
      /**
       * 单纯的type=3d预览，需要根据2d编辑器吧struct转换成mol结构，否则sdf格式的文件无法渲染多个化学式
       * type=edit 2d编辑器在点击预览的时候提前转换了
       * */
      if (tempKetcher.current) {
        tempKetcher.current?.setMolecule(mol).then(() => {
          // 用计时器获取mol机构，因为设置完结构到ketcher后，svg绘制异步导致获取不到mol
          timer.current = setInterval(async () => {
            // 超过5s还获取不到 mol 报错
            if (retry.current > 50) {
              messageApi.warning('设置3D分子式结构超时！将采用sdf格式渲染3D')
              resetTimer()
              loadThreeDMolFile(mol, 'sdf')
            }
            retry.current += 1
            const smiles = await tempKetcher.current?.getSmiles(true)
            if (smiles) {
              const molRes = await getMol()
              molRes && loadThreeDMolFile(molRes)
              resetTimer()
            }
          }, 100)
        })
        return
      }
      loadThreeDMolFile(mol)
    }, 100)

    // 加载3d的mol文件
    const loadThreeDMolFile = (mol: string, format = 'mol') => {
      const previewFile: File = molStringToFile(mol, format)
      window.miew
        .load(previewFile)
        .then(() => {
          // 加载模型后当前什么模型就改成什么模型(主要用于切换H)
          changeModel(model)
          console.log('load 3d success~')
        })
        .catch((_err: any) => {
          messageApi.destroy()
          messageApi.open({
            type: 'warning',
            content: mol
              ? '3D预览解析失败，请查看分子式结构是否有误~'
              : '化学结构内容为空~'
          })
        })
    }

    // 生成图片
    const generateImage = () => {
      const base64 = window.miew?.screenshot()
      sendMessage({
        action: 'generateImage',
        payload: {
          data: base64,
          struct: struct
        }
      })
    }

    // mol字符串转File
    const molStringToFile = (content: string, format = 'mol') => {
      const blob = new Blob([content], { type: 'text/plain' })
      const file = new File([blob], `${Date.now()}.${format}`, {
        type: 'text/plain'
      })
      return file
    }

    // 切换模型
    const changeModel = (value: string) => {
      setModel(value)
      window.miew.rep({ mode: value })
    }

    /**
     * TODO 保留一下，方法不好查找
     // 切换颜色
     const changeColors = (value: string) => {
     setColor(value)
     window.miew.rep({colorer: value})
     }

     // 切换主题
     const changeMaterial = (value: string) => {
     setTheme(value)
     window.miew.rep({material: value})
     }

     // 切换调色板
     const changePalette = (value: string) => {
     setPalette(value)
     window.miew.settings.set('palette', value)
     }*/

    // 全屏切换
    const toggleFullscreen = () => {
      const fullscreenElement: HTMLElement | null = document.querySelector(
        '.' + styles['preview-3d-wrapper']
      )
      const isFull = isFullScreen()
      isFull
        ? exitFullscreen()
        : requestFullscreen(fullscreenElement as HTMLElement)
    }

    // 放大缩小画布
    const zoomChange = (val: number) => {
      window.miew.scale(val)
    }

    // 重置
    const resetView = () => {
      changeModel('BS')
      preview3D(struct)
    }

    // 动画change
    const playChange = () => {
      window.miew.settings.set('autoRotation', leftBarFlg.animation ? 0 : 0.2)
      setLeftBarFlag({ ...leftBarFlg, animation: !leftBarFlg.animation })
    }

    const setSetting = async () => {
      const ketcherEdit = type === '3d' ? tempKetcher.current : window.ketcher
      if (ketcherEdit) {
        const molRes = await ketcherEdit.getMolfile('v2000')
        if (window.RDKit) {
          const molIns = window.RDKit.get_mol(molRes)
          if (!molIns) {
            messageApi.warning('该分子结构不支持H键切换。')
            return
          }
          loadThreeDMolFile(leftBarFlg.h ? molIns.remove_hs() : molIns.add_hs())
        }
        setLeftBarFlag({ ...leftBarFlg, h: !leftBarFlg.h })
      }
    }

    const actionChange = ({ val, action = '' }: IBarItem) => {
      switch (action) {
        case 'setSetting':
          setSetting()
          break
        case 'playChange':
          playChange()
          break
        case 'changeModel':
          changeModel(val as string)
          break
        case 'resetView':
          resetView()
          break
        case 'zoomChange':
          zoomChange(1 + (val as number))
          break
        case 'toggleFullscreen':
          toggleFullscreen()
          break
        default:
          return ''
      }
    }

    return (
      <div className={styles['preview-3d-wrapper']}>
        {contextHolder}
        <div className={styles['preview-3d']} ref={previewDom}></div>
        <div>
          <div className={styles['simple-bottom-bar']}>
            <div className={styles['bar-left']}>
              {threeDLeftBar.map((item: IBarItem, idx) => {
                if (item.group) {
                  return (
                    <div className={styles['group']} key={idx}>
                      {item.group.map((dd: IBarItem, idx1) => {
                        return (
                          <div
                            key={idx1}
                            className={`${styles['bar-item']} ${styles[`${dd.val === model ? 'active' : ''}`]}`}
                            dangerouslySetInnerHTML={{ __html: dd.icon || '' }}
                            onClick={() => actionChange(dd)}
                            title={dd.title}
                          ></div>
                        )
                      })}
                    </div>
                  )
                }
                return (
                  <div
                    key={idx}
                    // @ts-ignore
                    className={`${styles['bar-item']} ${styles[`${item.val && flagKey.includes(String(item.val)) && leftBarFlg[item.val] ? 'active' : ''}`]}`}
                    dangerouslySetInnerHTML={{ __html: item.icon || '' }}
                    title={item.title}
                    onClick={() => actionChange(item)}
                  ></div>
                )
              })}
            </div>
            {threeStructList.length > 0 && (
              <div
                className={`${styles['bar-middle']} ${isDarkColorRGB(bgColor) ? `${styles['dark']}` : ''}`}
              >
                <div
                  className={styles['arrow-item']}
                  dangerouslySetInnerHTML={{ __html: arrows[0].icon || '' }}
                ></div>
                <span> 1 / 5 </span>
                <div
                  className={styles['arrow-item']}
                  dangerouslySetInnerHTML={{ __html: arrows[1].icon || '' }}
                ></div>
              </div>
            )}
            <div className={styles['bar-right']}>
              {rightBar.map((item, idx) => {
                return (
                  <div
                    key={idx}
                    className={`${styles['bar-item']}`}
                    onClick={() => actionChange(item)}
                    dangerouslySetInnerHTML={{ __html: item.icon || '' }}
                    title={item.title}
                  ></div>
                )
              })}
            </div>
          </div>
        </div>
        {type === '3d' && (
          <div className={styles['hidden']}>
            <Editor
              staticResourcesUrl={''}
              errorHandler={() => {}}
              structServiceProvider={structServiceProvider}
              onInit={handleOnInit}
              buttons={buttonConfig}
            />
          </div>
        )}
      </div>
    )
  }
)

export default memo(
  Ketcher3D,
  (prevProps, nextProps) =>
    prevProps.struct === nextProps.struct && prevProps.type === nextProps.type
)
