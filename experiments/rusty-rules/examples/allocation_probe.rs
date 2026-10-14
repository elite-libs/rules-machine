//! Allocation-count diagnostic only: this allocator is NOT in the measured CLI.
use rusty_rules_experiment::{Program, Value, digest};
use serde_json::{Value as Json, json};
use std::{
    alloc::{GlobalAlloc, Layout, System},
    io::Read,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
};
struct Counting;
static ACTIVE: AtomicBool = AtomicBool::new(false);
static ALLOCS: AtomicU64 = AtomicU64::new(0);
static FREES: AtomicU64 = AtomicU64::new(0);
static REALLOCS: AtomicU64 = AtomicU64::new(0);
static BYTES: AtomicU64 = AtomicU64::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        if ACTIVE.load(Ordering::Relaxed) {
            ALLOCS.fetch_add(1, Ordering::Relaxed);
            BYTES.fetch_add(l.size() as u64, Ordering::Relaxed);
        }
        unsafe { System.alloc(l) }
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        if ACTIVE.load(Ordering::Relaxed) {
            FREES.fetch_add(1, Ordering::Relaxed);
        }
        unsafe { System.dealloc(p, l) }
    }
    unsafe fn realloc(&self, p: *mut u8, l: Layout, n: usize) -> *mut u8 {
        if ACTIVE.load(Ordering::Relaxed) {
            REALLOCS.fetch_add(1, Ordering::Relaxed);
            BYTES.fetch_add(n as u64, Ordering::Relaxed);
        }
        unsafe { System.realloc(p, l, n) }
    }
}
#[global_allocator]
static ALLOCATOR: Counting = Counting;
fn main() -> Result<(), String> {
    let mut text = String::new();
    std::io::stdin()
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    let request: Json = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let program = Program::compile(&request["rules"])?;
    let inputs = request["inputs"].as_array().ok_or("inputs")?;
    let iterations = request["iterations"].as_u64().unwrap_or(10);
    let outputs = inputs
        .iter()
        .map(|i| {
            let (v, i) = program.execute(Value::from_json(i), true)?;
            Ok(json!({"result":v.legacy()?,"input":i.legacy()?}))
        })
        .collect::<Result<Vec<_>, String>>()?;
    for _ in 0..2 {
        for input in inputs {
            std::hint::black_box(program.execute(Value::from_json(input), true)?);
        }
    }
    let (mut completed, mut checksum) = (0u64, 0u32);
    ACTIVE.store(true, Ordering::Relaxed);
    for _ in 0..iterations {
        for (index, input) in inputs.iter().enumerate() {
            let (v, _) = program.execute(Value::from_json(input), true)?;
            checksum = checksum.wrapping_add(digest(&v)?.wrapping_mul(index as u32 + 1));
            completed += 1;
            std::hint::black_box(v);
        }
    }
    ACTIVE.store(false, Ordering::Relaxed);
    println!(
        "{}",
        json!({"outputs":outputs,"operations":completed,"checksum":checksum,"allocations":ALLOCS.load(Ordering::Relaxed),"deallocations":FREES.load(Ordering::Relaxed),"reallocations":REALLOCS.load(Ordering::Relaxed),"bytesRequested":BYTES.load(Ordering::Relaxed)})
    );
    Ok(())
}
