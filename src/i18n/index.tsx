// 轻量 i18n（L4）：React Context + 字典查表，默认中文，localStorage 持久化，不引入第三方依赖。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import en from './en'
import zh from './zh'

export type Lang = 'zh' | 'en'

const STORAGE_KEY = 'archiken:lang'
const dicts: Record<Lang, Record<string, string>> = { zh, en }

export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** 查字典并替换 {var} 占位；缺键回退中文，再回退键名本身。 */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function initialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // 隐私模式写入失败可忽略
    }
  }, [lang])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t(key, vars) {
        let text = dicts[lang][key] ?? dicts.zh[key] ?? key
        if (vars) {
          for (const [name, v] of Object.entries(vars)) {
            text = text.split(`{${name}}`).join(String(v))
          }
        }
        return text
      },
    }),
    [lang]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT 必须在 I18nProvider 内使用')
  return ctx
}
