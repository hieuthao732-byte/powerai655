# RC8.2 — Auth Non-Blocking Fix

- Loại bỏ thẻ Supabase CDN đồng bộ khỏi `index.html` để CDN không thể chặn toàn bộ `app.js`.
- App chính và nút Đăng nhập khởi tạo ngay, độc lập với mạng/CDN Supabase.
- Supabase SDK được tải động có timeout và fallback CDN.
- `load()` dữ liệu Vietlott chạy song song, không phải chờ Auth SDK.
- Không thay đổi thuật toán A/B/C/L hoặc schema cloud.

- Nút mở/đóng modal có fallback HTML trực tiếp: modal vẫn mở ngay cả khi `app.js` hoặc CDN Auth gặp lỗi.
