"""受控表达式（JS 风格语法子集）解析与求值。

不依赖任何 JS 引擎、不使用 eval：自建词法分析与递归下降求值，在受控上下文内
读取构件属性 / 工程量 / 已算列，可安全用于信息提取（ITO）的自定义计算列。

支持：数字 / 字符串 / true / false / null 字面量，算术（+ - * / % **）、
比较（== != < <= > >=）、逻辑（&& || !）与函数调用：
    attr(名称) prop(属性集, 属性) qty(工程量) val(已算列key)
    round(x, n) abs(x) min(...) max(...) if(条件, 真值, 假值)
    concat(...) len(x) upper(x) lower(x) trim(x) number(x) int(x) contains(a, b)
某值为空（null）时，算术结果为 null，比较为 false，便于在表格中安全留空。
"""

from __future__ import annotations

import re
from typing import Any

_TOKEN = re.compile(
    r"""\s*(?:
        (?P<num>\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)
      | (?P<str>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')
      | (?P<op>\*\*|&&|\|\||==|!=|<=|>=|[+\-*/%<>!(),])
      | (?P<name>[A-Za-z_][A-Za-z0-9_]*)
    )""",
    re.X,
)

_LITERALS = {"true": True, "false": False, "null": None, "undefined": None}

# 对外说明：可用函数与参数（供 /takeoff/columns 返回给前端展示）。
FUNCTIONS_DOC: list[dict[str, str]] = [
    {"name": "attr(名称)", "desc": "读取构件 IFC 属性，如 attr('Name')、attr('ObjectType')"},
    {"name": "prop(属性集, 属性)", "desc": "读取属性集条目，如 prop('Pset_WallCommon', 'IsExternal')"},
    {"name": "qty(工程量)", "desc": "读取工程量：volume / area / surface_area / length / width / height"},
    {"name": "val(列key)", "desc": "引用同列序中先计算的自定义列"},
    {"name": "round(x, n)", "desc": "四舍五入到 n 位小数"},
    {"name": "abs(x)", "desc": "绝对值"},
    {"name": "min(...) / max(...)", "desc": "多个数值取最小 / 最大"},
    {"name": "if(条件, 真值, 假值)", "desc": "条件取值"},
    {"name": "concat(...)", "desc": "拼接文本"},
    {"name": "len(x)", "desc": "文本长度"},
    {"name": "upper(x) / lower(x) / trim(x)", "desc": "大写 / 小写 / 去首尾空格"},
    {"name": "number(x) / int(x)", "desc": "转数值 / 取整"},
    {"name": "contains(a, b)", "desc": "a 中是否包含 b"},
]


class ExprError(ValueError):
    """表达式语法非法。"""


# ------------------------------- 词法分析 -------------------------------

def _tokenize(src: str) -> list[tuple[str, str]]:
    text = src.strip()
    if not text:
        raise ExprError("表达式为空")
    tokens: list[tuple[str, str]] = []
    pos = 0
    while pos < len(text):
        match = _TOKEN.match(text, pos)
        if match is None or match.end() == match.start():
            raise ExprError(f"无法识别的表达式片段：{text[pos:pos + 12]}")
        pos = match.end()
        tokens.append((match.lastgroup or "op", match.group().strip()))
    return tokens


# ------------------------------- 语法分析 -------------------------------

class _Parser:
    """递归下降解析器：产出元组形式的抽象语法树。"""

    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self._tokens = tokens
        self._i = 0

    def _peek(self) -> tuple[str, str] | None:
        return self._tokens[self._i] if self._i < len(self._tokens) else None

    def _take(self, value: str) -> bool:
        token = self._peek()
        if token and token[1] == value:
            self._i += 1
            return True
        return False

    def parse(self) -> Any:
        node = self._or()
        if self._i != len(self._tokens):
            raise ExprError(f"表达式末尾存在多余内容：{self._tokens[self._i][1]}")
        return node

    def _or(self) -> Any:
        node = self._and()
        while self._take("||"):
            node = ("bin", "||", node, self._and())
        return node

    def _and(self) -> Any:
        node = self._compare()
        while self._take("&&"):
            node = ("bin", "&&", node, self._compare())
        return node

    def _compare(self) -> Any:
        node = self._add()
        while True:
            token = self._peek()
            if token and token[1] in ("==", "!=", "<=", ">=", "<", ">"):
                self._i += 1
                node = ("bin", token[1], node, self._add())
            else:
                return node

    def _add(self) -> Any:
        node = self._mul()
        while True:
            token = self._peek()
            if token and token[1] in ("+", "-"):
                self._i += 1
                node = ("bin", token[1], node, self._mul())
            else:
                return node

    def _mul(self) -> Any:
        node = self._unary()
        while True:
            token = self._peek()
            if token and token[1] in ("*", "/", "%"):
                self._i += 1
                node = ("bin", token[1], node, self._unary())
            else:
                return node

    def _unary(self) -> Any:
        token = self._peek()
        if token and token[1] in ("-", "+", "!"):
            self._i += 1
            return ("un", token[1], self._unary())
        return self._power()

    def _power(self) -> Any:
        node = self._primary()
        if self._take("**"):
            return ("bin", "**", node, self._unary())
        return node

    def _primary(self) -> Any:
        token = self._peek()
        if token is None:
            raise ExprError("表达式意外结束")
        kind, value = token
        self._i += 1
        if kind == "num":
            return ("num", float(value) if any(c in value for c in ".eE") else int(value))
        if kind == "str":
            return ("str", _unquote(value))
        if kind == "name":
            if value in _LITERALS:
                return ("lit", _LITERALS[value])
            if self._take("("):
                args: list[Any] = []
                if not self._take(")"):
                    args.append(self._or())
                    while self._take(","):
                        args.append(self._or())
                    if not self._take(")"):
                        raise ExprError(f"函数 {value} 缺少右括号")
                return ("call", value, args)
            raise ExprError(f"未知标识符：{value}（自定义列须使用 attr/prop/qty/val 等函数）")
        raise ExprError(f"意外的记号：{value}")


