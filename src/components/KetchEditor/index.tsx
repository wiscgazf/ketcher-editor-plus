import {
  FC,
  useEffect,
  useMemo,
  useState,
  memo,
  forwardRef,
  useImperativeHandle
} from 'react'
import { Modal, message } from 'antd'
// @ts-ignore
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import { Editor, ButtonsConfig } from 'ketcher-react'
import type { Ketcher, MolfileFormat } from 'ketcher-core'
import { settings } from '@/config/settings'
import {
  requestFullscreen,
  isFullScreen,
  exitFullscreen,
  blobToBase64,
  sendMessage,
  debounce
} from '@/utils'
import Ketcher3D from '../Ketcher3D'
import { rightBar, editLeftBar, IBarItem, topBar } from '@/config/customBar'
import 'miew/dist/Miew.min.css'
import 'ketcher-react/dist/index.css'
import styles from './index.module.scss'

type EditMode = 'simple' | 'normal'
interface IProps {
  editMode: EditMode
  struct: string
}

const structServiceProvider = new StandaloneStructServiceProvider()
const KetcherMain: FC<IProps & { ref?: any }> = forwardRef(
  ({ struct = '', editMode = 'simple' }, ref) => {
    // MOL 结构的字符串
    const [molStr, setMolStr] = useState<string>('')
    // 预览弹窗
    const [previewModal, setPreviewModal] = useState<boolean>(false)

    const [messageApi, contextHolder] = message.useMessage()

    // 放大倍数
    const [_zoom, setZoom] = useState<number>(1)

    const [leftBarFlg, setLeftBarFlag] = useState({
      arom: '',
      c: false,
      h: false,
      allH: false
    })

    useEffect(() => {
      if (struct && window.ketcher) {
        window.ketcher
          .setMolecule(struct)
          .then(() => {
            resetView(false)
          })
          .catch(() => {
            messageApi.error('加载化学结构失败')
          })
      }

      return () => {
        if (window.ketcher) {
          const { editor } = window.ketcher
          editor?.clear && editor?.clear()
        }
      }
    }, [struct])

    useImperativeHandle(ref, () => {
      return {
        generateImage
      }
    })

    useEffect(() => {
      window.addEventListener('resize', centerStruct)
      return () => {
        window.removeEventListener('resize', centerStruct)
      }
    }, [])

    const centerStruct = debounce(() => {
      window.ketcher?.editor.centerStruct()
    }, 200)

    // 生成图片
    const generateImage = async (data: string) => {
      let str = data
      if (!str) {
        const res: string = await window.ketcher?.getSdf('v2000')
        str = res
      }
      window.ketcher
        .generateImage(str, {
          outputFormat: 'png',
          bondThickness: 2
        })
        .then(async (result: Blob) => {
          const res = await blobToBase64(result)
          sendMessage({
            action: 'generateImage',
            payload: {
              data: res,
              struct: str
            }
          })
        })
    }

    // init ketch
    const handleOnInit = async (ins: Ketcher) => {
      window.ketcher = ins
      if (struct) {
        resetView()
      }
      // window.ketcher.editor.subscribe('change', (data) => console.log('11', data))
    }

    // 按钮配置
    const buttonConfig = useMemo(() => {
      const obj: ButtonsConfig = {}
      const hiddenButton = [
        'miew',
        'about',
        'help',
        'images',
        'settings',
        'fullscreen'
      ]
      const transformTools = ['transform-flip-h', 'transform-flip-v']
      hiddenButton.forEach((value) => {
        obj[value] = {
          hidden: true
        }
      })
      if (editMode === 'simple') {
        transformTools.forEach((value) => {
          obj[value] = {
            hidden: true
          }
        })
      }
      return obj
    }, [editMode])

    // 获取mol
    const getMol = async (molfile: MolfileFormat = 'v2000') => {
      if (window.ketcher.containsReaction()) {
        messageApi.warning('该结构不能保存为*.MOL，由反应箭头表示。')
        return undefined
      }
      try {
        const res = await window.ketcher?.getMolfile(molfile)
        return res
      } catch (e) {
        messageApi.warning('获取MOL失败')
      }
      return undefined
    }

    const customTopBarHandle = async (data: IBarItem) => {
      if (data.action === 'three3DPreview') {
        await preview3d()
        return
      }
      if (data.action === 'setting') {
        const { store, onAction = () => {} } = window.jbyKetcher
        store.dispatch(onAction({ dialog: 'settings' }))
        return
      }
      if (data.action === 'toggleFullscreen') {
        toggleFullscreen()
      }
    }

    // 预览
    const preview3d = async () => {
      // 3d预览用mol文件，不然预览化学式丢失
      const res: string | undefined = await getMol()
      if (res === undefined) {
        return
      }
      if (res === '') {
        messageApi.warning('内容为空')
        return
      }
      setMolStr(res)
      setPreviewModal(true)
    }

    const setSetting = async (key: keyof typeof leftBarFlg) => {
      const params = {
        ...settings
      }
      if (key === 'c') {
        params.carbonExplicitly = !leftBarFlg[key]
        params.showHydrogenLabels = leftBarFlg['h'] ? 'all' : 'off'
      } else if (key === 'h') {
        params.carbonExplicitly = leftBarFlg['c']
        params.showHydrogenLabels = leftBarFlg[key] ? 'off' : 'all'
      }
      const { store, saveSettings } = window.jbyKetcher
      store.dispatch(saveSettings(params))
      setLeftBarFlag({ ...leftBarFlg, [key]: !leftBarFlg[key] })
    }

    // 放大、缩小、重置
    const zoomChange = (val: number) => {
      if (val === 1) {
        window.ketcher.editor.zoom(val)
        setZoom(val)
        return
      }
      const getZoom = window.ketcher.editor.zoom()
      const calcVal = val + getZoom
      const num = calcVal >= 4 ? 4 : calcVal <= 0.2 ? 0.2 : calcVal
      window.ketcher.editor.zoom(num)
      setZoom(num)
    }

    // 全屏切换
    const toggleFullscreen = () => {
      const isFull = isFullScreen()
      isFull ? exitFullscreen() : requestFullscreen(document.documentElement)
    }

    // 芳香化change
    const aromChange = (val: string, key: string) => {
      const { store, serverTransform } = window.jbyKetcher
      store.dispatch(serverTransform(val))
      setLeftBarFlag({
        ...leftBarFlg,
        [key]: key === 'allH' ? !leftBarFlg[key] : val
      })
    }

    // 重置
    const resetView = async (isSetStruct = true) => {
      let options = { c: false, h: false }
      const local = localStorage.getItem('ketcher-opts')
      if (local) {
        const storageOptions = JSON.parse(local)
        options = {
          c: storageOptions.carbonExplicitly || false,
          h: (storageOptions.showHydrogenLabels || 'off') === 'all'
        }
      }
      setLeftBarFlag({
        arom: '',
        allH: false,
        ...options
      })
      zoomChange(1)
      if (isSetStruct) {
        await window.ketcher.setMolecule(struct)
      }
    }

    const actionChange = ({ action, val, key }: IBarItem) => {
      switch (action) {
        case 'aromChange':
        case 'toggleAllHydrogens':
          aromChange(val as string, key || '')
          break
        case 'changeEl':
          setSetting(key as keyof typeof leftBarFlg)
          break
        case 'toggleFullscreen':
          toggleFullscreen()
          break
        case 'resetView':
          resetView()
          break
        case 'zoomChange':
          zoomChange(val as number)
          break
        default:
          return ''
      }
    }

    return (
      <>
        <div
          className={`${styles['ketcher-body']} ${editMode === 'simple' ? 'ketcher-tool-hidden' : ''}`}
        >
          {contextHolder}
          <Editor
            staticResourcesUrl={''}
            errorHandler={() => {}}
            structServiceProvider={structServiceProvider}
            onInit={handleOnInit}
            togglerComponent={
              <div className={'ketcher-custom-wrap'}>
                {topBar.map((item, idx) => {
                  return (
                    <div
                      className={'ketcher-custom-item'}
                      title={item.title}
                      key={idx}
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                      onClick={() => customTopBarHandle(item)}
                    ></div>
                  )
                })}
              </div>
            }
            buttons={buttonConfig}
          />
          {editMode === 'simple' && (
            <div className={styles['simple-bottom-bar']}>
              <div className={styles['bar-left']}>
                {editLeftBar.map((item, idx) => {
                  if (item.group) {
                    return (
                      <div className={styles['group']} key={idx}>
                        {item.group.map((dd, idx1) => {
                          return (
                            <div
                              key={idx1}
                              className={`${styles['bar-item']} ${styles[`${dd.val === leftBarFlg.arom ? 'active' : ''}`]}`}
                              dangerouslySetInnerHTML={{
                                __html: dd.icon || ''
                              }}
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
                      onClick={() => actionChange(item)}
                      className={`${styles['bar-item']} ${styles[`${leftBarFlg[item.key as keyof typeof leftBarFlg] ? 'active' : ''}`]}`}
                      dangerouslySetInnerHTML={{ __html: item.icon || '' }}
                      title={item.title}
                    ></div>
                  )
                })}
              </div>
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
          )}
        </div>
        <Modal
          className={styles['preview-modal']}
          footer={null}
          open={previewModal}
          onCancel={() => setPreviewModal(false)}
          title={''}
          width={'65vw'}
        >
          {previewModal && <Ketcher3D struct={molStr} />}
        </Modal>
      </>
    )
  }
)

export default memo(KetcherMain, (prevProps, nextProps) => {
  return (
    prevProps.struct === nextProps.struct &&
    prevProps.editMode === nextProps.editMode
  )
})
