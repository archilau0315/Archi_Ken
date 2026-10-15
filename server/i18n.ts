// L3 错误文案双语：与内核 app/i18n.py 的 pick_lang 语义一致。
// 只用于会直接展示给用户的校验/业务错误；参数级调试错误保持单一文案。

export type Lang = 'zh' | 'en'

/** 按语言选文案：lang 为 en 时取英文，否则中文。 */
export function tr(lang: Lang | undefined | null, zh: string, en: string): string {
  return lang === 'en' ? en : zh
}

/** 从请求体中解析语言偏好（只认 en，其余按 zh 处理）。 */
export function langOf(body: unknown): Lang | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return (body as Record<string, unknown>).lang === 'en' ? 'en' : undefined
  }
  return undefined
}
