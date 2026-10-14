//! Experimental compatible core. No JavaScript execution, network, or host callbacks.
use serde_json::{Value as Json, json};
use std::{
    cell::RefCell,
    collections::{BTreeMap, HashMap, VecDeque},
    rc::Rc,
};
pub type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Debug)]
pub enum Value {
    Undefined,
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Rc<RefCell<Vec<Value>>>),
    Object(Rc<RefCell<BTreeMap<String, Value>>>),
}
impl Value {
    pub fn array(v: Vec<Value>) -> Self {
        Self::Array(Rc::new(RefCell::new(v)))
    }
    pub fn object(v: BTreeMap<String, Value>) -> Self {
        Self::Object(Rc::new(RefCell::new(v)))
    }
    pub fn from_json(v: &Json) -> Self {
        match v {
            Json::Null => Self::Null,
            Json::Bool(v) => Self::Bool(*v),
            Json::Number(v) => Self::Number(v.as_f64().unwrap()),
            Json::String(v) => Self::String(v.clone()),
            Json::Array(v) => Self::array(v.iter().map(Self::from_json).collect()),
            Json::Object(v) => Self::object(
                v.iter()
                    .map(|(k, v)| (k.clone(), Self::from_json(v)))
                    .collect(),
            ),
        }
    }
    pub fn truthy(&self) -> bool {
        match self {
            Self::Undefined | Self::Null => false,
            Self::Bool(v) => *v,
            Self::Number(v) => *v != 0.0 && !v.is_nan(),
            Self::String(v) => !v.is_empty(),
            _ => true,
        }
    }
    pub fn number(&self) -> Result<f64> {
        if let Self::Number(v) = self {
            Ok(*v)
        } else {
            Err("Expected number".into())
        }
    }
    pub fn string(&self) -> Result<String> {
        if let Self::String(v) = self {
            Ok(v.clone())
        } else {
            Err("Expected string".into())
        }
    }
    pub fn items(&self) -> Result<Vec<Value>> {
        if let Self::Array(v) = self {
            Ok(v.borrow().clone())
        } else {
            Err("Expected array".into())
        }
    }
    pub fn same(&self, b: &Self) -> bool {
        match (self, b) {
            (Self::Undefined, Self::Undefined) | (Self::Null, Self::Null) => true,
            (Self::Bool(a), Self::Bool(b)) => a == b,
            (Self::Number(a), Self::Number(b)) => a == b,
            (Self::String(a), Self::String(b)) => a == b,
            (Self::Array(a), Self::Array(b)) => Rc::ptr_eq(a, b),
            (Self::Object(a), Self::Object(b)) => Rc::ptr_eq(a, b),
            _ => false,
        }
    }
    fn primitive_number(&self) -> Result<f64> {
        Ok(match self {
            Self::Null => 0.0,
            Self::Undefined => f64::NAN,
            Self::Bool(v) => {
                if *v {
                    1.0
                } else {
                    0.0
                }
            }
            Self::Number(v) => *v,
            Self::String(v) => {
                if v.trim().is_empty() {
                    0.0
                } else {
                    v.trim().parse().unwrap_or(f64::NAN)
                }
            }
            _ => return Err("Object relational coercion is unsupported".into()),
        })
    }
    pub fn wire(&self) -> Result<Json> {
        self.encode(0, &mut Vec::new(), true, &mut 0)
    }
    pub fn legacy(&self) -> Result<Json> {
        self.encode(0, &mut Vec::new(), false, &mut 0)
    }
    fn encode(
        &self,
        depth: usize,
        active: &mut Vec<usize>,
        tagged: bool,
        bytes: &mut usize,
    ) -> Result<Json> {
        *bytes = bytes.saturating_add(
            48 + match self {
                Self::String(s) => s.len().saturating_mul(6),
                _ => 0,
            },
        );
        if *bytes > 8 * 1024 * 1024 - 1024 {
            return Err("Serialized value exceeds 8MiB response budget".into());
        }
        if depth > 40 {
            return Err("Value nesting exceeds 40".into());
        }
        let scalar = match self {
            Self::Undefined => Some(if tagged {
                json!(["undefined"])
            } else {
                Json::Null
            }),
            Self::Null => Some(if tagged { json!(["null"]) } else { Json::Null }),
            Self::Bool(v) => Some(if tagged {
                json!(["boolean", v])
            } else {
                json!(v)
            }),
            Self::Number(v) => Some(if tagged {
                json!([
                    "number",
                    if v.is_nan() {
                        json!("NaN")
                    } else if *v == f64::INFINITY {
                        json!("Infinity")
                    } else if *v == f64::NEG_INFINITY {
                        json!("-Infinity")
                    } else if *v == 0.0 && v.is_sign_negative() {
                        json!("-0")
                    } else {
                        json!(v)
                    }
                ])
            } else {
                json!(v)
            }),
            Self::String(v) => Some(if tagged {
                json!(["string", v])
            } else {
                json!(v)
            }),
            _ => None,
        };
        if let Some(v) = scalar {
            return Ok(v);
        }
        let id = match self {
            Self::Array(v) => Rc::as_ptr(v) as usize,
            Self::Object(v) => Rc::as_ptr(v) as usize,
            _ => unreachable!(),
        };
        if active.contains(&id) {
            return Err("Cyclic values cannot cross the wire".into());
        }
        active.push(id);
        let result = match self {
            Self::Array(v) => {
                let list = v
                    .borrow()
                    .iter()
                    .map(|v| v.encode(depth + 1, active, tagged, bytes))
                    .collect::<Result<Vec<_>>>()?;
                if tagged {
                    json!(["array", list])
                } else {
                    json!(list)
                }
            }
            Self::Object(v) => {
                if tagged {
                    let list = v
                        .borrow()
                        .iter()
                        .map(|(k, v)| {
                            *bytes = bytes.saturating_add(k.len().saturating_mul(6));
                            Ok(json!([k, v.encode(depth + 1, active, true, bytes)?]))
                        })
                        .collect::<Result<Vec<_>>>()?;
                    json!(["object", list])
                } else {
                    let mut out = serde_json::Map::new();
                    for (k, v) in v.borrow().iter() {
                        *bytes = bytes.saturating_add(k.len().saturating_mul(6));
                        if !matches!(v, Self::Undefined) {
                            out.insert(k.clone(), v.encode(depth + 1, active, false, bytes)?);
                        }
                    }
                    Json::Object(out)
                }
            }
            _ => unreachable!(),
        };
        active.pop();
        Ok(result)
    }
    pub fn from_wire(v: &Json) -> Result<Self> {
        Self::decode(v, 0)
    }
    fn decode(v: &Json, depth: usize) -> Result<Self> {
        if depth > 40 {
            return Err("Wire nesting exceeds 40".into());
        }
        let a = v.as_array().ok_or("Wire value must be tagged tuple")?;
        let tag = a.first().and_then(Json::as_str).ok_or("Missing wire tag")?;
        let one = || -> Result<&Json> {
            if a.len() != 2 {
                return Err("Invalid wire tuple length".into());
            }
            Ok(&a[1])
        };
        Ok(match tag {
            "undefined" if a.len() == 1 => Self::Undefined,
            "null" if a.len() == 1 => Self::Null,
            "boolean" => Self::Bool(one()?.as_bool().ok_or("Invalid boolean")?),
            "string" => Self::String(one()?.as_str().ok_or("Invalid string")?.into()),
            "number" => {
                let v = one()?;
                Self::Number(if let Some(n) = v.as_f64() {
                    n
                } else {
                    match v.as_str() {
                        Some("NaN") => f64::NAN,
                        Some("Infinity") => f64::INFINITY,
                        Some("-Infinity") => f64::NEG_INFINITY,
                        Some("-0") => -0.0,
                        _ => return Err("Invalid number".into()),
                    }
                })
            }
            "array" => Self::array(
                one()?
                    .as_array()
                    .ok_or("Invalid array")?
                    .iter()
                    .map(|v| Self::decode(v, depth + 1))
                    .collect::<Result<_>>()?,
            ),
            "object" => {
                let mut out = BTreeMap::new();
                for entry in one()?.as_array().ok_or("Invalid object")? {
                    let pair = entry
                        .as_array()
                        .filter(|a| a.len() == 2)
                        .ok_or("Invalid object pair")?;
                    let key = pair[0].as_str().ok_or("Invalid object key")?;
                    if out
                        .insert(key.into(), Self::decode(&pair[1], depth + 1)?)
                        .is_some()
                    {
                        return Err("Duplicate object key".into());
                    }
                }
                Self::object(out)
            }
            _ => return Err("Unknown wire tag".into()),
        })
    }
}
fn unsafe_key(k: &str) -> bool {
    matches!(k, "__proto__" | "prototype" | "constructor")
}
fn path(s: &str) -> Result<Vec<String>> {
    if s.is_empty() {
        return Err("Empty path".into());
    }
    let c: Vec<char> = s.chars().collect();
    let (mut i, mut parts) = (0, Vec::new());
    while i < c.len() {
        if c[i] == '.' {
            if i == 0 || c.get(i + 1).is_none_or(|c| *c == '.' || *c == '[') {
                return Err("Empty path segment is unsupported".into());
            }
            i += 1;
            if i == c.len() {
                return Err("Invalid path".into());
            }
            continue;
        }
        if c[i] == '[' {
            i += 1;
            if i >= c.len() {
                return Err("Invalid bracket path".into());
            }
            let p;
            if c[i] == '"' || c[i] == '\'' {
                let q = c[i];
                i += 1;
                let mut out = String::new();
                while i < c.len() && c[i] != q {
                    if c[i] == '\\' {
                        i += 1;
                        if i >= c.len() {
                            return Err("Invalid path escape".into());
                        }
                    }
                    out.push(c[i]);
                    i += 1
                }
                if i >= c.len() {
                    return Err("Invalid quoted path".into());
                }
                i += 1;
                p = out
            } else {
                let start = i;
                while i < c.len() && c[i].is_ascii_digit() {
                    i += 1
                }
                if start == i {
                    return Err("Only literal bracket paths supported".into());
                }
                p = c[start..i].iter().collect()
            }
            if c.get(i) != Some(&']') {
                return Err("Invalid bracket path".into());
            }
            i += 1;
            parts.push(p)
        } else {
            let start = i;
            while i < c.len() && (c[i].is_ascii_alphanumeric() || "_$".contains(c[i])) {
                i += 1
            }
            if start == i {
                return Err("Invalid path character".into());
            }
            parts.push(c[start..i].iter().collect())
        }
    }
    if parts.iter().any(|p| unsafe_key(p)) {
        return Err("Unsafe path".into());
    }
    Ok(parts)
}
fn property(v: &Value, key: &str) -> Value {
    match v {
        Value::Object(o) => o.borrow().get(key).cloned().unwrap_or(Value::Undefined),
        Value::Array(a) => {
            if key == "length" {
                Value::Number(a.borrow().len() as f64)
            } else {
                if key.len() > 1 && key.starts_with('0') {
                    return Value::Undefined;
                }
                key.parse::<usize>()
                    .ok()
                    .and_then(|i| a.borrow().get(i).cloned())
                    .unwrap_or(Value::Undefined)
            }
        }
        Value::String(s) => {
            if key == "length" {
                Value::Number(s.encode_utf16().count() as f64)
            } else if s.is_ascii() {
                key.parse::<usize>()
                    .ok()
                    .filter(|_| key == "0" || !key.starts_with('0'))
                    .and_then(|i| s.as_bytes().get(i))
                    .map(|v| Value::String((*v as char).to_string()))
                    .unwrap_or(Value::Undefined)
            } else {
                Value::Undefined
            }
        }
        _ => Value::Undefined,
    }
}
fn get(input: &Value, p: &str) -> Result<Value> {
    let keys = path(p)?;
    if let Value::Object(o) = input {
        if let Some(v) = o.borrow().get(p) {
            return Ok(v.clone());
        }
    }
    let mut v = input.clone();
    for key in keys {
        if matches!(&v,Value::String(s)if !s.is_ascii()) && key.parse::<usize>().is_ok() {
            return Err("Non-ASCII string index reads are unsupported".into());
        }
        v = property(&v, &key)
    }
    Ok(v)
}
fn contains_reference(
    value: &Value,
    target: &Value,
    active: &mut Vec<usize>,
    depth: usize,
) -> bool {
    if depth > 100 {
        return true;
    }
    if value.same(target) {
        return true;
    }
    match value {
        Value::Array(v) => {
            let id = Rc::as_ptr(v) as usize;
            if active.contains(&id) {
                return true;
            }
            active.push(id);
            let found = v
                .borrow()
                .iter()
                .any(|v| contains_reference(v, target, active, depth + 1));
            active.pop();
            found
        }
        Value::Object(v) => {
            let id = Rc::as_ptr(v) as usize;
            if active.contains(&id) {
                return true;
            }
            active.push(id);
            let found = v
                .borrow()
                .values()
                .any(|v| contains_reference(v, target, active, depth + 1));
            active.pop();
            found
        }
        _ => false,
    }
}
fn write(target: &Value, key: &str, value: Value) -> Result<()> {
    if matches!(value, Value::Array(_) | Value::Object(_))
        && contains_reference(&value, target, &mut Vec::new(), 0)
    {
        return Err("Cyclic writes are unsupported".into());
    }
    if unsafe_key(key) {
        return Err("Unsafe write".into());
    }
    match target {
        Value::Object(o) => {
            o.borrow_mut().insert(key.into(), value);
            Ok(())
        }
        Value::Array(a) => {
            let mut a = a.borrow_mut();
            if key == "length" {
                let n = value.number()?;
                if n < 0.0 || n.fract() != 0.0 || n > 100_000.0 {
                    return Err("Invalid array length".into());
                }
                if n as usize > a.len() {
                    return Err("Sparse array length growth is unsupported".into());
                }
                a.resize(n as usize, Value::Undefined);
                return Ok(());
            }
            if key.len() > 1 && key.starts_with('0') {
                return Err("Named array properties are unsupported".into());
            }
            let i = key
                .parse::<usize>()
                .map_err(|_| "Only array index writes supported")?;
            if i > 100_000 {
                return Err("Array index exceeds limit".into());
            }
            if i > a.len() {
                return Err("Sparse array writes are unsupported".into());
            }
            if i == a.len() {
                a.push(Value::Undefined);
            }
            a[i] = value;
            Ok(())
        }
        _ => Err("Write target is not object".into()),
    }
}
fn set(input: &Value, p: &str, value: Value) -> Result<()> {
    let mut keys = path(p)?;
    if let Value::Object(o) = input {
        if o.borrow().contains_key(p) {
            keys = vec![p.into()]
        }
    }
    let mut target = input.clone();
    for i in 0..keys.len() - 1 {
        let mut child = property(&target, &keys[i]);
        if !matches!(child, Value::Array(_) | Value::Object(_)) {
            child = if keys[i + 1].parse::<usize>().is_ok() {
                Value::array(vec![])
            } else {
                Value::object(BTreeMap::new())
            };
            write(&target, &keys[i], child.clone())?
        }
        target = child;
    }
    write(&target, keys.last().unwrap(), value)
}
#[derive(Clone, Debug)]
enum Expr {
    Literal(Value),
    Path(String),
    Array(Vec<Expr>),
    Unary(String, Box<Expr>),
    Binary(String, Box<Expr>, Box<Expr>),
    Call(String, Vec<Expr>),
}
#[derive(Clone, Debug)]
enum Rule {
    Expression(Statement),
    Sequence(Vec<Rule>),
    If(Condition, Box<Rule>, Option<Box<Rule>>),
    Logical(Condition),
    Return(Expr),
    Array(String, String, Box<Rule>, Option<String>),
    Try(Box<Rule>, Box<Rule>),
}
#[derive(Clone, Debug)]
struct Statement {
    lhs: Option<(String, String)>,
    expr: Expr,
}
#[derive(Clone, Debug)]
enum Condition {
    Expression(Statement),
    And(Vec<Condition>),
    Or(Vec<Condition>),
}
fn tokenize(s: &str) -> Result<Vec<String>> {
    if s.len() > 100_000 {
        return Err("Expression exceeds 100000 bytes".into());
    }
    let c: Vec<char> = s.chars().collect();
    let (mut i, mut out, mut depth) = (0, vec![], 0usize);
    while i < c.len() {
        if c[i].is_whitespace() {
            i += 1;
            continue;
        }
        let start = i;
        let ch = c[i];
        if ch == '"' {
            i += 1;
            let mut closed = false;
            while i < c.len() {
                if c[i] == '\\' {
                    i += 2;
                    continue;
                }
                if c[i] == '"' {
                    i += 1;
                    closed = true;
                    break;
                }
                i += 1
            }
            if !closed {
                return Err("Unterminated string".into());
            }
        } else if ch.is_ascii_alphabetic() || "_$".contains(ch) {
            i += 1;
            while i < c.len() && (c[i].is_ascii_alphanumeric() || "_$.".contains(c[i])) {
                i += 1
            }
            while c.get(i) == Some(&'[') {
                let bracket = i;
                i += 1;
                if c.get(i) == Some(&'"') || c.get(i) == Some(&'\'') {
                    let q = c[i];
                    i += 1;
                    while i < c.len() && c[i] != q {
                        if c[i] == '\\' {
                            i += 1
                        }
                        i += 1
                    }
                    i += 1
                } else {
                    while i < c.len() && c[i].is_ascii_digit() {
                        i += 1
                    }
                }
                if c.get(i) != Some(&']') {
                    return Err(format!("Invalid bracket path at {bracket}"));
                }
                i += 1;
                while i < c.len() && (c[i].is_ascii_alphanumeric() || "_$.".contains(c[i])) {
                    i += 1
                }
            }
        } else if ch.is_ascii_digit() || ch == '.' {
            i += 1;
            while i < c.len() && (c[i].is_ascii_digit() || c[i] == '.') {
                i += 1
            }
            if c.get(i).is_some_and(|c| *c == 'e' || *c == 'E') {
                i += 1;
                if c.get(i).is_some_and(|c| *c == '+' || *c == '-') {
                    i += 1
                }
                while i < c.len() && c[i].is_ascii_digit() {
                    i += 1
                }
            }
        } else if "()+-*/%<>=!^[],?~".contains(ch) {
            i += 1;
            if ch == '?' && c.get(i) == Some(&'?') && c.get(i + 1) == Some(&'=') {
                i += 2
            } else if c.get(i) == Some(&'=') && "+-*/<>=!~".contains(ch) {
                i += 1
            } else if ch == '<' && c.get(i) == Some(&'>') {
                i += 1
            }
            if ch == '(' || ch == '[' {
                depth += 1;
                if depth > 100 {
                    return Err("Expression nesting exceeds 100".into());
                }
            } else if ch == ')' || ch == ']' {
                depth = depth.saturating_sub(1)
            }
        } else {
            return Err(format!("Unsupported character {ch}"));
        }
        out.push(c[start..i.min(c.len())].iter().collect())
    }
    if out.len() > 4096 {
        return Err("Expression exceeds 4096 tokens".into());
    }
    Ok(out)
}
fn precedence(op: &str) -> Option<u8> {
    Some(match op {
        "AND" | "OR" => 1,
        "==" | "!=" | "<>" | "~=" => 2,
        "<" | ">" | "<=" | ">=" => 3,
        "+" | "-" => 4,
        "*" | "/" | "%" | "MOD" => 5,
        "^" => 6,
        _ => return None,
    })
}
fn arity(name: &str) -> Option<usize> {
    Some(match name {
        "ABS" | "NEG" | "NOT" | "FLOOR" | "CEIL" | "ROUND" | "SQRT" | "ISNAN" | "LENGTH"
        | "MIN" | "MAX" | "SORT" | "REVERSE" | "HEAD" | "TAIL" | "LAST" | "COUNT_KEYS" => 1,
        "ADD" | "SUB" | "MUL" | "DIV" | "MOD" | "RANGE" | "INDEX" | "TAKE" | "DROP" | "CONCAT"
        | "CONS" | "CONTAINS" | "INCLUDES" | "REMOVE_VALUES" | "STRING_CONTAINS"
        | "STRING_STARTS_WITH" | "STRING_ENDS_WITH" => 2,
        "SLICE" => 3,
        _ => return None,
    })
}
struct Parser {
    t: Vec<String>,
    i: usize,
}
impl Parser {
    fn parse(&mut self, min: u8, depth: usize) -> Result<Expr> {
        if depth > 100 {
            return Err("Expression AST nesting exceeds 100".into());
        }
        let token = self.t.get(self.i).ok_or("Expected expression")?.clone();
        self.i += 1;
        let upper = token.to_ascii_uppercase();
        let mut left = if token == "(" {
            let e = self.parse(1, depth + 1)?;
            self.expect(")")?;
            e
        } else if token == "[" {
            let a = self.arguments("]", depth + 1)?;
            Expr::Array(a)
        } else if token == "-" || token == "!" {
            Expr::Unary(token.clone(), Box::new(self.parse(7, depth + 1)?))
        } else if token.starts_with('"') {
            // expressionparser escapes the next character verbatim (not JSON escapes).
            let chars: Vec<char> = token.chars().collect();
            let mut value = String::new();
            let mut i = 1;
            while i + 1 < chars.len() {
                if chars[i] == '\\' {
                    i += 1;
                }
                if i + 1 >= chars.len() {
                    return Err("Invalid string escape".into());
                }
                value.push(chars[i]);
                i += 1;
            }
            Expr::Literal(Value::String(value))
        } else if token.as_bytes().first().is_some_and(|c| c.is_ascii_digit())
            || token.starts_with('.')
        {
            Expr::Literal(Value::Number(
                token.parse().map_err(|_| "Invalid numeric literal")?,
            ))
        } else if self.t.get(self.i).is_some_and(|t| t == "(") {
            let n = arity(&upper).ok_or_else(|| format!("Unsupported function {token}"))?;
            self.i += 1;
            let args = self.arguments(")", depth + 1)?;
            if args.len() != n {
                return Err(format!("{token} expects {n} arguments"));
            }
            Expr::Call(upper, args)
        } else {
            match upper.as_str() {
                "TRUE" => Expr::Literal(Value::Bool(true)),
                "FALSE" => Expr::Literal(Value::Bool(false)),
                "NULL" => Expr::Literal(Value::Null),
                "EMPTY" => Expr::Array(vec![]),
                "EMPTYDICT" => Expr::Literal(Value::object(BTreeMap::new())),
                "INFINITY" => Expr::Literal(Value::Number(f64::INFINITY)),
                "EPSILON" => Expr::Literal(Value::Number(f64::EPSILON)),
                "PI" => Expr::Literal(Value::Number(std::f64::consts::PI)),
                "E" => Expr::Literal(Value::Number(std::f64::consts::E)),
                "LN2" => Expr::Literal(Value::Number(std::f64::consts::LN_2)),
                "LN10" => Expr::Literal(Value::Number(std::f64::consts::LN_10)),
                "LOG2E" => Expr::Literal(Value::Number(std::f64::consts::LOG2_E)),
                "LOG10E" => Expr::Literal(Value::Number(std::f64::consts::LOG10_E)),
                "SQRTHALF" => Expr::Literal(Value::Number(std::f64::consts::FRAC_1_SQRT_2)),
                "SQRT2" => Expr::Literal(Value::Number(std::f64::consts::SQRT_2)),
                _ => {
                    if arity(&upper).is_some() {
                        return Err(
                            "Functions require parenthesized arguments in this subset".into()
                        );
                    }
                    path(&token)?;
                    if token.contains('[') {
                        return Err("Bracket reads in expressions are unsupported; use dotted paths or INDEX".into());
                    }
                    Expr::Path(token)
                }
            }
        };
        while let Some(op) = self.t.get(self.i).map(|s| s.to_ascii_uppercase()) {
            let Some(p) = precedence(&op) else { break };
            if p < min {
                break;
            }
            self.i += 1;
            let right = self.parse(p + 1, depth + 1)?;
            left = Expr::Binary(op, Box::new(left), Box::new(right));
        }
        Ok(left)
    }
    fn expect(&mut self, s: &str) -> Result<()> {
        if self.t.get(self.i).map(String::as_str) != Some(s) {
            return Err(format!("Expected {s}"));
        }
        self.i += 1;
        Ok(())
    }
    fn arguments(&mut self, end: &str, depth: usize) -> Result<Vec<Expr>> {
        let mut out = vec![];
        if self.t.get(self.i).map(String::as_str) == Some(end) {
            self.i += 1;
            return Ok(out);
        }
        loop {
            out.push(self.parse(1, depth)?);
            if self.t.get(self.i).map(String::as_str) == Some(end) {
                self.i += 1;
                break;
            }
            self.expect(",")?;
        }
        Ok(out)
    }
}
fn expr_tokens(t: Vec<String>) -> Result<Expr> {
    let mut p = Parser { t, i: 0 };
    let e = p.parse(1, 0)?;
    if p.i != p.t.len() {
        return Err("Unused expression terms or unsupported syntax".into());
    }
    Ok(e)
}
fn expression(s: &str) -> Result<Expr> {
    expr_tokens(tokenize(s)?)
}
fn statement(s: &str) -> Result<Statement> {
    let s = s.trim().strip_prefix("return ").unwrap_or(s);
    let t = tokenize(s)?;
    if let Some(i) = t
        .iter()
        .position(|s| matches!(s.as_str(), "=" | "+=" | "-=" | "*=" | "/=" | "??="))
    {
        if i != 1
            || t.iter()
                .skip(i + 1)
                .any(|s| matches!(s.as_str(), "=" | "+=" | "-=" | "*=" | "/=" | "??="))
        {
            return Err("Assignment must be a single top-level path".into());
        }
        path(&t[0])?;
        Ok(Statement {
            lhs: Some((t[0].clone(), t[1].clone())),
            expr: expr_tokens(t[2..].to_vec())?,
        })
    } else {
        Ok(Statement {
            lhs: None,
            expr: expr_tokens(t)?,
        })
    }
}
#[derive(Clone, Debug)]
pub struct Program {
    rules: Vec<Rule>,
}
fn condition(v: &Json, depth: usize, nodes: &mut usize) -> Result<Condition> {
    *nodes += 1;
    if depth > 100 || *nodes > 10_000 {
        return Err("Program resource limit".into());
    }
    if let Some(s) = v.as_str() {
        return Ok(Condition::Expression(statement(s)?));
    }
    let o = v
        .as_object()
        .ok_or("Condition must be string or logical object")?;
    if o.len() != 1 {
        return Err("Logical object needs exactly one key".into());
    }
    if let Some(a) = o.get("and") {
        Ok(Condition::And(
            a.as_array()
                .ok_or("and requires array")?
                .iter()
                .map(|v| condition(v, depth + 1, nodes))
                .collect::<Result<_>>()?,
        ))
    } else if let Some(a) = o.get("or") {
        Ok(Condition::Or(
            a.as_array()
                .ok_or("or requires array")?
                .iter()
                .map(|v| condition(v, depth + 1, nodes))
                .collect::<Result<_>>()?,
        ))
    } else {
        Err("Unsupported condition".into())
    }
}
fn compile_rule(v: &Json, depth: usize, nodes: &mut usize) -> Result<Rule> {
    *nodes += 1;
    if depth > 100 || *nodes > 10_000 {
        return Err("Program resource limit".into());
    }
    match v {
        Json::String(s) => Ok(Rule::Expression(statement(s)?)),
        Json::Array(a) => Ok(Rule::Sequence(
            a.iter()
                .map(|v| compile_rule(v, depth + 1, nodes))
                .collect::<Result<_>>()?,
        )),
        Json::Object(o) => {
            let known = [
                "if", "and", "or", "return", "map", "filter", "every", "some", "find", "try",
            ];
            let present: Vec<_> = known.iter().filter(|k| o.contains_key(**k)).collect();
            if present.len() != 1 {
                return Err("Ambiguous or unsupported rule shape".into());
            }
            let kind = **present.first().unwrap();
            let allowed: Vec<&str> = match kind {
                "if" => vec!["if", "then", "else"],
                "and" => vec!["and"],
                "or" => vec!["or"],
                "return" => vec!["return"],
                "try" => vec!["try", "catch"],
                _ => vec![kind, "run", "set"],
            };
            if o.keys().any(|k| !allowed.contains(&k.as_str())) {
                return Err("Unknown rule field".into());
            }
            match kind {
                "if" => Ok(Rule::If(
                    condition(&o["if"], depth + 1, nodes)?,
                    Box::new(compile_rule(
                        o.get("then").ok_or("Missing then")?,
                        depth + 1,
                        nodes,
                    )?),
                    o.get("else")
                        .map(|v| compile_rule(v, depth + 1, nodes).map(Box::new))
                        .transpose()?,
                )),
                "and" | "or" => Ok(Rule::Logical(condition(v, depth + 1, nodes)?)),
                "return" => Ok(Rule::Return(expression(
                    o["return"]
                        .as_str()
                        .ok_or("Return requires expression string")?,
                )?)),
                "try" => Ok(Rule::Try(
                    Box::new(compile_rule(&o["try"], depth + 1, nodes)?),
                    Box::new(compile_rule(
                        o.get("catch").ok_or("Missing catch")?,
                        depth + 1,
                        nodes,
                    )?),
                )),
                _ => {
                    let p = o[kind].as_str().ok_or("Array path requires string")?;
                    path(p)?;
                    let dest = o
                        .get("set")
                        .map(|v| {
                            v.as_str()
                                .ok_or_else(|| "set requires path string".to_string())
                                .and_then(|p| {
                                    path(p)?;
                                    Ok(p.to_string())
                                })
                        })
                        .transpose()?;
                    Ok(Rule::Array(
                        kind.into(),
                        p.into(),
                        Box::new(compile_rule(
                            o.get("run").ok_or("Missing run")?,
                            depth + 1,
                            nodes,
                        )?),
                        dest,
                    ))
                }
            }
        }
        _ => Err("Invalid rule type".into()),
    }
}
impl Program {
    pub fn compile(v: &Json) -> Result<Self> {
        let mut nodes = 0;
        let rules = if let Some(a) = v.as_array() {
            a.iter()
                .map(|v| compile_rule(v, 0, &mut nodes))
                .collect::<Result<_>>()?
        } else {
            vec![compile_rule(v, 0, &mut nodes)?]
        };
        Ok(Self { rules })
    }
    pub fn execute(&self, input: Value, ignore_missing: bool) -> Result<(Value, Value)> {
        validate_input(&input)?;
        let mut ctx = Context {
            input: input.clone(),
            last: input.clone(),
            ignore_missing,
            steps: 0,
        };
        for r in &self.rules {
            if ctx.run(r)? {
                break;
            }
        }
        Ok((ctx.last, input))
    }
}
fn validate_input(v: &Value) -> Result<()> {
    let Value::Object(o) = v else {
        return Err("Input must be object".into());
    };
    for k in o.borrow().keys() {
        if unsafe_key(k)
            || matches!(
                k.as_str(),
                "toString"
                    | "valueOf"
                    | "hasOwnProperty"
                    | "isPrototypeOf"
                    | "propertyIsEnumerable"
                    | "$item"
                    | "$index"
                    | "$array"
            )
        {
            return Err("Unsafe or reserved input key".into());
        }
    }
    Ok(())
}
struct Context {
    input: Value,
    last: Value,
    ignore_missing: bool,
    steps: usize,
}
impl Context {
    fn eval(&mut self, e: &Expr) -> Result<Value> {
        self.steps += 1;
        if self.steps > 1_000_000 {
            return Err("Evaluation step budget exceeded".into());
        }
        match e {
            Expr::Literal(v) => Ok(match v {
                Value::Object(_) => Value::object(BTreeMap::new()),
                _ => v.clone(),
            }),
            Expr::Array(a) => Ok(Value::array(
                a.iter().map(|e| self.eval(e)).collect::<Result<_>>()?,
            )),
            Expr::Path(p) => {
                let v = get(&self.input, p)?;
                if matches!(v, Value::Undefined) {
                    match p.to_ascii_uppercase().as_str() {
                        "YES" | "ON" => return Ok(Value::Bool(true)),
                        "NO" | "OFF" => return Ok(Value::Bool(false)),
                        _ => {}
                    }
                    if !self.ignore_missing {
                        return Err(format!("Undefined key: {p}"));
                    }
                }
                Ok(v)
            }
            Expr::Unary(op, e) => {
                let v = self.eval(e)?;
                Ok(if op == "-" {
                    Value::Number(-v.number()?)
                } else {
                    Value::Bool(!v.truthy())
                })
            }
            Expr::Binary(op, a, b) => {
                let a = self.eval(a)?;
                if op == "AND" && !a.truthy() || op == "OR" && a.truthy() {
                    return Ok(a);
                }
                let b = self.eval(b)?;
                if op == "AND" || op == "OR" {
                    return Ok(b);
                }
                Ok(match op.as_str() {
                    "==" => Value::Bool(a.same(&b)),
                    "!=" | "<>" => Value::Bool(!a.same(&b)),
                    "~=" => Value::Bool((a.number()? - b.number()?).abs() < f64::EPSILON),
                    "<" | ">" | "<=" | ">=" => {
                        let ordering = if let (Value::String(x), Value::String(y)) = (&a, &b) {
                            Some(x.encode_utf16().cmp(y.encode_utf16()))
                        } else {
                            a.primitive_number()?.partial_cmp(&b.primitive_number()?)
                        };
                        Value::Bool(match op.as_str() {
                            "<" => ordering == Some(std::cmp::Ordering::Less),
                            ">" => ordering == Some(std::cmp::Ordering::Greater),
                            "<=" => ordering.is_some_and(|o| o != std::cmp::Ordering::Greater),
                            _ => ordering.is_some_and(|o| o != std::cmp::Ordering::Less),
                        })
                    }
                    _ => {
                        let (x, y) = (a.number()?, b.number()?);
                        Value::Number(match op.as_str() {
                            "+" => x + y,
                            "-" => x - y,
                            "*" => x * y,
                            "/" => x / y,
                            "%" | "MOD" => x % y,
                            "^" => x.powf(y),
                            _ => return Err("Unsupported binary operator".into()),
                        })
                    }
                })
            }
            Expr::Call(name, args) => {
                let a = args
                    .iter()
                    .map(|e| self.eval(e))
                    .collect::<Result<Vec<_>>>()?;
                call(name, &a)
            }
        }
    }
    fn statement(&mut self, s: &Statement) -> Result<Value> {
        let value = if let Some((lhs, op)) = &s.lhs {
            if op == "??=" {
                let old = get(&self.input, lhs)?;
                if matches!(old, Value::Undefined) && !self.ignore_missing {
                    return Err(format!("Undefined key: {lhs}"));
                }
                if !matches!(old, Value::Null | Value::Undefined) {
                    old
                } else {
                    self.eval(&s.expr)?
                }
            } else if op == "=" {
                self.eval(&s.expr)?
            } else {
                let a = get(&self.input, lhs)?.number()?;
                let b = self.eval(&s.expr)?.number()?;
                Value::Number(match op.as_str() {
                    "+=" => a + b,
                    "-=" => a - b,
                    "*=" => a * b,
                    "/=" => a / b,
                    _ => unreachable!(),
                })
            }
        } else {
            self.eval(&s.expr)?
        };
        self.last = value.clone();
        if let Some((lhs, _)) = &s.lhs {
            set(&self.input, lhs, value)?;
            Ok(self.input.clone())
        } else {
            Ok(value)
        }
    }
    fn condition(&mut self, c: &Condition) -> Result<Value> {
        match c {
            Condition::Expression(e) => self.statement(e),
            Condition::And(a) => {
                for c in a {
                    if !self.condition(c)?.truthy() {
                        return Ok(Value::Bool(false));
                    }
                }
                Ok(Value::Bool(true))
            }
            Condition::Or(a) => {
                for c in a {
                    if self.condition(c)?.truthy() {
                        return Ok(Value::Bool(true));
                    }
                }
                Ok(Value::Bool(false))
            }
        }
    }
    fn run(&mut self, r: &Rule) -> Result<bool> {
        self.steps += 1;
        if self.steps > 1_000_000 {
            return Err("Evaluation step budget exceeded".into());
        }
        match r {
            Rule::Expression(e) => {
                self.last = self.statement(e)?;
            }
            Rule::Sequence(a) => {
                let mut values = vec![];
                for r in a {
                    if self.run(r)? {
                        return Ok(true);
                    }
                    values.push(self.last.clone())
                }
                self.last = Value::array(values);
            }
            Rule::Return(e) => {
                self.last = self.eval(e)?;
                return Ok(true);
            }
            Rule::Logical(c) => self.last = self.condition(c)?,
            Rule::If(c, yes, no) => {
                self.last = self.input.clone();
                if self.condition(c)?.truthy() {
                    if self.run(yes)? {
                        return Ok(true);
                    }
                } else if let Some(no) = no {
                    if self.run(no)? {
                        return Ok(true);
                    }
                } else {
                    self.last = self.input.clone();
                }
            }
            Rule::Try(yes, no) => match self.run(yes) {
                Ok(stop) => return Ok(stop),
                Err(_) => return self.run(no),
            },
            Rule::Array(method, p, body, dest) => {
                let data = get(&self.input, p)?;
                let len = data.items()?.len();
                let mut values = vec![];
                let mut answer = match method.as_str() {
                    "every" => Value::Bool(true),
                    "some" => Value::Bool(false),
                    "find" => Value::Undefined,
                    _ => Value::Undefined,
                };
                for index in 0..len {
                    let item = property(&data, &index.to_string());
                    let context_keys = ["$item", "$index", "$array"];
                    let mut saved = Vec::new();
                    for key in context_keys {
                        let Value::Object(o) = &self.input else {
                            unreachable!()
                        };
                        saved.push(o.borrow().get(key).cloned());
                    }
                    write(&self.input, "$item", item.clone())?;
                    write(&self.input, "$index", Value::Number(index as f64))?;
                    write(&self.input, "$array", data.clone())?;
                    let result = self.run(body).map(|_| self.last.clone());
                    for (key, saved) in context_keys.into_iter().zip(saved) {
                        let Value::Object(o) = &self.input else {
                            unreachable!()
                        };
                        if let Some(v) = saved {
                            o.borrow_mut().insert(key.into(), v);
                        } else {
                            o.borrow_mut().remove(key);
                        }
                    }
                    let value = result?;
                    match method.as_str() {
                        "map" => values.push(value),
                        "filter" => {
                            if value.truthy() {
                                values.push(item)
                            }
                        }
                        "every" => {
                            if !value.truthy() {
                                answer = Value::Bool(false);
                                break;
                            }
                        }
                        "some" => {
                            if value.truthy() {
                                answer = Value::Bool(true);
                                break;
                            }
                        }
                        "find" => {
                            if value.truthy() {
                                answer = item;
                                break;
                            }
                        }
                        _ => unreachable!(),
                    }
                }
                if method == "map" || method == "filter" {
                    answer = Value::array(values)
                }
                if let Some(dest) = dest {
                    set(&self.input, dest, answer.clone())?
                }
                self.last = answer;
            }
        }
        Ok(false)
    }
}
fn call(name: &str, a: &[Value]) -> Result<Value> {
    let n = |i: usize| a[i].number();
    let arr = |i: usize| a[i].items();
    Ok(match name {
        "NOT" => Value::Bool(!a[0].truthy()),
        "ISNAN" => Value::Bool(n(0)?.is_nan()),
        "ABS" => Value::Number(n(0)?.abs()),
        "NEG" => Value::Number(-n(0)?),
        "FLOOR" => Value::Number(n(0)?.floor()),
        "CEIL" => Value::Number(n(0)?.ceil()),
        "ROUND" => {
            let v = n(0)?;
            Value::Number(if !v.is_finite() || v.fract() == 0.0 {
                v
            } else if v >= -0.5 && v < 0.0 {
                -0.0
            } else {
                let floor = v.floor();
                if v - floor < 0.5 { floor } else { floor + 1.0 }
            })
        }
        "SQRT" => Value::Number(n(0)?.sqrt()),
        "ADD" => Value::Number(n(0)? + n(1)?),
        "SUB" => Value::Number(n(0)? - n(1)?),
        "MUL" => Value::Number(n(0)? * n(1)?),
        "DIV" => Value::Number(n(0)? / n(1)?),
        "MOD" => Value::Number(n(0)? % n(1)?),
        "LENGTH" => Value::Number(match &a[0] {
            Value::Array(v) => v.borrow().len(),
            Value::String(v) => v.encode_utf16().count(),
            _ => return Err("LENGTH expects array or string".into()),
        } as f64),
        "COUNT_KEYS" => Value::Number(match &a[0] {
            Value::Object(v) => v.borrow().len(),
            Value::Array(v) => v.borrow().len(),
            _ => return Err("COUNT_KEYS expects object or array".into()),
        } as f64),
        "MIN" | "MAX" => {
            let items = if matches!(a[0], Value::Array(_)) {
                arr(0)?
            } else {
                vec![a[0].clone()]
            };
            let mut answer = if name == "MIN" {
                f64::INFINITY
            } else {
                f64::NEG_INFINITY
            };
            for v in items {
                let v = v.number()?;
                if v.is_nan() {
                    answer = f64::NAN;
                    break;
                }
                answer = if name == "MIN" {
                    answer.min(v)
                } else {
                    answer.max(v)
                }
            }
            Value::Number(answer)
        }
        "RANGE" => {
            let (start, end) = (n(0)?, n(1)?);
            if !start.is_finite()
                || !end.is_finite()
                || start.fract() != 0.0
                || end.fract() != 0.0
                || start.abs() > 9007199254740991.0
                || end.abs() > 9007199254740991.0
                || end - start > 100_000.0
            {
                return Err("Invalid RANGE bounds".into());
            }
            let mut values = vec![];
            let mut v = start;
            while v < end {
                values.push(Value::Number(v));
                v += 1.0
            }
            Value::array(values)
        }
        "INDEX" => {
            let index = n(1)?;
            if index < 0.0 || index.fract() != 0.0 {
                Value::Undefined
            } else {
                match &a[0] {
                    Value::Array(v) => v
                        .borrow()
                        .get(index as usize)
                        .cloned()
                        .unwrap_or(Value::Undefined),
                    Value::String(s) => {
                        if !s.is_ascii() {
                            return Err("Non-ASCII string INDEX unsupported".into());
                        }
                        s.as_bytes()
                            .get(index as usize)
                            .map(|c| Value::String((*c as char).to_string()))
                            .unwrap_or(Value::Undefined)
                    }
                    _ => return Err("INDEX expects iterable".into()),
                }
            }
        }
        "HEAD" | "LAST" => {
            let v = arr(0)?;
            if name == "HEAD" { v.first() } else { v.last() }
                .cloned()
                .unwrap_or(Value::Undefined)
        }
        "TAIL" => Value::array(arr(0)?.into_iter().skip(1).collect()),
        "REVERSE" => {
            let mut v = arr(0)?;
            v.reverse();
            Value::array(v)
        }
        "SORT" => {
            let mut v = arr(0)?;
            for v in &v {
                v.number()?;
            }
            v.sort_by(|a, b| {
                a.number()
                    .unwrap()
                    .partial_cmp(&b.number().unwrap())
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            Value::array(v)
        }
        "CONCAT" => {
            let mut v = arr(0)?;
            v.extend(arr(1)?);
            Value::array(v)
        }
        "CONS" => {
            let mut v = vec![a[0].clone()];
            v.extend(arr(1)?);
            Value::array(v)
        }
        "TAKE" | "DROP" | "SLICE" => {
            let (index, limit, v) = if name == "SLICE" {
                (n(0)?, Some(n(1)?), arr(2)?)
            } else {
                (n(0)?, None, arr(1)?)
            };
            let len = v.len();
            let bound = |n: f64| -> usize {
                if n.is_nan() {
                    0
                } else if n < 0.0 {
                    (len as f64 + n.trunc()).max(0.0) as usize
                } else {
                    n.min(len as f64) as usize
                }
            };
            let b = bound(index);
            let (start, end) = if name == "TAKE" {
                (0, b)
            } else if name == "DROP" {
                (b, len)
            } else {
                (b, bound(limit.unwrap()))
            };
            Value::array(if start > end {
                vec![]
            } else {
                v[start..end].to_vec()
            })
        }
        "CONTAINS" | "INCLUDES" | "REMOVE_VALUES" => {
            let matches = if matches!(a[0], Value::Array(_)) {
                arr(0)?
            } else {
                vec![a[0].clone()]
            };
            let data = if matches!(a[1], Value::Array(_)) {
                arr(1)?
            } else {
                vec![a[1].clone()]
            };
            let contains = |v: &Value| {
                matches.iter().any(|m|m.same(v)||matches!((m,v),(Value::Number(a),Value::Number(b))if a.is_nan()&&b.is_nan()))
            };
            if name == "REMOVE_VALUES" {
                Value::array(data.into_iter().filter(|v| !contains(v)).collect())
            } else {
                Value::Bool(data.iter().any(contains))
            }
        }
        "STRING_CONTAINS" | "STRING_STARTS_WITH" | "STRING_ENDS_WITH" => {
            let needle = a[0].string()?;
            let text = a[1].string()?;
            Value::Bool(match name {
                "STRING_CONTAINS" => text.contains(&needle),
                "STRING_STARTS_WITH" => text.starts_with(&needle),
                _ => text.ends_with(&needle),
            })
        }
        _ => return Err(format!("Unsupported function {name}")),
    })
}
pub fn digest(v: &Value) -> Result<u32> {
    Ok(match v {
        Value::Bool(v) => {
            if *v {
                7
            } else {
                11
            }
        }
        Value::Number(v) if v.is_finite() => ((*v * 1000.0 + 0.5).floor() as i64) as u32,
        Value::String(v) => v.encode_utf16().enumerate().fold(13u32, |s, (i, c)| {
            s.wrapping_add((c as u32).wrapping_mul(i as u32 + 1))
        }),
        Value::Array(v) => v.borrow().iter().enumerate().try_fold(17u32, |s, (i, v)| {
            Ok::<_, String>(s.wrapping_add(digest(v)?.wrapping_mul(i as u32 + 1)))
        })?,
        Value::Undefined => 19,
        Value::Null => 23,
        Value::Number(_) => 29,
        Value::Object(v) => {
            v.borrow()
                .iter()
                .enumerate()
                .try_fold(31u32, |sum, (i, (key, value))| {
                    Ok::<_, String>(
                        sum.wrapping_add(
                            digest(&Value::String(key.clone()))?
                                .wrapping_add(digest(value)?)
                                .wrapping_mul(i as u32 + 1),
                        ),
                    )
                })?
        }
    })
}
/// A session stores syntax only. Inputs/results are never inserted in the cache.
pub struct Session {
    programs: HashMap<String, Rc<Program>>,
    order: VecDeque<String>,
    next: u64,
    pub completed: u64,
    pub cache_limit: usize,
    program_bytes: HashMap<String, usize>,
    retained_program_bytes: usize,
    byte_limit: usize,
}
impl Default for Session {
    fn default() -> Self {
        Self {
            programs: HashMap::new(),
            order: VecDeque::new(),
            next: 0,
            completed: 0,
            cache_limit: 128,
            program_bytes: HashMap::new(),
            retained_program_bytes: 0,
            byte_limit: 1024 * 1024,
        }
    }
}
impl Session {
    pub fn command(&mut self, v: &Json) -> Result<Json> {
        let op = v.get("op").and_then(Json::as_str).ok_or("Missing op")?;
        match op {
            "prepare" => {
                let source = v.get("rules").ok_or("Missing rules")?;
                let bytes = serde_json::to_vec(source).map_err(|e| e.to_string())?.len();
                if bytes > self.byte_limit {
                    return Err("Program exceeds cache byte limit".into());
                }
                let p = Program::compile(source)?;
                self.next += 1;
                let id = format!("p{}", self.next);
                while self.programs.len() >= self.cache_limit
                    || self.retained_program_bytes + bytes > self.byte_limit
                {
                    if let Some(id) = self.order.pop_front() {
                        self.programs.remove(&id);
                        self.retained_program_bytes -= self.program_bytes.remove(&id).unwrap_or(0);
                    }
                }
                self.programs.insert(id.clone(), Rc::new(p));
                self.program_bytes.insert(id.clone(), bytes);
                self.retained_program_bytes += bytes;
                self.order.push_back(id.clone());
                Ok(json!({"program":id}))
            }
            "release" => {
                let id = v["program"].as_str().ok_or("Missing program")?;
                let removed = self.programs.remove(id).is_some();
                self.retained_program_bytes -= self.program_bytes.remove(id).unwrap_or(0);
                self.order.retain(|p| p != id);
                Ok(json!({"released":removed}))
            }
            "stats" => Ok(
                json!({"programs":self.programs.len(),"cacheLimit":self.cache_limit,"completed":self.completed,"retainedInputs":0,"programSourceBytes":self.retained_program_bytes,"sourceByteLimit":self.byte_limit}),
            ),
            "execute" | "run" => {
                let program = if op == "run" {
                    self.programs
                        .get(v["program"].as_str().ok_or("Missing program")?)
                        .cloned()
                        .ok_or("Unknown or evicted program")?
                } else {
                    Rc::new(Program::compile(v.get("rules").ok_or("Missing rules")?)?)
                };
                let input = Value::from_wire(v.get("input").ok_or("Missing tagged input")?)?;
                let options = v.get("options");
                if let Some(options) = options {
                    let object = options.as_object().ok_or("Options must be object")?;
                    if object
                        .keys()
                        .any(|k| !matches!(k.as_str(), "trace" | "ignoreMissingKeys"))
                    {
                        return Err("Unsupported execution option".into());
                    }
                    if object.values().any(|v| !v.is_boolean()) {
                        return Err("Execution options must be booleans".into());
                    }
                }
                if options.and_then(|o| o.get("trace")).and_then(Json::as_bool) == Some(true) {
                    return Err("Tracing is unsupported by this Rust bridge".into());
                }
                let ignore = options
                    .and_then(|o| o.get("ignoreMissingKeys"))
                    .and_then(Json::as_bool)
                    .unwrap_or(true);
                let (result, input) = program.execute(input, ignore)?;
                let mut bytes = 0;
                let result = result.encode(0, &mut Vec::new(), true, &mut bytes)?;
                let input = input.encode(0, &mut Vec::new(), true, &mut bytes)?;
                let output = json!({"result":result,"input":input});
                self.completed += 1;
                Ok(output)
            }
            _ => Err("Unsupported protocol operation".into()),
        }
    }
}
