use rusty_rules_experiment::{Program, Session, Value};
use serde_json::{Value as Json, json};
fn run(rules: Json, input: Json) -> Json {
    let p = Program::compile(&rules).unwrap();
    let (v, input) = p.execute(Value::from_json(&input), true).unwrap();
    json!({"result":v.legacy().unwrap(),"input":input.legacy().unwrap()})
}
#[test]
fn nested_sequences_and_return() {
    assert_eq!(
        run(json!([["1", "2"]]), json!({}))["result"],
        json!([1.0, 2.0])
    );
    assert_eq!(
        run(
            json!([{"if":"true","then":[{"return":"7"},"x=9"]},"x=10"]),
            json!({})
        ),
        json!({"result":7.0,"input":{}})
    );
}
#[test]
fn assignment_result_aliases() {
    assert_eq!(
        run(json!([["x=1", "x=2"]]), json!({}))["result"],
        json!([{"x":2.0},{"x":2.0}])
    );
}
#[test]
fn null_and_undefined_are_distinct() {
    let p = Program::compile(&json!("[missing, NULL, x]")).unwrap();
    let (v, _) = p
        .execute(Value::from_json(&json!({"x":null})), true)
        .unwrap();
    assert_eq!(
        v.wire().unwrap(),
        json!(["array", [["undefined"], ["null"], ["null"]]])
    );
}
#[test]
fn unary_case_and_short_circuit() {
    assert_eq!(run(json!("-2 + 5"), json!({}))["result"], json!(3.0));
    assert_eq!(
        run(json!("true Or false aNd false"), json!({}))["result"],
        json!(false)
    );
    assert_eq!(
        run(json!("0 AND ABS(\"bad\")"), json!({}))["result"],
        json!(0.0)
    );
}
#[test]
fn recursive_conditions() {
    assert_eq!(
        run(
            json!({"if":{"and":["true",{"or":["false","1 < 2"]}]},"then":{"return":"9"}}),
            json!({})
        )["result"],
        json!(9.0)
    );
}
#[test]
fn arrays_scope_and_callback_returns() {
    let r = run(
        json!([{"map":"items","run":[{"return":"$item * 2"},"oops=1"],"set":"out"},{"return":"out"}]),
        json!({"items":[1,2]}),
    );
    assert_eq!(
        r,
        json!({"result":[2.0,4.0],"input":{"items":[1.0,2.0],"out":[2.0,4.0]}})
    );
}
#[test]
fn array_predicates() {
    for (method, expected) in [
        ("filter", json!([2.0, 3.0])),
        ("every", json!(false)),
        ("some", json!(true)),
        ("find", json!(2.0)),
    ] {
        assert_eq!(
            run(
                json!({method:"items","run":"$item > 1"}),
                json!({"items":[1,2,3]})
            )["result"],
            expected
        );
    }
}
#[test]
fn try_catch_and_return() {
    assert_eq!(
        run(
            json!([{"try":"ADD(\"bad\", 1)","catch":{"return":"4"}},"x=9"]),
            json!({})
        ),
        json!({"result":4.0,"input":{}})
    );
}
#[test]
fn paths_and_compound() {
    assert_eq!(
        run(
            json!(["items[0]+=3","object[\"literal.key\"]=4",{"return":"items"}]),
            json!({"items":[2],"object":{}})
        )["input"],
        json!({"items":[5.0],"object":{"literal.key":4.0}})
    );
}
#[test]
fn unknown_syntax_rejects() {
    for rules in [
        json!("DATE(1)"),
        json!("false && true"),
        json!("ABS()"),
        json!("x = 1 = 2"),
        json!({"if":"true","then":"1","unknown":"2"}),
        json!("constructor.x=2"),
    ] {
        assert!(Program::compile(&rules).is_err(), "{rules}");
    }
}
#[test]
fn wire_no_collision() {
    let v = Value::from_json(&json!({"tag":"undefined","value":["undefined"],"ordinary":null}));
    let wire = v.wire().unwrap();
    assert_eq!(Value::from_wire(&wire).unwrap().wire().unwrap(), wire);
    assert!(Value::from_wire(&json!(["object", [["x", ["null"]], ["x", ["null"]]]])).is_err());
}
#[test]
fn cache_is_bounded_and_releases() {
    let mut s = Session::default();
    for i in 0..200 {
        assert!(
            s.command(&json!({"op":"prepare","rules":format!("{i}+1")}))
                .is_ok()
        );
    }
    assert_eq!(s.command(&json!({"op":"stats"})).unwrap()["programs"], 128);
    assert!(
        s.command(&json!({"op":"run","program":"p1","input":["object",[]]}))
            .is_err()
    );
    assert_eq!(
        s.command(&json!({"op":"release","program":"p200"}))
            .unwrap()["released"],
        true
    );
}
#[test]
fn cyclic_write_rejects_without_retained_cycle() {
    let p = Program::compile(&json!({"map":"items","run":"x=1","set":"out"})).unwrap();
    assert!(
        p.execute(Value::from_json(&json!({"items":[1,2]})), true)
            .is_err()
    );
}
#[test]
fn parser_escape_uses_next_character_verbatim() {
    assert_eq!(run(json!("\"a\\nb\""), json!({}))["result"], json!("anb"));
}
#[test]
fn unknown_bare_function_rejects() {
    assert!(Program::compile(&json!("ABS - 2")).is_err());
    assert!(Program::compile(&json!("a..b")).is_err());
}
#[test]
fn response_expansion_and_source_byte_cache_are_bounded() {
    assert!(
        Value::from_json(&json!("x".repeat(2 * 1024 * 1024)))
            .wire()
            .is_err()
    );
    let mut s = Session::default();
    for _ in 0..12 {
        s.command(&json!({"op":"prepare","rules":format!("\"{}\"","x".repeat(99_000))}))
            .unwrap();
    }
    let stats = s.command(&json!({"op":"stats"})).unwrap();
    assert!(stats["programs"].as_u64().unwrap() < 128);
    assert!(stats["programSourceBytes"].as_u64().unwrap() <= 1048576);
}
#[test]
fn callback_fast_scope_preserves_dsl_cycle_guard() {
    let p = Program::compile(&json!({"map":"items","run":"$item.parent=$array"})).unwrap();
    assert!(
        p.execute(Value::from_json(&json!({"items":[{"x":1}]})), true)
            .is_err()
    );
}
#[test]
fn minmax_signed_zero_and_sort_nan_domain() {
    let p = Program::compile(&json!(
        "[MIN([0,-0]), MIN([-0,0]), MAX([0,-0]), MAX([-0,0])]"
    ))
    .unwrap();
    let (result, _) = p.execute(Value::from_json(&json!({})), true).unwrap();
    assert_eq!(
        result.wire().unwrap(),
        json!([
            "array",
            [
                ["number", "-0"],
                ["number", "-0"],
                ["number", 0.0],
                ["number", 0.0]
            ]
        ])
    );
    let p = Program::compile(&json!("SORT([3, (0 / 0), 2])")).unwrap();
    assert!(p.execute(Value::from_json(&json!({})), true).is_err());
}

