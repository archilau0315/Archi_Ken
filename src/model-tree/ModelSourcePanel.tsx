// 模型源管理（L4 / M1）：增删待融合的 IFC 文件，触发多模型融合。
// 「添加」是唯一入口：Electron 走原生文件对话框，浏览器走 file input + 上传；
// 下方示例模型快捷按钮为路径直加。

import { useRef, useState } from 'react'

import { useT } from '../i18n'
import { uploadModelFile } from '../services/kernel'

export interface ModelSourcePanelProps {
  sources: string[]
  busy: boolean
  suggestions: { label: string; path: string }[]
  onChange: (sources: string[]) => void
  /** 被关闭（3D 中隐藏）的源索引集合；仅影响显示，不影响融合 / 检查 / 算量计算。 */
  hidden?: ReadonlySet<number>
  /** 切换某个源的显示开关。 */
  onToggleVisible?: (index: number) => void
}

export default function ModelSourcePanel({ sources, busy, suggestions, onChange, hidden, onToggleVisible }: ModelSourcePanelProps) {
  const { t, lang } = useT()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function add(path: string): void {
    const value = path.trim()
    if (!value || sources.includes(value)) return
    onChange([...sources, value])
  }

  function remove(index: number): void {
    onChange(sources.filter((_, position) => position !== index))
  }

  /** 点「添加」直接打开文件选择器：Electron 走原生对话框，浏览器走 file input。 */
  async function pickFile(): Promise<void> {
    const bridge = window.archiken
    if (bridge?.openFile) {
      const picked = await bridge.openFile()
      if (picked) add(picked)
      return
    }
    fileInputRef.current?.click()
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadModelFile(file, lang)
      add(result.path)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="source-panel">
      <ul className="source-list">
        {sources.map((path, index) => {
          const off = hidden?.has(index) ?? false
          return (
            <li key={path} className={off ? 'source-item off' : 'source-item'}>
              <button
                className={off ? 'src-eye off' : 'src-eye'}
                title={off ? t('tree.showModel') : t('tree.hideModel')}
                onClick={() => onToggleVisible?.(index)}
                aria-pressed={!off}
              >
                <span className="src-eye-dot" />
              </button>
              <span className="source-index">#{index}</span>
              <span className="source-path" title={path}>
                {path.split(/[\\/]/).pop()}
              </span>
              <button className="ghost tiny" onClick={() => remove(index)} disabled={busy}>
                {t('tree.remove')}
              </button>
            </li>
          )
        })}
        {!sources.length && <li className="hint">{t('tree.empty')}</li>}
      </ul>

      <div className="source-add">
        <button className="ghost tiny" onClick={() => void pickFile()} disabled={busy || uploading}>
          {uploading ? t('tree.uploading') : t('tree.add')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ifc,.ifczip,.glb,.gltf"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="source-suggest">
          {suggestions.map((item) => (
            <button
              key={item.path}
              className="ghost tiny"
              onClick={() => add(item.path)}
              disabled={busy || sources.includes(item.path)}
            >
              + {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
