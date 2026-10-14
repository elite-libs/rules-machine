use rusty_rules_experiment::{Program, Result, Session, Value, digest};
use serde_json::{Value as Json, json};
use std::io::{self, BufRead, Read, Write};
use std::time::Instant;
const MAX_FRAME: usize = 8 * 1024 * 1024;
fn legacy(v: &Json) -> Result<Json> {
    let program = Program::compile(v.get("rules").ok_or("Missing rules")?)?;
    let inputs = v
        .get("inputs")
        .and_then(Json::as_array)
        .ok_or("Missing inputs")?;
    let iterations = v.get("iterations").and_then(Json::as_u64).unwrap_or(1);
    let warmup = v.get("warmup").and_then(Json::as_u64).unwrap_or(0);
    if iterations == 0 || iterations > 10_000_000 || warmup > 10_000_000 {
        return Err("Invalid iteration count".into());
    }
    let mut outputs = vec![];
    for input in inputs {
        let (result, input) = program.execute(Value::from_json(input), true)?;
        outputs.push(json!({"result":result.legacy()?,"input":input.legacy()?}));
    }
    for _ in 0..warmup {
        for input in inputs {
            std::hint::black_box(program.execute(Value::from_json(input), true)?);
        }
    }
    let skip = v
        .get("skipTimedFirst")
        .and_then(Json::as_bool)
        .unwrap_or(false);
    let start = Instant::now();
    let (mut checksum, mut completed) = (0u32, 0u64);
    for iteration in 0..iterations {
        for (index, input) in inputs.iter().enumerate() {
            if skip && iteration == 0 && index == 0 {
                continue;
            }
            let (result, _) = program.execute(Value::from_json(input), true)?;
            checksum = checksum.wrapping_add(digest(&result)?.wrapping_mul(index as u32 + 1));
            completed += 1;
            std::hint::black_box(result);
        }
    }
    Ok(
        json!({"outputs":outputs,"elapsedNs":start.elapsed().as_nanos()as u64,"operations":completed,"checksum":checksum}),
    )
}
fn main() {
    let once = std::env::args().any(|s| s == "--once");
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    let mut session = Session::default();
    loop {
        let mut frame = Vec::new();
        let bytes = match (&mut input)
            .take((MAX_FRAME + 1) as u64)
            .read_until(b'\n', &mut frame)
        {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => break,
        };
        if bytes > MAX_FRAME {
            let _ = writeln!(
                output,
                "{}",
                json!({"id":null,"error":{"code":"FRAME_LIMIT","message":"Frame exceeds 8MiB"}})
            );
            let _ = output.flush();
            break;
        }
        let parsed = serde_json::from_slice::<Json>(&frame);
        let response = match parsed {
            Err(e) => json!({"id":null,"error":{"code":"INVALID_JSON","message":e.to_string()}}),
            Ok(v) => {
                if v.get("op").is_some() {
                    let id = v.get("id").cloned().unwrap_or(Json::Null);
                    match session.command(&v) {
                        Ok(result) => json!({"id":id,"result":result}),
                        Err(message) => {
                            json!({"id":id,"error":{"code":"RULE_ERROR","message":message}})
                        }
                    }
                } else {
                    match legacy(&v) {
                        Ok(result) => result,
                        Err(error) => json!({"error":error}),
                    }
                }
            }
        };
        if writeln!(output, "{response}")
            .and_then(|_| output.flush())
            .is_err()
        {
            break;
        }
        if once {
            break;
        }
    }
}
