//! JSON-serializable rules evaluated by the experimental Rust Rules Machine core.
//!
//! ```
//! use rules_machine::{Program, Value};
//! use serde_json::json;
//!
//! let program = Program::compile(&json!([
//!     "total = price * quantity",
//!     { "return": "total" }
//! ])).unwrap();
//! let (result, _) = program.execute(
//!     Value::from_json(&json!({ "price": 10, "quantity": 3 })),
//!     true,
//! ).unwrap();
//! assert_eq!(result.number().unwrap(), 30.0);
//! ```
//!
//! This crate re-exports the version-pinned Rust core. It implements a subset of
//! the TypeScript language, not full compatibility. Execution has cooperative
//! work limits; it is not a process sandbox or a strict memory/CPU quota.
//! Inputs must be acyclic data trees. Tracing and atomic rollback are unsupported.

pub use rules_machine_core::*;
