// 中文词典汇总：按模块合并，键名统一「模块.语义」点号风格。
import app from './app'
import clash from './clash'
import comm from './comm'
import ids from './ids'
import report from './report'
import ruleset from './ruleset'
import takeoff from './takeoff'
import tree from './tree'
import views from './views'

const dict: Record<string, string> = {
  ...app,
  ...tree,
  ...ruleset,
  ...clash,
  ...ids,
  ...takeoff,
  ...comm,
  ...report,
  ...views,
}

export default dict
