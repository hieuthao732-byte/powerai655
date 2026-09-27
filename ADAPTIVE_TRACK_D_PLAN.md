# Track D — Adaptive Research Engine

## Mục tiêu
Track D là một engine nghiên cứu thích nghi riêng, không thay A/B/C/L. Nó theo dõi kết quả **prospective đã khóa + feed chính thức**; khi hiệu suất nhiều kỳ liên tiếp yếu thì mở challenger dùng ma trận/feature family khác, chạy shadow rồi mới cho phép thay engine đang dùng.

> Xổ số vẫn là ngẫu nhiên. Track D là cơ chế nghiên cứu thích nghi và kiểm chứng out-of-sample, không phải cam kết tăng xác suất trúng.

## Nguyên tắc an toàn thống kê
- Chỉ học/cập nhật sau khi kỳ đã có `source === "feed"`.
- Manual result và Replay tuyệt đối không cập nhật D.
- Không dùng draw mục tiêu hoặc draw tương lai để build feature.
- Tối thiểu 12 kỳ official của D trước khi cho phép đánh giá “không khả quan”.
- Cooldown tối thiểu 8 kỳ sau mỗi lần đổi engine để tránh đổi vì nhiễu ngắn hạn.
- Challenger phải chạy shadow ít nhất 6 kỳ trước khi có quyền được promote.
- Luôn giữ snapshot engine cũ để rollback và audit.
- Nếu không vượt matched-random baseline thì hiển thị `NO EDGE DETECTED`, không tô đẹp score.

## Champion / Challenger
### Champion
Engine D đang tạo 20 vé prospective chính thức.

### Challenger
Engine thay thế được tạo khi drift trigger bật. Challenger chạy song song nhưng chỉ lưu shadow score, chưa thay bộ D chính.

### Promote
Chỉ promote challenger nếu sau cửa sổ shadow:
1. Có đủ >= 6 kỳ official;
2. Metric tổng hợp challenger cao hơn champion với biên tối thiểu;
3. Không vi phạm geometry/diversity/entropy guard;
4. Không có leakage;
5. Vượt stress test và matched-random benchmark;
6. Không chỉ thắng do một kỳ outlier.

Nếu không đạt, challenger bị reject và champion tiếp tục.

## Drift trigger
Đánh giá trên rolling 12 kỳ official gần nhất của D:
- `avgBest`
- số kỳ `Best >= 3`
- số kỳ `Best >= 4`
- tổng số vé >= 3
- prize count (JP1/JP2/Nhất/Nhì/Ba)
- matched-null delta
- expert disagreement

Trigger mặc định khi đồng thời:
- đủ >= 12 kỳ;
- 8 kỳ cooldown đã qua;
- `avgBest` không vượt matched-random baseline hoặc không cải thiện qua 2 cửa sổ;
- không có tín hiệu giải cao đủ mạnh để giữ nguyên cấu hình.

Drift trigger chỉ mở challenger, không tự khẳng định phân phối xổ số đã “đổi chế độ”.

## Bộ expert / ma trận
### D1 — Residual Pair Matrix
Thay vì dùng pair count thô, dùng residual so với kỳ vọng độc lập:
`R(i,j) = observed_pair(i,j) - expected_pair(i,j)`.
Residual được shrink về 0 khi sample yếu.

### D2 — Gap Transition Matrix
Theo dõi trạng thái gap theo bucket `short / normal / long / extreme`, học xác suất chuyển và mức hit sau từng trạng thái. Không dùng logic “đến lượt phải ra”.

### D3 — Shape-Conditional Matrix
Mô tả draw bằng sum, odd/even, low/high, spread, consecutive. Dùng shape của draw đã biết trước target làm context để học phản ứng của draw kế tiếp, không dùng shape tương lai.

