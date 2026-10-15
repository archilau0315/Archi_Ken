import { useEffect, useState } from 'react'

import { useT } from '../i18n'
import { rulePresets, ruleTemplates, validateRules } from '../services/kernel'
import type { RulePreset, RuleSpec } from '../services/kernel'
import { deleteRuleset, getRuleset, listRulesets, runRuleset, saveRuleset } from '../services/ruleset'
import type { Ruleset, RulesetSummary } from '../services/ruleset'
import RuleEditor from './RuleEditor'

// 规则集管理编辑器（L4）：列出 / 新建 / 编辑 / 保存 / 删除规则集，
// 支持从内置模板添加规则，并可「用规则集运行检查」。

const BLANK_RULE: RuleSpec = {
  id: 'new-rule',
  name: '',
  category: '',
  severity: 'error',
  target: { ifc_type: ['*'] },
  check: { type: 'property', pset: 'Pset_WallCommon', prop: 'IsExternal', op: '==', value: true }
}

function makeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function uniqueRuleId(base: string, rules: RuleSpec[]): string {
  const taken = new Set(rules.map((rule) => rule.id))
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

interface Props {
  modelPath: string
  onReport: (report: Awaited<ReturnType<typeof runRuleset>>) => void
  onClose: () => void
}

export default function RulesetEditor({ modelPath, onReport, onClose }: Props) {
  const { t, lang } = useT()
  const [list, setList] = useState<RulesetSummary[]>([])
  const [draft, setDraft] = useState<Ruleset | null>(null)
  const [templates, setTemplates] = useState<RuleSpec[]>([])
  const [templatePick, setTemplatePick] = useState('')
  const [presets, setPresets] = useState<RulePreset[]>([])
  const [presetPick, setPresetPick] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh(): Promise<void> {
    const result = await listRulesets()
    setList(result.items)
  }

  useEffect(() => {
    void (async () => {
      try {
        setBusy('load')
        const [rulesets, tpl, pres] = await Promise.all([listRulesets(), ruleTemplates(lang), rulePresets(lang)])
        setList(rulesets.items)
        setTemplates(tpl.items)
        setPresets(pres.items)
      } catch (err) {
        setError(makeError(err))
      } finally {
        setBusy('')
      }
    })()
  }, [lang])

  async function select(id: string): Promise<void> {
    setError('')
    setNotice('')
    try {
      setBusy('load')
      setDraft(await getRuleset(id))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  function newRuleset(): void {
    setError('')
    setNotice('')
    setDraft({ id: '', name: t('ruleset.new.name'), description: '', rules: [], updated_at: '' })
  }

  function updateRule(index: number, rule: RuleSpec): void {
    if (!draft) return
    const rules = draft.rules.map((item, i) => (i === index ? rule : item))
    setDraft({ ...draft, rules })
  }

  function removeRule(index: number): void {
    if (!draft) return
    setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })
  }

  function addFromTemplate(): void {
    if (!draft || !templatePick) return
    const tpl = templates.find((item) => item.id === templatePick)
    if (!tpl) return
    const rule = { ...tpl, id: uniqueRuleId(tpl.id, draft.rules) }
    setDraft({ ...draft, rules: [...draft.rules, rule] })
    setTemplatePick('')
  }

  function addBlank(): void {
    if (!draft) return
    const rule = {
      ...BLANK_RULE,
      name: t('ruleset.blank.name'),
      category: t('ruleset.blank.category'),
      id: uniqueRuleId(BLANK_RULE.id, draft.rules)
    }
    setDraft({ ...draft, rules: [...draft.rules, rule] })
  }

  function addPreset(): void {
    if (!draft || !presetPick) return
    const preset = presets.find((item) => item.id === presetPick)
    if (!preset) return
    let rules = draft.rules
    for (const tpl of preset.rules) {
      rules = [...rules, { ...tpl, id: uniqueRuleId(tpl.id, rules) }]
    }
    setDraft({ ...draft, rules })
    setPresetPick('')
    setNotice(t('ruleset.notice.presetAdded', { name: preset.name, n: preset.rules.length }))
  }

  async function save(): Promise<void> {
    if (!draft) return
    setError('')
    setNotice('')
    try {
      setBusy('save')
      const saved = await saveRuleset({ id: draft.id || undefined, name: draft.name, description: draft.description, rules: draft.rules }, lang)
      setDraft(saved)
      await refresh()
      setNotice(t('ruleset.notice.saved', { name: saved.name, n: saved.rules.length }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function remove(): Promise<void> {
    if (!draft?.id) return
    setError('')
    setNotice('')
    try {
      setBusy('delete')
      await deleteRuleset(draft.id)
      setDraft(null)
      await refresh()
      setNotice(t('ruleset.notice.deleted'))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  async function check(): Promise<void> {
    if (!draft) return
    setError('')
    setNotice('')
    try {
      setBusy('validate')
      const result = await validateRules(draft.rules)
      setNotice(t('ruleset.notice.valid', { n: result.total }))
    } catch (err) {
      setError(t('ruleset.error.invalid', { msg: makeError(err) }))
    } finally {
      setBusy('')
    }
  }

  async function run(): Promise<void> {
    if (!draft?.id) {
      setError(t('ruleset.error.saveFirst'))
      return
    }
    if (!modelPath) {
      setError(t('ruleset.error.noModel'))
      return
    }
    setError('')
    setNotice('')
    try {
      setBusy('run')
      const report = await runRuleset(draft.id, modelPath, true, lang)
      onReport(report)
      setNotice(t('ruleset.notice.runDone', { run: report.summary.rules_run, failed: report.summary.rules_failed, total: report.summary.total }))
    } catch (err) {
      setError(makeError(err))
    } finally {
      setBusy('')
    }
  }

  const disabled = busy !== ''

  return (
    <div className="editor-overlay">
      <div className="editor-dialog">
        <header className="editor-top">
          <strong>{t('ruleset.title')}</strong>
          <span className="tagline">{t('ruleset.tagline')}</span>
          <button className="ghost tiny" onClick={onClose}>
            {t('ruleset.close')}
          </button>
        </header>

        {error && <div className="error-bar">{error}</div>}
        {notice && <div className="notice-bar">{notice}</div>}

        <div className="editor-body">
          <aside className="editor-list">
            <button onClick={newRuleset} disabled={disabled}>
              {t('ruleset.new')}
            </button>
            <ul>
              {list.map((item) => (
                <li
                  key={item.id}
                  className={`ruleset-item ${draft?.id === item.id ? 'active' : ''}`}
                  onClick={() => void select(item.id)}
                >
                  <span className="ruleset-name">{item.name}</span>
                  <span className="ruleset-count">{t('ruleset.count', { n: item.rules_count })}</span>
                </li>
              ))}
              {!list.length && <li className="hint small">{t('ruleset.empty')}</li>}
            </ul>
          </aside>

          <section className="editor-main">
            {draft ? (
              <>
                <div className="editor-fields">
                  <label>
                    {t('ruleset.field.name')}
                    <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </label>
                  <label>
                    {t('ruleset.field.desc')}
                    <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </label>
                </div>

                <div className="editor-tools">
                  <select value={presetPick} onChange={(e) => setPresetPick(e.target.value)}>
                    <option value="">{t('ruleset.preset.pick')}</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t('ruleset.preset.option', { name: p.name, n: p.rules.length })}
                      </option>
                    ))}
                  </select>
                  <button className="tiny ghost" onClick={addPreset} disabled={!presetPick || disabled}>
                    {t('ruleset.preset.add')}
                  </button>
                  <select value={templatePick} onChange={(e) => setTemplatePick(e.target.value)}>
                    <option value="">{t('ruleset.template.pick')}</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {t('ruleset.template.option', { name: tpl.name ?? '', category: tpl.category ?? '' })}
                      </option>
                    ))}
                  </select>
                  <button className="tiny ghost" onClick={addFromTemplate} disabled={!templatePick || disabled}>
                    {t('ruleset.template.add')}
                  </button>
                  <button className="tiny ghost" onClick={addBlank} disabled={disabled}>
                    {t('ruleset.rule.addBlank')}
                  </button>
                  <button className="tiny ghost" onClick={() => void check()} disabled={!draft.rules.length || disabled}>
                    {t('ruleset.validate')}
                  </button>
                  <button onClick={() => void save()} disabled={disabled}>
                    {busy === 'save' ? t('ruleset.saving') : t('ruleset.save')}
                  </button>
                  <button onClick={() => void run()} disabled={disabled}>
                    {busy === 'run' ? t('ruleset.running') : t('ruleset.run')}
                  </button>
                  <button className="tiny danger" onClick={() => void remove()} disabled={!draft.id || disabled}>
                    {t('ruleset.delete')}
                  </button>
                </div>

                <p className="hint small">{t('ruleset.ruleCount', { n: draft.rules.length })}</p>
                {draft.rules.map((rule, index) => (
                  <RuleEditor
                    key={`${rule.id}-${index}`}
                    rule={rule}
                    onChange={(next) => updateRule(index, next)}
                    onRemove={() => removeRule(index)}
                  />
                ))}
                {!draft.rules.length && <p className="hint">{t('ruleset.rules.empty')}</p>}
              </>
            ) : (
              <p className="hint">{t('ruleset.hint.select')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
