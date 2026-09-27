# PowerAI Mega 6/45 — v1 plan

Mục tiêu: mở rộng hệ sinh thái PowerAI sang Mega 6/45 nhưng giữ Power 6/55 production ổn định và không trộn logic hai game.

## Nguyên tắc kiến trúc
- Phát triển trên nhánh `feature/mega645-v1`, không sửa trực tiếp `main`.
- Power 6/55 hiện tại giữ nguyên hành vi và dữ liệu.
- Mega 6/45 có namespace/localStorage riêng để không đụng dữ liệu Power.
- Tách cấu hình game khỏi engine chung: `maxNumber=45`, `pickCount=6`, không có bóng đặc biệt/Jackpot 2 như Power 6/55.
- Kết quả xổ số là ngẫu nhiên; mọi score/AI chỉ là heuristic nghiên cứu, không trình bày như xác suất trúng.

## Phase 1 — Data + rules
- [ ] Xác nhận nguồn dữ liệu Mega 6/45 cập nhật liên tục.
- [ ] Chuẩn hóa parser lịch sử Mega 6/45.
- [ ] Kiểm tra kỳ, ngày quay và kết quả 6 số.
- [ ] Tách prize rules Mega: Jackpot 6/6, Giải Nhất 5/6, Giải Nhì 4/6, Giải Ba 3/6.
- [ ] Thêm test chấm giải độc lập.

## Phase 2 — Mega engine v1
- [ ] Port Track A sang không gian 1–45 và audit lại geometry.
- [ ] Port Track B historical heuristic sang Mega và chống data leakage.
- [ ] Port Track C hybrid theo geometry Mega.
- [ ] Để Track L ở trạng thái experimental cho tới khi có đủ log prospective Mega.
- [ ] Không dùng thông số Power 6/55 trực tiếp nếu chưa kiểm chứng lại trên 6/45.

## Phase 3 — UI
- [ ] Thêm entry rõ ràng: Power 6/55 / Mega 6/45.
- [ ] Mega có route/view riêng, không làm rối màn Power hiện tại.
- [ ] Chọn vé / Phân tích / Hiệu suất giữ cùng ngôn ngữ thiết kế.
- [ ] Result Dock Mega chỉ có 6 số chính, không hiển thị bóng vàng.
- [ ] Mobile/desktop regression test riêng.

## Phase 4 — Jackpot Economics
- [ ] Tổng số bộ Mega: C(45,6) = 8,145,060.
- [ ] Tính chi phí phủ toàn bộ tổ hợp theo giá vé cấu hình.
- [ ] Tính số vé chắc chắn đạt 5/6, 4/6, 3/6 khi phủ toàn bộ tổ hợp.
- [ ] Cho nhập Jackpot hiện tại và số người đồng trúng giả định.
- [ ] Tính gross payout, prize sharing và điểm hòa vốn theo kịch bản.
- [ ] Hiển thị cảnh báo đây là mô phỏng kinh tế, không phải khuyến nghị mua vé.

## Phase 5 — Validation + release
- [ ] Historical validation cho Mega tách biệt khỏi Power.
- [ ] Browser smoke desktop/mobile.
- [ ] Replay/lock/log regression.
- [ ] Auth/cloud namespace không đè Power.
- [ ] Vercel preview pass trước khi merge.
- [ ] Chỉ merge khi Power 6/55 không có regression.

## Release target
- `MegaAI 6/45 v1` chạy song song với `PowerAI 6/55 v1 stable`.