### D4 — Spectral Residual Graph
Biến residual pair matrix thành graph. Dùng low-rank / spectral centrality trên phần residual dương để tìm cấu trúc cụm yếu nhưng ổn định mà pair count đơn lẻ khó thấy.

## Multi-horizon consensus
Mỗi expert chạy trên các cửa sổ mặc định `30 / 60 / 120 / 250` kỳ. Tín hiệu chỉ được cộng mạnh nếu rank tương đối ổn định qua nhiều horizon.

## Stability Selection
- So rank của số/cặp qua nhiều horizon.
- Sau này mở rộng bootstrap/jackknife.
- Feature/number/pair có rank biến động mạnh bị stability penalty.

## Ensemble weight
D1–D4 khởi tạo ngang nhau. Sau mỗi official draw, weight cập nhật chậm theo multiplicative weights và có cap để không expert nào chiếm toàn bộ.

Hai tốc độ thích nghi:
- `fast/slow weights`: thay đổi nhỏ sau mỗi feed official;
- `architecture`: chỉ thay khi drift trigger bật + challenger thắng shadow/stress test.

## Sinh 20 vé D
- 20 x 6 số.
- Diversity penalty giữa các vé.
- Number exposure có giới hạn cứng.
- Pair reuse penalty.
- Dynamic entropy guard.
- Không copy trực tiếp geometry A/C.
- Orthogonality guard sẽ phạt nếu D quá giống A/B/C/L.
- Portfolio score = ensemble node score + residual pair support + diversity reward - concentration/shape penalty.

## Matched-random null benchmark
Không so D với random tùy ý. Null portfolio được tạo bằng cách **relabel toàn bộ số của cùng một incidence portfolio**, nhờ đó giữ nguyên geometry, exposure, pair reuse và overlap. Sau kết quả official, D so best-hit/total-hit với nhiều relabel ngẫu nhiên để biết kết quả có vượt baseline cấu trúc hay không.

## Confidence gate
Nếu D1–D4 bất đồng mạnh, D vào `LOW CONFIDENCE`; hệ thống không ép promote/rebuild chỉ vì một tín hiệu mạnh đơn lẻ.

## Feature quarantine / auto retirement
Expert suy giảm kéo dài có thể bị giảm weight, `QUARANTINED`, rồi `RETIRED`. Muốn quay lại phải qua shadow retest với giả thuyết mới.

## Engine memory bank / negative knowledge
Lưu toàn bộ version đã chạy, lý do thay đổi, shadow result, promote/reject/retire. Engine từng fail không được tự động dùng lại nếu không có bằng chứng hoặc feature mới.

## Hypothesis registry
Mỗi challenger trước khi chạy phải khóa trước:
- vấn đề cần sửa;
- thay đổi cụ thể;
- success metric;
- số kỳ official tối thiểu;
- điều kiện reject.

Không được đổi metric giữa chừng sau khi nhìn thấy kết quả.

## Candidate tournament
Tối đa 2 challenger song song để tránh multiple-testing quá mức. Challenger mới phải khác nhau có chủ đích, không sinh hàng trăm biến thể rồi chọn cái may mắn nhất.

## Stress test trước promote
- đổi horizon hợp lý;
- bỏ một phần draw lịch sử;
- perturb weight nhỏ;
- kiểm tra exposure/entropy;
- kiểm tra performance không phụ thuộc 1 outlier.

Challenger chỉ promote nếu ưu thế vẫn giữ qua các perturbation.

## Failure Diagnosis
Khi D yếu, phải phân loại nguyên nhân trước khi sinh challenger:
- ranking số yếu;
- pair residual không đóng góp;
- shape context không ổn định;
- spectral graph nhiễu;
- portfolio quá tập trung;
- expert disagreement cao;
- không khác matched random.

Chẩn đoán quyết định loại mutation/challenger sẽ được thử.

