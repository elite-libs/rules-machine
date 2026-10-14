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
