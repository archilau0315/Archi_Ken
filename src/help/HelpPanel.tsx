import { useState } from 'react'

import { useT } from '../i18n'
import './help.css'

// 帮助面板：用户操作手册 / 快捷键 / 关于（版本信息）/ 订阅（预留）。
// 参考 Solibri（Help → User Guide / About）与 Revit（帮助菜单 + 快捷键一览）的信息架构。

interface Props {
  onClose: () => void
}

type TabKey = 'manual' | 'shortcuts' | 'about' | 'subscribe'

// 手册章节：键对应 i18n 的 help.manual.s<n>.title / .body（body 内 \n 分行渲染）。
const MANUAL_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const
// 快捷键条目：键对应 help.shortcuts.s<n>.keys / .desc。
const SHORTCUT_ITEMS = [1, 2, 3, 4, 5, 6, 7] as const

export default function HelpPanel({ onClose }: Props) {
  const { t } = useT()
  const [tab, setTab] = useState<TabKey>('manual')

  return (
    <div className="editor-overlay help-overlay" onClick={onClose}>
      <div className="editor-dialog help-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="editor-top">
          <strong>{t('help.title')}</strong>
          <span className="tagline">{t('help.tagline')}</span>
          <button className="ghost" onClick={onClose}>
            {t('help.close')}
          </button>
        </header>
        <div className="help-body">
          <nav className="help-nav">
            {(['manual', 'shortcuts', 'about', 'subscribe'] as TabKey[]).map((key) => (
              <button
                key={key}
                className={tab === key ? 'help-nav-item on' : 'help-nav-item'}
                onClick={() => setTab(key)}
              >
                {t(`help.tab.${key}`)}
              </button>
            ))}
          </nav>
          <div className="help-content">
            {tab === 'manual' && (
              <div className="help-manual">
                {MANUAL_SECTIONS.map((n) => (
                  <section key={n} className="help-section">
                    <h3>{t(`help.manual.s${n}.title`)}</h3>
                    {t(`help.manual.s${n}.body`)
                      .split('\n')
                      .map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                  </section>
                ))}
              </div>
            )}
            {tab === 'shortcuts' && (
              <table className="help-shortcuts">
                <tbody>
                  {SHORTCUT_ITEMS.map((n) => (
                    <tr key={n}>
                      <td className="help-keys">{t(`help.shortcuts.s${n}.keys`)}</td>
                      <td>{t(`help.shortcuts.s${n}.desc`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'about' && (
              <div className="help-about">
                <h3>{t('app.brand')}</h3>
                <p className="help-version">
                  {t('help.about.version', { v: __APP_VERSION__ })}
                </p>
                <p>{t('app.tagline')}</p>
                <dl className="help-about-list">
                  <div>
                    <dt>{t('help.about.stack')}</dt>
                    <dd>{t('help.about.stackValue')}</dd>
                  </div>
                  <div>
                    <dt>{t('help.about.license')}</dt>
                    <dd>{t('help.about.licenseValue')}</dd>
                  </div>
                  <div>
                    <dt>{t('help.about.feedback')}</dt>
                    <dd>{t('help.about.feedbackValue')}</dd>
                  </div>
                </dl>
              </div>
            )}
            {tab === 'subscribe' && (
              <div className="help-subscribe">
                <h3>{t('help.subscribe.title')}</h3>
                <p>{t('help.subscribe.body1')}</p>
                <p>{t('help.subscribe.body2')}</p>
                <ul>
                  <li>{t('help.subscribe.f1')}</li>
                  <li>{t('help.subscribe.f2')}</li>
                  <li>{t('help.subscribe.f3')}</li>
                </ul>
                <p className="hint">{t('help.subscribe.note')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
