# Track D — Adaptive Challenger Engine

## Mục tiêu
Track D là một engine thử nghiệm riêng, không thay A/B/C/L. Nó theo dõi kết quả **prospective đã khóa + feed chính thức**; khi hiệu suất nhiều kỳ liên tiếp yếu thì không tự ý “đuổi theo chuỗi thua”, mà mở một challenger dùng ma trận/feature family khác, chạy shadow rồi mới cho phép thay engine đang dùng.

> Xổ số vẫn là ngẫu nhiên. Track D là cơ chế nghiên cứu thích nghi và kiểm chứng out-of-sample, không phải cam kết tăng xác suất trúng.

## Nguyên tắc an toàn thống kê
- Chỉ học/cập nhật sau khi kỳ đã có `source === "feed"`.
- Manual result và Replay tuyệt đối không cập nhật D.
- Không dùng draw mục tiêu hoặc draw tương lai để build feature.
- Tối thiểu 12 kỳ official của D trước khi cho phép đánh giá “không khả quan”.
- Cooldown tối thiểu 8 kỳ sau mỗi lần đổi engine để tránh đổi vì nhiễu ngắn hạn.
- Challenger phải chạy shadow ít nhất 6 kỳ trước khi có quyền được promote.
- Luôn giữ snapshot engine cũ để rollback và audit.

## Champion / Challenger
### Champion
Engine D đang tạo 20 vé prospective chính thức.

### Challenger
Engine thay thế được tạo khi drift trigger bật. Challenger chạy song song nhưng chỉ lưu shadow score, chưa thay bộ D chính.

### Promote
Chỉ promote challenger nếu sau cửa sổ shadow:
1. Có đủ >= 6 kỳ official;
2. Metric tổng hợp challenger cao hơn champion với biên tối thiểu;
3. Không vi phạm geometry/diversity guard;
4. Không có leakage.

Nếu không đạt, challenger bị reject và champion tiếp tục.

## Drift trigger
Đánh giá trên rolling 12 kỳ official gần nhất của D:
- `avgBest`
- số kỳ `Best >= 3`
- số kỳ `Best >= 4`
- tổng số vé >= 3
- prize count (JP1/JP2/Nhất/Nhì/Ba)

Trigger mặc định khi đồng thời:
- đủ >= 12 kỳ;
- 8 kỳ cooldown đã qua;
- `avgBest` thấp hơn baseline trung tính hoặc không cải thiện qua 2 cửa sổ;
- không có tín hiệu giải cao đủ mạnh để giữ nguyên cấu hình.

Drift trigger chỉ mở challenger, không tự khẳng định phân phối xổ số đã “đổi chế độ”.

## Bộ expert / ma trận mới
Track D dùng 3 expert khác B/C để giảm tương quan mô hình.

### D1 — Residual Pair Matrix
Thay vì dùng pair count thô, dùng residual so với kỳ vọng độc lập:
`R(i,j) = observed_pair(i,j) - expected_pair(i,j)`
Sau đó shrink về 0 với cặp có ít dữ liệu.

Mục tiêu: tránh việc số xuất hiện nhiều kéo pair score lên giả tạo.

### D2 — Gap Transition Matrix
Theo dõi trạng thái gap của từng số theo bucket:
- short
- normal
- long
- extreme

Học ma trận chuyển trạng thái giữa các kỳ và score theo trạng thái hiện tại. Đây là mô tả chuỗi gap, không giả định có “đến lượt phải ra”.

### D3 — Shape-Conditional Matrix
Mỗi draw được mô tả bằng shape:
- sum bucket
- odd/even
- low/high
- spread/range
- consecutive count

Tìm các draw lịch sử có shape gần vùng hiện tại rồi xây pair/frequency matrix có shrinkage. Nếu sample quá ít thì fallback về unconditional matrix.

## Ensemble weight
Ba expert tạo score số/cặp riêng. Weight khởi tạo đều:
- D1: 1/3
- D2: 1/3
- D3: 1/3

Sau mỗi official draw, update kiểu multiplicative-weights nhưng có cap:
- min mỗi expert: 0.15
- max mỗi expert: 0.60

Mục tiêu là thích nghi vừa phải, tránh một expert thắng vài kỳ rồi chiếm 100%.

## Sinh 20 vé D
- 20 x 6 số.
- Diversity penalty giữa các vé.
- Number exposure có giới hạn cứng.
- Pair reuse penalty.
- Không copy trực tiếp geometry A/C.
- Portfolio score = ensemble node score + residual pair score + diversity reward - concentration penalty.

## Shadow evaluation
Mỗi prospective target lưu:
- champion engine id + weights
- challenger engine id + weights nếu có
- 20 vé champion
- 20 vé challenger shadow
- cutoff id
- model hash

Sau feed chính thức, score cả hai bằng cùng hàm prize/hit.

## Promotion metric
Không dùng một kỳ đơn lẻ. Dùng composite 6+ kỳ:
- 45% avg best-hit
- 25% rate Best >= 3
- 20% rate Best >= 4
- 10% portfolio total-hit normalized

Giải thưởng thật được hiển thị riêng, không biến Jackpot hiếm thành weight quá lớn khiến model overfit.

## UI dự kiến
Trong tab D:
- trạng thái: `STABLE`, `CHALLENGER TEST`, `REBUILD COOLDOWN`
- engine hiện tại
- weights D1/D2/D3
- số kỳ từ lần rebuild gần nhất
- rolling 12 kỳ
- lý do trigger
- challenger progress `x/6 kỳ`
- lịch sử promote/reject

Trong Hiệu suất:
- thêm D vào bảng A/B/C/L/D
- thêm cột `Engine D version`
- riêng mục “Adaptive history” cho biết lúc nào D đổi engine và kết quả trước/sau.

## V1 triển khai
1. Tách core matrix/feature builders thuần hàm.
2. Thêm D1/D2/D3 + ensemble score.
3. Sinh portfolio D 20 vé và lock snapshot.
4. Score prospective official logs.
5. Drift detector 12 kỳ + cooldown.
6. Challenger shadow 6 kỳ.
7. Promotion/reject logic.
8. Performance Center + browser/state tests.

## Không làm trong V1
- Không tự tối ưu hàng trăm hyperparameter sau mỗi draw.
- Không backfit toàn bộ lịch sử để chọn engine thắng nhất rồi gọi đó là “dự đoán”.
- Không dùng manual result để train.
- Không thay A/B/C/L khi D hoạt động kém.
