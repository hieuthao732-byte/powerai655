# PowerAI Mega 6/45 — v1 plan

Mục tiêu: mở rộng hệ sinh thái PowerAI sang Mega 6/45 nhưng giữ Power 6/55 production ổn định và không trộn logic hai game.

## Nguyên tắc kiến trúc
- Phát triển trên nhánh `feature/mega645-v1`, không sửa trực tiếp `main`.
- Power 6/55 hiện tại giữ nguyên hành vi và dữ liệu.
- Mega 6/45 có namespace/localStorage riêng để không đụng dữ liệu Power.
- Tách cấu hình game khỏi engine chung: `maxNumber=45`, `pickCount=6`, không có bóng đặc biệt/Jackpot 2 như Power 6/55.
- Kết quả xổ số là ngẫu nhiên; mọi score/AI chỉ là heuristic nghiên cứu, không trình bày như xác suất trúng.

## Phase 1 — Data + rules
- [x] Xác nhận nguồn dữ liệu Mega 6/45: `data/power645.jsonl`, cập nhật tới kỳ #01568 ngày 27/09/2026 tại thời điểm audit.
- [x] Chuẩn hóa parser lịch sử Mega 6/45: 6 số duy nhất trong 01–45.
- [x] Kiểm tra kỳ, ngày quay và kết quả 6 số.
- [x] Tách prize rules Mega: Jackpot 6/6, Giải Nhất 5/6, Giải Nhì 4/6, Giải Ba 3/6.
- [ ] Thêm unit test độc lập cho hàm chấm giải bằng synthetic tickets (browser replay hiện đã được smoke test).

## Phase 2 — Mega engine v1
- [x] Port Track A sang không gian 1–45: 20 vé × 6, exposure 2–3 lần/số, history-blind, giảm lặp pair/overlap.
- [x] Port Track B historical heuristic sang Mega: freq 30/120 + gap + pair 120 + cấu trúc ticket; history luôn `id < target`.
- [x] Port Track C hybrid: giữ exposure 2–3, chọn 30 số triple-exposure theo signal B.
- [x] Track L chưa port; giữ experimental cho tới khi Mega có đủ log prospective riêng.
- [x] Không dùng nguyên geometry 6/55; Mega có balanced geometry riêng cho 45 số.

## Phase 3 — UI
- [ ] Thêm entry hai chiều rõ ràng Power 6/55 / Mega 6/45 trên homepage Power (Mega đã có link quay về Power).
- [x] Mega có route/view riêng `/mega.html`, không làm rối màn Power hiện tại.
- [x] Chọn vé / Phân tích / Jackpot Economics dùng cùng ngôn ngữ thiết kế PowerAI.
- [x] Result Dock Mega chỉ có 6 số chính, không hiển thị bóng vàng.
- [x] Mobile/desktop regression test riêng cho Mega.

## Phase 4 — Jackpot Economics
- [x] Tổng số bộ Mega: C(45,6) = 8,145,060.
- [x] Tính chi phí phủ toàn bộ tổ hợp theo giá vé cấu hình.
- [x] Tính số vé chắc chắn: 234 vé 5/6, 11.115 vé 4/6, 182.780 vé 3/6.
- [x] Cho nhập Jackpot hiện tại và số người đồng trúng giả định.
- [x] Tính gross payout, prize sharing và điểm hòa vốn trước thuế.
- [x] Hiển thị cảnh báo đây là mô phỏng kinh tế, không phải khuyến nghị mua vé; chưa tính thuế/giới hạn vận hành.

## Phase 5 — Validation + release
- [ ] Historical validation riêng cho Mega.
- [x] Browser smoke desktop/mobile Mega PASS.
- [ ] Lock/log prospective Mega và regression tương ứng.
- [x] Namespace localStorage Mega tách Power; auth/cloud Mega chưa bật nên chưa có nguy cơ ghi đè cloud Power.
- [x] Vercel preview pass.
- [x] Power 6/55 browser + state regression tiếp tục PASS trong cùng workflow.
- [ ] Chỉ merge khi hoàn tất entry Power→Mega, prize unit test và quyết định semantics lock/log v1.

## Trạng thái preview hiện tại
- `mega.html` — UI độc lập.
- `mega.js` — feed/parser + A/B/C + replay + Number Intelligence + Jackpot Economics.
- `mega.css` — responsive desktop/mobile.
- `tests/mega-smoke.mjs` — 20 vé A/B/C, 45 số, anti-leak cutoff, replay, economics, không special ball, mobile layout.
- `build.mjs` — copy cả PowerAI và MegaAI vào `dist`.

## Release target
- `MegaAI 6/45 v1` chạy song song với `PowerAI 6/55 v1 stable`.