def _unquote(raw: str) -> str:
    body = raw[1:-1]
    return body.replace('\\"', '"').replace("\\'", "'").replace("\\\\", "\\")


def check(src: str) -> None:
    """仅校验语法（用于定义解析阶段）。"""
    _Parser(_tokenize(src)).parse()


# ------------------------------- 求值 -------------------------------

def evaluate(src: str, env: dict[str, Any]) -> Any:
    """在给定上下文 env 中求值。env 含 element / quantities / values（已算列）。"""
    return _eval(_Parser(_tokenize(src)).parse(), env)


def _number(value: Any) -> float | int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _truthy(value: Any) -> bool:
    if isinstance(value, str):
        return value != ""
    return bool(value)


def _eval(node: Any, env: dict[str, Any]) -> Any:
    kind = node[0]
    if kind in ("num", "str", "lit"):
        return node[1]
    if kind == "un":
        return _eval_unary(node[1], _eval(node[2], env))
    if kind == "bin":
        return _eval_binary(node[1], _eval(node[2], env), _eval(node[3], env))
    if kind == "call":
        return _eval_call(node[1], [_eval(arg, env) for arg in node[2]], env)
    raise ExprError(f"未知的表达式节点：{kind}")


def _eval_unary(op: str, value: Any) -> Any:
    if op == "!":
        return not _truthy(value)
    number = _number(value)
    if number is None:
        return None
    return -number if op == "-" else number


def _eval_binary(op: str, left: Any, right: Any) -> Any:
    if op == "&&":
        return right if _truthy(left) else left
    if op == "||":
        return left if _truthy(left) else right
    if op in ("==", "!="):
        result = _loose_equal(left, right)
        return result if op == "==" else not result
    if op in ("<", "<=", ">", ">="):
        return _order(op, left, right)
    if op == "+" and isinstance(left, str) and isinstance(right, str):
        return left + right

    a, b = _number(left), _number(right)
    if a is None or b is None:
        return None
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return None if b == 0 else a / b
    if op == "%":
        return None if b == 0 else a % b
    if op == "**":
        return a ** b
    return None


def _loose_equal(left: Any, right: Any) -> bool:
    a, b = _number(left), _number(right)
    if a is not None and b is not None:
        return a == b
    return left == right


def _order(op: str, left: Any, right: Any) -> bool:
    a, b = _number(left), _number(right)
    if a is None or b is None:
        if isinstance(left, str) and isinstance(right, str):
            a, b = left, right
        else:
            return False
    if op == "<":
        return a < b
    if op == "<=":
        return a <= b
    if op == ">":
        return a > b
    return a >= b


def _eval_call(name: str, args: list[Any], env: dict[str, Any]) -> Any:
    if name == "attr":
        element = env.get("element")
        return getattr(element, _text(args, 0), None) if element is not None else None
    if name == "prop":
        return _prop(env, _text(args, 0), _text(args, 1))
    if name == "qty":
        return (env.get("quantities") or {}).get(_text(args, 0))
    if name == "val":
        return (env.get("values") or {}).get(_text(args, 0))
    if name == "round":
        value = _number(args[0]) if args else None
        digits = int(_number(args[1]) or 0) if len(args) > 1 else 0
        return None if value is None else round(value, digits)
    if name == "abs":
        value = _number(args[0]) if args else None
        return None if value is None else abs(value)
    if name in ("min", "max"):
        numbers = [n for n in (_number(item) for item in args) if n is not None]
        if not numbers:
            return None
        return min(numbers) if name == "min" else max(numbers)
    if name == "if":
        if len(args) != 3:
            raise ExprError("if 需要 3 个参数：if(条件, 真值, 假值)")
        return args[1] if _truthy(args[0]) else args[2]
    if name == "concat":
        return "".join("" if item is None else str(item) for item in args)
    if name == "len":
        value = args[0] if args else None
        return None if value is None else len(str(value))
    if name in ("upper", "lower", "trim"):
        value = args[0] if args else None
        if value is None:
            return None
        text = str(value)
        return text.upper() if name == "upper" else text.lower() if name == "lower" else text.strip()
    if name == "number":
        return _number(args[0]) if args else None
    if name == "int":
        value = _number(args[0]) if args else None
        return None if value is None else int(value)
    if name == "contains":
        if len(args) != 2 or args[0] is None or args[1] is None:
            return False
        return str(args[1]) in str(args[0])
    raise ExprError(f"未知函数：{name}")


def _prop(env: dict[str, Any], pset: str, prop: str) -> Any:
    getter = env.get("get_psets")
    psets = getter() if callable(getter) else {}
    group = psets.get(pset)
    if not isinstance(group, dict):
        return None
    value = group.get(prop)
    return value if value is not None else None


def _text(args: list[Any], index: int) -> str:
    if index >= len(args) or args[index] is None:
        raise ExprError("attr/prop/qty/val 需要字符串参数")
    return str(args[index])
