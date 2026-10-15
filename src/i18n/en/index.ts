// English dictionary: merged per-module dictionaries, flat dot-keys ("module.term").
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