## D5+ roadmap nghiên cứu
- **D5 Counterfactual Lab:** mutation có kiểm soát để biết thay đổi nào thực sự tạo khác biệt.
- **D6 Change-point Detector:** detector chỉ trên residual performance so với null, kèm shuffled-control.
- **D7 Marginal Coverage Optimizer:** ưu tiên phần coverage mà A/B/C/L chưa phủ.
- **D8 Bayesian Promotion Gate:** shrink về giả thuyết không khác biệt, cần đủ bằng chứng mới promote.
- **D9 Failure Diagnosis:** chọn đúng challenger cho đúng lỗi.
- **D10 Negative Knowledge:** nhớ cả phương pháp thất bại.
- **D11 Hypothesis Registry:** preregister test trước khi chạy.
- **D12 Engine Lineage:** lưu cây phiên bản và mutation.
- **D13 Auto Retirement:** loại expert lâu dài không có đóng góp.
- **D14 Reproducibility Guard:** dựng lại đúng model/vé bằng target + cutoff + version + seed + hash.

## Shadow evaluation
Mỗi prospective target lưu:
- champion engine id + weights;
- challenger engine id + weights nếu có;
- 20 vé champion;
- 20 vé challenger shadow;
- cutoff id;
- seed + model hash + portfolio hash;
- confidence state;
- hypothesis id.

Sau feed chính thức, score cả hai bằng cùng hàm prize/hit và matched-null benchmark.

## Promotion metric
Không dùng một kỳ đơn lẻ. Composite 6+ kỳ ban đầu:
- 45% avg best-hit;
- 25% rate Best >= 3;
- 20% rate Best >= 4;
- 10% portfolio total-hit normalized.

Giải thưởng thật được hiển thị riêng, không biến Jackpot hiếm thành weight quá lớn khiến model overfit.

## UI dự kiến
Trong tab D:
- `STABLE`, `CHALLENGER TEST`, `LOW CONFIDENCE`, `REBUILD COOLDOWN`, `NO EDGE DETECTED`;
- engine hiện tại + lineage;
- weights D1/D2/D3/D4;
- rolling 12 kỳ;
- matched-null delta;
- lý do trigger;
- challenger progress `x/6 kỳ`;
- hypothesis;
- lịch sử promote/reject/retire.

Trong Hiệu suất:
- thêm D vào A/B/C/L/D;
- `Engine D version`;
- Adaptive history trước/sau mỗi mutation;
- số lần D vượt/null không vượt matched random.

## Trạng thái triển khai
### Phase 1 — Core research engine
- [x] D1 Residual Pair Matrix
- [x] D2 Gap Transition
- [x] D3 Shape-Conditional
- [x] D4 Spectral Residual Graph
- [x] Multi-horizon consensus 30/60/120/250
- [x] Stability penalty
- [x] Deterministic 20-ticket portfolio core
- [x] Matched-random relabel benchmark
- [x] Drift detector core
- [x] Promotion composite core
- [x] Confidence gate
- [x] Research state / hypothesis / retirement primitives
- [x] Deterministic unit tests

### Phase 2 — App integration
- [ ] Tab D UI
- [ ] D lock/snapshot prospective
- [ ] D official score/log
- [ ] D cloud state
- [ ] Performance Center A/B/C/L/D
- [ ] Shadow challenger storage

### Phase 3 — Adaptive automation
- [ ] Weight reward update from official outcomes
- [ ] Feature quarantine
- [ ] Challenger tournament
- [ ] Stress-test promote gate
- [ ] Failure diagnosis
- [ ] Engine lineage/memory UI
- [ ] Orthogonality vs A/B/C/L

## Không làm
- Không tự tối ưu hàng trăm hyperparameter sau mỗi draw.
- Không backfit toàn bộ lịch sử để chọn engine thắng nhất rồi gọi đó là “dự đoán”.
- Không dùng manual result để train.
- Không thay A/B/C/L khi D hoạt động kém.
- Không biến score nội bộ thành xác suất trúng.