#[test]
fn allocation_and_numeric_domains_reject_early() {
    for expression in [
        "CONS(0,RANGE(0,100000))",
        "CONCAT([0],RANGE(0,100000))",
        "INDEX(42,-1)",
        "INDEX(NULL,0/0)",
        "3 ^ 0.2",
    ] {
        assert!(
            Program::compile(&json!(expression))
                .unwrap()
                .execute(Value::from_json(&json!({})), true)
                .is_err(),
            "{expression}"
        );
    }
    assert!(Program::compile(&json!(format!("{}=1", vec!["x"; 101].join(".")))).is_err());
    let p = Program::compile(&json!("uNdEfInEd")).unwrap();
    assert!(matches!(
        p.execute(Value::from_json(&json!({"uNdEfInEd":7})), false)
            .unwrap()
            .0,
        Value::Undefined
    ));
}

#[test]
fn array_append_at_limit_rejects() {
    let p = Program::compile(&json!(["items=RANGE(0,100000)", "items[100000]=1"])).unwrap();
    assert!(p.execute(Value::from_json(&json!({})), true).is_err());
}

#[test]
fn power_domain_rejects_nearby_bases_and_accepts_subnormal_powers() {
    let p = Program::compile(&json!("a ^ b")).unwrap();
    for a in [
        (1u64 << 50) as f64 + 1.0,
        f64::from_bits(2.0f64.to_bits() + 1),
        f64::from_bits(2.0f64.to_bits() - 1),
        f64::from_bits(3),
        f64::from_bits((1u64 << 52) - 1),
    ] {
        assert!(
            p.execute(Value::from_json(&json!({"a":a,"b":3})), true)
                .is_err(),
            "{a}"
        );
    }
    for a in [
        f64::from_bits(1),
        f64::from_bits(2),
        f64::MIN_POSITIVE,
        0.5,
        2.0,
    ] {
        let (v, _) = p
            .execute(Value::from_json(&json!({"a":a,"b":1})), true)
            .unwrap();
        assert!(matches!(v,Value::Number(v) if v.to_bits()==a.to_bits()));
    }
}

