# Gap-phase native comparison

2026-10-14T01:54:13.309Z; v26.8.2; Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz. 12 process blocks, 336 observations. Input reset and digest included.

| Fixture | baseline µs/op | upgrade µs/op | tuned µs/op | rust µs/op |
|---|---:|---:|---:|---:|
| eligibility | 180.43 | 181.40 | 25.80 | 1.14 |
| pricing-0 | 350.23 | 350.59 | 35.93 | 2.82 |
| pricing-1024 | 361.32 | 372.18 | 38.59 | 2.78 |
| pricing-32768 | 416.52 | 400.28 | 48.59 | 4.26 |
| array-map-16 | 555.16 | 562.75 | 66.45 | 5.71 |
| array-map-256 | 7865.44 | 7869.68 | 621.24 | 82.68 |
| array-map-4096 | 115540.93 | 117719.25 | 7541.14 | 1356.05 |

upgrade: 0.99× [0.98, 1.01]; tuned: 9.88× [9.74, 10.03]; rust: 105.09× [102.22, 107.69]; rustOverTuned: 10.63× [10.38, 10.90].
