//! Deliberately restricted JSON rule interpreter; unsupported syntax fails closed.
use serde_json::{Value, json};
use std::io::{self, BufRead};
use std::time::Instant;
type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Debug)]
enum Expr {
    Literal(Value),
    Path(String),
    Binary(String, Box<Expr>, Box<Expr>),
}
#[derive(Clone, Debug)]
enum Rule {
    Expression(Expr),
    Set(String, Expr),
    Sequence(Vec<Rule>),
    If(Expr, Box<Rule>, Option<Box<Rule>>),
    Return(Expr),
}
fn tokens(s: &str) -> Result<Vec<String>> {
    let c: Vec<char> = s.chars().collect();
    let mut i = 0;
    let mut out = vec![];
    while i < c.len() {
        if c[i].is_whitespace() {
            i += 1;
            continue;
        }
        let start = i;
        if c[i] == '"' {
            i += 1;
            let mut escaped = false;
            while i < c.len() {
                let ch = c[i];
                i += 1;
                if ch == '"' && !escaped {
                    break;
                }
                if ch == '\\' && !escaped {
                    escaped = true
                } else {
                    escaped = false
                }
            }
            if c[i - 1] != '"' {
                return Err("unterminated string".into());
            }
        } else if c[i].is_ascii_alphabetic() || c[i] == '_' || c[i] == '$' {
            i += 1;
            while i < c.len() && (c[i].is_ascii_alphanumeric() || "_$.".contains(c[i])) {
                i += 1
            }
        } else if c[i].is_ascii_digit() {
            i += 1;
            while i < c.len() && (c[i].is_ascii_digit() || c[i] == '.') {
                i += 1
            }
        } else if "()+-*/%<>=!".contains(c[i]) {
            i += 1;
            if i < c.len() && c[i] == '=' && "<>=!".contains(c[start]) {
                i += 1
            }
        } else {
            return Err(format!("unsupported character {}", c[i]));
        }
        out.push(c[start..i].iter().collect());
    }
    Ok(out)
}
fn precedence(op: &str) -> Option<u8> {
    Some(match op {
        "OR" | "AND" => 1,
        "==" | "!=" => 3,
        "<" | ">" | "<=" | ">=" => 4,
        "+" | "-" => 5,
        "*" | "/" | "%" => 6,
        _ => return None,
    })
}
struct Parser {
    t: Vec<String>,
    i: usize,
}
impl Parser {
    fn parse(&mut self, min: u8) -> Result<Expr> {
        let token = self.t.get(self.i).ok_or("expected expression")?.clone();
        self.i += 1;
        let mut left = if token == "(" {
            let e = self.parse(1)?;
            if self.t.get(self.i).map(String::as_str) != Some(")") {
                return Err("missing closing parenthesis".into());
            }
            self.i += 1;
            e
        } else if token.starts_with('"')
            || token == "true"
            || token == "false"
            || token.as_bytes()[0].is_ascii_digit()
        {
            let v: Value = serde_json::from_str(&token).map_err(|e| e.to_string())?;
            if !v.is_number() && !v.is_string() && !v.is_boolean() {
                return Err("unsupported literal".into());
            }
            Expr::Literal(v)
        } else if token == "null" || token == "undefined" {
            return Err("null/missing literal outside shared subset".into());
        } else if token
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        {
            validate_path(&token)?;
            Expr::Path(token)
        } else {
            return Err(format!("unsupported token {token}"));
        };
        while let Some(op) = self.t.get(self.i).cloned() {
            let Some(p) = precedence(&op) else { break };
            if p < min {
                break;
            }
            self.i += 1;
            let right = self.parse(p + 1)?;
            left = Expr::Binary(op, Box::new(left), Box::new(right));
        }
        Ok(left)
    }
}
fn expression(s: &str) -> Result<Expr> {
    let mut p = Parser {
        t: tokens(s)?,
        i: 0,
    };
    let e = p.parse(1)?;
    if p.i != p.t.len() {
        return Err(format!("unsupported trailing token {}", p.t[p.i]));
    }
    Ok(e)
}
fn validate_path(s: &str) -> Result<()> {
    for part in s.split('.') {
        if part.is_empty()
            || matches!(
                part,
                "__proto__"
                    | "prototype"
                    | "constructor"
                    | "toString"
                    | "valueOf"
                    | "hasOwnProperty"
                    | "isPrototypeOf"
                    | "propertyIsEnumerable"
            )
        {
            return Err("unsafe/invalid path".into());
        }
    }
    Ok(())
}
fn compile(v: &Value) -> Result<Rule> {
    match v {
        Value::String(s) => {
            let t = tokens(s)?;
            if let Some(i) = t.iter().position(|t| t == "=") {
                if i != 1 {
                    return Err("assignment requires a single path".into());
                }
                validate_path(&t[0])?;
                Ok(Rule::Set(t[0].clone(), expression(&t[2..].join(" "))?))
            } else {
                Ok(Rule::Expression(expression(s)?))
            }
        }
        Value::Array(a) => Ok(Rule::Sequence(
            a.iter().map(compile).collect::<Result<_>>()?,
        )),
        Value::Object(o) => {
            if o.contains_key("if") {
                if o.keys()
                    .any(|k| !matches!(k.as_str(), "if" | "then" | "else"))
                {
                    return Err("unsupported if field".into());
                }
                let cond = o["if"].as_str().ok_or("if must be expression string")?;
                let then = compile(o.get("then").ok_or("missing then")?)?;
                let other = o.get("else").map(compile).transpose()?.map(Box::new);
                Ok(Rule::If(expression(cond)?, Box::new(then), other))
            } else if o.len() == 1 && o.contains_key("return") {
                Ok(Rule::Return(expression(
                    o["return"].as_str().ok_or("return must be string")?,
                )?))
            } else {
                Err("unsupported structural rule".into())
            }
        }
        _ => Err("invalid rule type".into()),
    }
}
fn lookup(v: &Value, p: &str) -> Result<Value> {
    let mut v = v;
    for k in p.split('.') {
        v = v
            .as_object()
            .and_then(|o| o.get(k))
            .ok_or_else(|| format!("missing path {p}"))?
    }
    if v.is_null() {
        return Err("null outside shared subset".into());
    }
    Ok(v.clone())
}
fn number(v: Value) -> Result<f64> {
    v.as_f64()
        .filter(|n| n.is_finite())
        .ok_or("expected finite number".into())
}
fn boolean(v: Value) -> Result<bool> {
    v.as_bool().ok_or("expected boolean".into())
}
fn evaluate(e: &Expr, input: &Value) -> Result<Value> {
    match e {
        Expr::Literal(v) => Ok(v.clone()),
        Expr::Path(p) => lookup(input, p),
        Expr::Binary(op, a, b) => {
            let x = evaluate(a, input)?;
            if op == "AND" {
                return if boolean(x)? {
                    Ok(json!(boolean(evaluate(b, input)?)?))
                } else {
                    Ok(json!(false))
                };
            }
            if op == "OR" {
                return if boolean(x)? {
                    Ok(json!(true))
                } else {
                    Ok(json!(boolean(evaluate(b, input)?)?))
                };
            }
            let y = evaluate(b, input)?;
            if op == "==" || op == "!=" {
                if !x.is_boolean() && !x.is_string() && !x.is_number()
                    || !y.is_boolean() && !y.is_string() && !y.is_number()
                {
                    return Err("equality requires primitives".into());
                }
                let eq = if x.is_number() && y.is_number() {
                    number(x)? == number(y)?
                } else {
                    x == y
                };
                return Ok(json!(if op == "==" { eq } else { !eq }));
            }
            let (x, y) = (number(x)?, number(y)?);
            let n = match op.as_str() {
                "+" => x + y,
                "-" => x - y,
                "*" => x * y,
                "/" => x / y,
                "%" => x % y,
                "<" => return Ok(json!(x < y)),
                ">" => return Ok(json!(x > y)),
                "<=" => return Ok(json!(x <= y)),
                ">=" => return Ok(json!(x >= y)),
                _ => return Err("unknown operator".into()),
            };
            if !n.is_finite() {
                return Err("nonfinite result".into());
            }
            Ok(json!(n))
        }
    }
}
fn set(input: &mut Value, path: &str, value: Value) -> Result<()> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut target = input;
    for p in &parts[..parts.len() - 1] {
        let o = target.as_object_mut().ok_or("set requires object")?;
        target = o.entry((*p).to_string()).or_insert_with(|| json!({}));
    }
    target
        .as_object_mut()
        .ok_or("set requires object")?
        .insert(parts[parts.len() - 1].to_string(), value);
    Ok(())
}
// Sequence return propagation mirrors the supported top-level return contract.
fn run(rule: &Rule, input: &mut Value) -> Result<(Value, bool)> {
    match rule {
        Rule::Expression(e) => Ok((evaluate(e, input)?, false)),
        Rule::Set(p, e) => {
            let v = evaluate(e, input)?;
            set(input, p, v)?;
            Ok((input.clone(), false))
        }
        Rule::Return(e) => Ok((evaluate(e, input)?, true)),
        Rule::Sequence(rules) => {
            let mut last = input.clone();
            for r in rules {
                let (v, stop) = run(r, input)?;
                last = v;
                if stop {
                    return Ok((last, true));
                }
            }
            Ok((last, false))
        }
        Rule::If(e, yes, no) => {
            if boolean(evaluate(e, input)?)? {
                run(yes, input)
            } else if let Some(no) = no {
                run(no, input)
            } else {
                Ok((input.clone(), false))
            }
        }
    }
}
fn validate_input(v: &Value) -> Result<()> {
    if !v.is_object() {
        return Err("input must be object".into());
    }
    for key in v.as_object().unwrap().keys() {
        validate_path(key)?;
        if matches!(key.as_str(), "$item" | "$index" | "$array") {
            return Err("reserved input field".into());
        }
    }
    Ok(())
}
fn digest(v: &Value) -> Result<u32> {
    match v {
        Value::Bool(b) => Ok(if *b { 7 } else { 11 }),
        Value::Number(n) => {
            Ok((n.as_f64().ok_or("invalid number")? * 1000.0 + 0.5).floor() as i64 as u32)
        }
        Value::String(s) => Ok(s.encode_utf16().enumerate().fold(13u32, |sum, (i, c)| {
            sum.wrapping_add((c as u32).wrapping_mul(i as u32 + 1))
        })),
        Value::Array(a) => a.iter().enumerate().try_fold(17u32, |sum, (i, v)| {
            Ok(sum.wrapping_add(digest(v)?.wrapping_mul(i as u32 + 1)))
        }),
        _ => Err("unsupported benchmark result type".into()),
    }
}
fn nested_sequence(v: &Value, root: bool) -> bool {
    match v {
        Value::Array(a) => (!root) || a.iter().any(|v| nested_sequence(v, false)),
        Value::Object(o) => o.values().any(|v| nested_sequence(v, false)),
        _ => false,
    }
}
fn request(v: &Value) -> Result<Value> {
    let source = v.get("rules").ok_or("missing rules")?;
    let top_level_return = source
        .as_array()
        .and_then(|a| a.last())
        .and_then(Value::as_object)
        .is_some_and(|o| o.len() == 1 && o.contains_key("return"));
    if nested_sequence(source, true) && !top_level_return {
        return Err("nested sequences require a final top-level return in this subset".into());
    }
    let rules = compile(source)?;
    let inputs = v
        .get("inputs")
        .and_then(Value::as_array)
        .ok_or("missing inputs")?;
    for input in inputs {
        validate_input(input)?
    }
    let iterations = v.get("iterations").and_then(Value::as_u64).unwrap_or(1);
    if iterations == 0 || iterations > 10_000_000 {
        return Err("invalid iteration count".into());
    }
    // Identical reset/clone boundary as JavaScript worker; preparation and output JSON excluded.
    let mut outputs = vec![];
    for input in inputs {
        let mut copy = input.clone();
        let (result, _) = run(&rules, &mut copy)?;
        outputs.push(json!({"result":result,"input":copy}));
    }
    let warmup = v.get("warmup").and_then(Value::as_u64).unwrap_or(0);
    for _ in 0..warmup {
        for input in inputs {
            let mut copy = input.clone();
            std::hint::black_box(run(&rules, &mut copy)?);
        }
    }
    let start = Instant::now();
    let mut checksum = 0u32;
    let mut completed = 0u64;
    let skip_first = v
        .get("skipTimedFirst")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    for iteration in 0..iterations {
        for (index, input) in inputs.iter().enumerate() {
            if skip_first && iteration == 0 && index == 0 {
                continue;
            }
            let mut copy = input.clone();
            let (result, _) = run(&rules, &mut copy)?;
            checksum = checksum.wrapping_add(digest(&result)?.wrapping_mul(index as u32 + 1));
            completed += 1;
            std::hint::black_box(&result);
        }
    }
    Ok(
        json!({"outputs":outputs,"elapsedNs":start.elapsed().as_nanos() as u64,"operations":completed,"checksum":checksum}),
    )
}
fn main() {
    let once = std::env::args().any(|arg| arg == "--once");
    for line in io::stdin().lock().lines() {
        match line {
            Ok(line) => {
                let response = serde_json::from_str::<Value>(&line)
                    .map_err(|e| e.to_string())
                    .and_then(|v| request(&v));
                println!(
                    "{}",
                    match response {
                        Ok(v) => v,
                        Err(error) => json!({"error":error}),
                    }
                );
            }
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1)
            }
        }
        if once {
            break;
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn measured_work_and_nested_scope_contract() {
        let valid=request(&json!({"rules":[{"return":"value"}],"inputs":[{"value":2},{"value":3}],"iterations":3})).unwrap();
        assert_eq!(valid["operations"], json!(6));
        assert_eq!(valid["checksum"], json!(24000));
        let skipped=request(&json!({"rules":[{"return":"value"}],"inputs":[{"value":2},{"value":3}],"iterations":3,"skipTimedFirst":true})).unwrap();
        assert_eq!(skipped["operations"], json!(5));
        assert_eq!(skipped["checksum"], json!(22000));
        assert!(request(&json!({"rules":[["1","2"]],"inputs":[{}]})).is_err());
        assert_eq!(
            evaluate(&expression("true OR false AND false").unwrap(), &json!({})).unwrap(),
            json!(false)
        );
        assert_eq!(digest(&json!([1, 2, 3])).unwrap(), 14017);
    }
    #[test]
    fn rejects_unsupported() {
        for s in [
            "a += 2",
            "DATE(1)",
            "a[0]",
            "null",
            "a = 1 = 2",
            "a ** 2",
            "constructor.x",
        ] {
            assert!(compile(&json!(s)).is_err(), "{s}")
        }
    }
    #[test]
    fn precedence_and_short_circuit() {
        let e = expression("false AND absent > 2 OR 2 + 3 * 4 == 14").unwrap();
        assert_eq!(evaluate(&e, &json!({})).unwrap(), json!(true));
    }
    #[test]
    fn rule_mutations() {
        let r=compile(&json!(["total = price * count",{"if":"total > 10","then":"total = total - 2","else":"total = total + 1"},{"return":"total"}])).unwrap();
        let mut i = json!({"price":4,"count":3});
        assert_eq!(run(&r, &mut i).unwrap().0, json!(10.0));
        assert_eq!(i["total"], json!(10.0));
    }
}
