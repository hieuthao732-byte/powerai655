# PowerAI 6/55 — Stabilization v1

Mục tiêu: đóng băng tính năng, giảm rủi ro hồi quy, gom code vá RC8.x–RC9.x về source sạch, và chỉ merge vào `main` sau khi build + smoke test ổn.

## Baseline
- Production baseline commit: `0062f021b4ac4115826195bcc0a7c153996ce409`
- Stable snapshot branch: `stable/powerai655-v1`
- Working branch: `stabilization/v1`

## Phase 1 — Freeze & audit
- [x] Tạo stable snapshot từ production hiện tại.
- [x] Tạo nhánh stabilization riêng, không sửa production trực tiếp.
- [x] Gỡ workflow cũ/hỏng không còn dùng.
- [x] Kiểm kê toàn bộ chuỗi build patch (`build.mjs`, `rc89.mjs`, `rc90.mjs`, `rc91.mjs`, `rc92.mjs`, `rc93.mjs`, `rc94.mjs`, `rc96.mjs`, `rc97.mjs`, `rc89-fix.mjs`).
- [x] Ghi lại trạng thái source/post-build trong `SOURCE_CONSOLIDATION.md`.

## Phase 2 — Source consolidation
- [x] Materialize UI + logic RC8.9–RC9.7 vào `app.js`, `index.html`, `style.css`.
- [x] Rút `build.mjs` về build/copy thuần, không dùng chuỗi replace dễ gãy.
- [x] Xóa toàn bộ `rc*.mjs` sau khi behavior đã được materialize.
- [x] Giữ nguyên localStorage keys, Supabase/auth integration, lock/log format và URL production.

## Phase 3 — Regression checks
- [x] Build sạch từ đầu và kiểm tra source = dist cho app/index/style/auth.
- [x] Thêm GitHub Actions `Stabilization Checks` để chặn việc quay lại chuỗi post-build patch.
- [x] Chuyển kỳ mới / kỳ cũ / replay và quay lại kỳ prospective.
- [x] A/B/C/L render đúng; khóa không làm đổi A/B/C đang được tạo cho kỳ.
- [x] Hit số chính màu xanh; số đặc biệt màu vàng.
- [x] JP1 / JP2 / Nhất / Nhì / Ba chấm đúng.
- [x] Result Dock hoạt động ở desktop + mobile.
- [x] Number Intelligence 01–55 dùng dữ liệu trước kỳ mục tiêu.
- [x] Performance Center A/B/C/L chỉ tính log feed official theo thiết kế hiện tại.
- [x] Guest read-only + màn hình login/signup + cloud hydrate/save/logout bridge không vỡ. CI dùng mock cloud, không ghi dữ liệu Supabase thật.
- [x] Khóa A/B/C và L giữ nguyên semantics prospective và còn nguyên sau khi đi replay rồi quay lại.

## Phase 4 — Release candidate
- [x] Tạo preview deployment từ nhánh stabilization và Vercel build thành công sau consolidation.
- [x] Smoke test desktop tự động bằng Chromium.
- [x] Smoke test mobile 390×844 tự động bằng Chromium.
- [ ] So sánh UI/behavior với stable snapshot bằng kiểm tra trực quan cuối cùng.
- [ ] Xác minh đăng nhập thật trên preview bằng một tài khoản test trước khi merge (không chạy credential thật trong GitHub Actions).
- [ ] Chỉ merge về `main` sau khi không còn blocker.

## Regression automation hiện có
- `tests/browser-smoke.mjs`: navigation, A/B/C/L UI, Result Dock, Number Intelligence anti-leak, Performance official-feed-only, prize rules, hit xanh/bóng vàng, desktop/mobile overflow.
- `tests/state-regression.mjs`: auth shell, A/B/C/L lock persistence, previous/next + replay, cloud hydrate/save/logout bằng mock.

## Nguyên tắc trong giai đoạn ổn định hóa
1. Không thêm feature lớn mới vào Power 6/55 cho tới khi source consolidation xong.
2. Không đổi thuật toán A/B/C/L nếu không phải bug fix rõ ràng.
3. Không đổi schema cloud hoặc key localStorage trong refactor.
4. Mỗi thay đổi rủi ro cao phải làm trên `stabilization/v1`, không sửa trực tiếp `main`.
5. `stable/powerai655-v1` là mốc rollback của bản đang chạy ổn.
