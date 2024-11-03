import { useState, useEffect, useRef } from 'react'
import { Segmented } from 'antd'
import KetchEditor from '../KetchEditor'
import Ketcher3D from '../Ketcher3D'
import styles from './index.module.scss'
import { IOptions, IExtra } from '@/shims-window'
import { debounce, IMessage, sendMessage } from '@/utils'

type EditType = '3d' | 'edit'

type EditMode = 'simple' | 'normal'

const Editor = () => {
  const [type, setType] = useState<EditType | string>('')
  const [struct, setStruct] = useState<string>('')
  const [editMode, setEditMode] = useState<EditMode>('simple')
  const [tabActive, setTabActive] = useState<string>('2D 结构')
  const [extraOption, setExtraOption] = useState<IExtra>({
    showStructTab: false,
    threeStruct: '',
    bgColor: '#000',
    threeStructList: []
  })

  const stateRef = useRef({
    type,
    struct,
    editMode,
    tabActive,
    extraOption
  })
  const editRef = useRef<any>(null)
  const threePreviewRef = useRef<any>(null)

  useEffect(() => {
    if (process.env.VITE_APP_ENV !== 'iframe') {
      listenerMessage({
        action: 'updateEdit',
        payload: {
          struct: '',
          type: 'edit',
          editMode: 'normal'
        }
      })
    }
    // 只有iframe和dev开发监听父级页面
    if (['iframe', 'development'].includes(process.env.VITE_APP_ENV || '')) {
      window.addEventListener('message', handleMessage)
      sendMessage({ action: 'initIframe', payload: {} })
    }
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  /**
   * 问题：
   * 当前项目当做iframe嵌入的时候 在方法中无法拿到以下定义的useState
   * 疑似window.addEventListener引起的必报，无法通过 useCallback 添加依赖解决，
   *
   * tips：
   * 当作为普通项目的时候，又正常可以访问useState的值
   *
   * 解决方案目前采用useRef 监听state 同步
   * */
  useEffect(() => {
    stateRef.current = {
      type,
      struct,
      editMode,
      tabActive,
      extraOption
    }
  }, [type, struct, editMode, extraOption, tabActive])

  const handleMessage = (event: MessageEvent) => {
    if (
      event.origin.includes('localhost:808') ||
      event.origin.includes('localhost:41') ||
      event.origin.includes('xinjiaoyu')
    ) {
      if (event.data) {
        try {
          const res = JSON.parse(event.data)
          listenerMessage(res)
        } catch (err) {
          console.error('error', '数据解析失败！', err)
        }
      }
    }
  }

  // 解析父页面Vue抛出的数据
  const listenerMessage = debounce((state: IMessage) => {
    if (state.action === 'updateEdit') {
      initEdit(state.payload)
      return
    }
    if (state.action === 'generateImage') {
      if (stateRef.current.type === '3d') {
        threePreviewRef.current?.generateImage()
        return
      }
      editRef.current.generateImage(state.payload.data || '')
    }
  }, 200)

  // 初始化
  const initEdit = async (options: IOptions) => {
    let tempStruct = options.struct
    // 如果没有传递结构&切换为3d时候 获取一下 2d编辑器中的结构
    if (!tempStruct && window.ketcher && options.type === '3d') {
      const res = await window.ketcher?.getSdf('v2000')
      tempStruct = (res || '') as string
    }
    setType(options.type || 'edit')
    setStruct(tempStruct)
    setEditMode(options.editMode)
    if (options.extra) {
      const {
        threeStruct = '',
        threeStructList = [],
        bgColor = '#000'
      } = options.extra
      setTabActive(threeStruct ? '3D 结构' : '2D 结构')
      setExtraOption({
        ...extraOption,
        threeStruct: threeStruct,
        threeStructList: threeStructList,
        bgColor,
        showStructTab:
          options.editMode === 'normal' ? false : options.extra.showStructTab
      })
    }
  }

  return (
    <div className={`${styles['ketcher-main']} ketcher-stage`}>
      {type === '3d' && (
        <Ketcher3D
          ref={threePreviewRef}
          type={type}
          threeStructList={extraOption.threeStructList}
          bgColor={extraOption.bgColor}
          struct={extraOption.threeStruct || struct}
        />
      )}
      {type === 'edit' && (
        <KetchEditor ref={editRef} editMode={editMode} struct={struct} />
      )}
      {extraOption.showStructTab && editMode === 'simple' && (
        <div className={styles['tab']}>
          <Segmented<string>
            options={['3D 结构', '2D 结构']}
            defaultValue={tabActive}
            onChange={(value: string) => {
              setTabActive(value)
              setType(value === '3D 结构' ? '3d' : 'edit')
            }}
          />
        </div>
      )}
    </div>
  )
}

export default Editor
