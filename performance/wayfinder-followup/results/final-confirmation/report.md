# Paired Node workload comparison

2026-10-14T23:25:45.353Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 process blocks, 168 observations. Input reset and digest included.

| Fixture | baseline µs/op | tuned µs/op |
|---|---:|---:|
| eligibility | 93.93 | 67.69 |
| pricing-0 | 118.93 | 149.21 |
| pricing-1024 | 98.00 | 109.43 |
| pricing-32768 | 136.96 | 112.90 |
| array-map-16 | 172.71 | 178.19 |
| array-map-256 | 1268.65 | 1334.11 |
| array-map-4096 | 15953.26 | 18330.51 |

tuned: 0.99× [0.92, 1.07].