#[test]
fn json_decoder_preserves_adjacent_binary_values() {
    for text in [
        "1.9999999999999998",
        "2.0000000000000004",
        "1125899906842625",
        "5e-324",
        "2.225073858507201e-308",
    ] {
        let parsed: Json = serde_json::from_str(text).unwrap();
        assert_eq!(
            parsed.as_f64().unwrap().to_bits(),
            text.parse::<f64>().unwrap().to_bits(),
            "{text}"
        );
    }
}

#[test]
fn nested_callback_overwrites_and_error_restore_parent_slots() {
    let result = run(
        json!([
            {"map":"items","run":[
                "saved=$item",
                {"try":{"map":"inner","run":["$item=99","ABS(\"bad\")"]},"catch":"caught=$item"},
                {"return":"[$item,$index,LENGTH($array),saved,caught]"}
            ],"set":"out"},
            {"return":"out"}
        ]),
        json!({"items":[10,20],"inner":[1]}),
    );
    assert_eq!(
        result["result"],
        json!([[10.0, 0.0, 2.0, 10.0, 10.0], [20.0, 1.0, 2.0, 20.0, 20.0]])
    );
    assert!(result["input"].get("$item").is_none());
    assert!(result["input"].get("$index").is_none());
    assert!(result["input"].get("$array").is_none());
}

#[test]
fn prepared_path_segments_preserve_exact_keys_and_fresh_inputs() {
    let p = Program::compile(&json!("a.b + c")).unwrap();
    for (input, expected) in [
        (json!({"a.b":7,"a":{"b":1},"c":2}), 9.0),
        (json!({"a":{"b":10},"c":3}), 13.0),
    ] {
        let (v, _) = p.execute(Value::from_json(&input), false).unwrap();
        assert!(matches!(v,Value::Number(v) if v==expected));
    }
    assert!(
        p.execute(Value::from_json(&json!({"a":{},"c":2})), false)
            .is_err()
    );
}

#[test]
fn callback_reads_later_mutated_items_at_callback_time() {
    let value = run(
        json!({"map":"items","run":[{"if":"$index == 0","then":"items[1]=99"},{"return":"$item"}]}),
        json!({"items":[1,2]}),
    );
    assert_eq!(value["result"], json!([1.0, 99.0]));
    assert_eq!(value["input"]["items"], json!([1.0, 99.0]));
}

#[test]
fn zero_program_cache_limit_rejects_prepare_without_eviction_loop() {
    // Keep a future regression confined to a killable test subprocess.
    if std::env::var_os("RULES_MACHINE_TEST_ZERO_CACHE_CHILD").is_none() {
        use std::{
            process::{Command, Stdio},
            thread,
            time::{Duration, Instant},
        };
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "zero_program_cache_limit_rejects_prepare_without_eviction_loop",
            ])
            .env("RULES_MACHINE_TEST_ZERO_CACHE_CHILD", "1")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if let Some(status) = child.try_wait().unwrap() {
                assert!(status.success(), "cache-limit subprocess failed");
                return;
            }
            if Instant::now() > deadline {
                let _ = child.kill();
                let _ = child.wait();
                panic!("zero cache-limit prepare exceeded watchdog");
            }
            thread::sleep(Duration::from_millis(5));
        }
    }
    let mut session = Session::default();
    session.cache_limit = 0;
    assert_eq!(
        session
            .command(&json!({"op":"prepare","rules":"1"}))
            .unwrap_err(),
        "Program cache limit must be positive"
    );
    session.cache_limit = 1;
    assert_eq!(
        session
            .command(&json!({"op":"prepare","rules":"1"}))
            .unwrap()["program"],
        "p1"
    );
}

#[test]
fn aggregate_native_ranges_exhaust_work_before_retained_growth() {
    // LENGTH drops each temporary range, keeping this regression's peak memory
    // to one 100k-element range rather than retaining a dangerous nested output.
    let input = Value::from_json(&json!({"items":[0,1,2,3,4,5,6,7,8,9,10,11]}));
    let program =
        Program::compile(&json!({"map":"items","run":"LENGTH(RANGE(0,100000))"})).unwrap();
    assert_eq!(
        program.execute(input.clone(), true).unwrap_err(),
        "Evaluation step budget exceeded"
    );
    let state = input.legacy().unwrap();
    assert!(state.get("$item").is_none());
    assert!(state.get("$index").is_none());
    assert!(state.get("$array").is_none());
    assert_eq!(state["items"].as_array().unwrap().len(), 12);
}
