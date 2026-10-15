use serde_json::{Value as Json, json};
use std::io::Write;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

fn request(frame: &Json) -> Json {
    let mut child = Command::new(env!("CARGO_BIN_EXE_rusty-rules-experiment"))
        .arg("--once")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let line = serde_json::to_vec(frame).unwrap();
    // A writer thread prevents a faulty child's early exit from blocking the test.
    let writer = thread::spawn(move || {
        let _ = stdin.write_all(&line);
        let _ = stdin.write_all(b"\n");
    });
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if child.try_wait().unwrap().is_some() {
            break;
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            panic!("worker request exceeded watchdog");
        }
        thread::sleep(Duration::from_millis(5));
    }
    writer.join().unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    assert!(output.stdout.len() < 1024);
    serde_json::from_slice(&output.stdout).unwrap()
}

#[test]
fn invalid_request_ids_reject_before_command_and_are_never_echoed() {
    for id in [
        json!(null),
        json!(0),
        json!(-1),
        json!(1.5),
        json!(9_007_199_254_740_992u64),
        json!("i".repeat(8192)),
        json!([1]),
        json!({"nested":1}),
    ] {
        let response = request(&json!({"id":id,"op":"execute"}));
        assert_eq!(response["id"], Json::Null);
        assert_eq!(response["error"]["code"], "INVALID_REQUEST");
        assert_eq!(
            response["error"]["message"],
            "Request id must be a positive safe integer"
        );
    }
}

#[test]
fn safe_integer_request_ids_preserve_protocol_correlation() {
    for id in [1u64, 9_007_199_254_740_991u64] {
        let response = request(&json!({"id":id,"op":"stats"}));
        assert_eq!(response["id"], id);
        assert_eq!(response["result"]["programs"], 0);
    }
}
