# Gap-phase native comparison

2026-10-14T01:06:00.967Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 process blocks, 336 observations. Input reset and digest included.

| Fixture | baseline µs/op | upgrade µs/op | tuned µs/op | rust µs/op |
|---|---:|---:|---:|---:|
| eligibility | 182.34 | 183.62 | 25.65 | 2.05 |
| pricing-0 | 354.25 | 367.47 | 39.28 | 4.55 |
| pricing-1024 | 370.54 | 363.72 | 38.67 | 4.67 |
| pricing-32768 | 411.22 | 407.79 | 40.86 | 5.94 |
| array-map-16 | 576.68 | 550.30 | 66.94 | 10.90 |
| array-map-256 | 8034.32 | 7743.16 | 531.79 | 412.04 |
| array-map-4096 | 119406.36 | 114444.23 | 7425.10 | 75675.84 |

upgrade: 1.00× [0.98, 1.02]; tuned: 10.06× [9.80, 10.36]; rust: 32.58× [31.15, 34.00]; rustOverTuned: 3.24× [3.12, 3.36].
