# PowerAI 6/55 — Stabilization v1

Mục tiêu: đóng băng tính năng, giảm rủi ro hồi quy, gom code vá RC8.x–RC9.x về source sạch, và chỉ merge vào `main` sau khi build + smoke test ổn.

## Baseline
- Production baseline commit: `0062f021b4ac4115826195bcc0a7c153996ce409`
- Stable snapshot branch: `stable/powerai655-v1`
- Working branch: `stabilization/v1`

## Phase 1 — Freeze & audit
- [x] Tạo stable snapshot từ production hiện tại.
- [x] Tạo nhánh stabilization riêng, không sửa production trực tiếp.
- [ ] Gỡ workflow cũ/hỏng không còn dùng.
- [ ] Kiểm kê toàn bộ chuỗi build patch (`build.mjs`, `rc89.mjs`, `rc90.mjs`, `rc91.mjs`, `rc92.mjs`, `rc93.mjs`, `rc94.mjs`, `rc96.mjs`, `rc97.mjs`).
- [ ] Ghi rõ chức năng nào thuộc source gốc và chức năng nào chỉ tồn tại ở post-build patch.

## Phase 2 — Source consolidation
- [ ] Materialize UI + logic RC8.9–RC9.7 vào `app.js`, `index.html`, `style.css`.
- [ ] Rút `build.mjs` về build/copy thuần, không dùng chuỗi replace dễ gãy.
- [ ] Xóa các patch file đã được materialize.
- [ ] Giữ nguyên localStorage keys, Supabase schema, lock/log format và URL production.

## Phase 3 — Regression checks
- [ ] Build sạch từ đầu.
- [ ] Chuyển kỳ mới / kỳ cũ / replay.
- [ ] A/B/C/L render đúng và không đổi portfolio khi không có chủ đích.
- [ ] Hit số chính màu xanh; số đặc biệt màu vàng.
- [ ] JP1 / JP2 / Nhất / Nhì / Ba chấm đúng.
- [ ] Result Dock hoạt động ở desktop + mobile.
- [ ] Number Intelligence 01–55 dùng dữ liệu trước kỳ mục tiêu.
- [ ] Performance Center A/B/C/L chỉ tính log feed official theo thiết kế hiện tại.
- [ ] Guest read-only / login / logout / cloud state không vỡ.
- [ ] Khóa A/B/C và L giữ nguyên semantics prospective.

## Phase 4 — Release candidate
- [ ] Tạo preview deployment từ nhánh stabilization.
- [ ] Smoke test desktop.
- [ ] Smoke test mobile.
- [ ] So sánh UI/behavior với stable snapshot.
- [ ] Chỉ merge về `main` sau khi không còn blocker.

## Nguyên tắc trong giai đoạn ổn định hóa
1. Không thêm feature lớn mới vào Power 6/55 cho tới khi source consolidation xong.
2. Không đổi thuật toán A/B/C/L nếu không phải bug fix rõ ràng.
3. Không đổi schema cloud hoặc key localStorage trong refactor.
4. Mỗi thay đổi rủi ro cao phải làm trên `stabilization/v1`, không sửa trực tiếp `main`.
5. `stable/powerai655-v1` là mốc rollback của bản đang chạy ổn.
