# PowerAI RC8.3 — Direct Auth + Guest Read-Only

## Fix đăng nhập
- Bỏ hoàn toàn phụ thuộc CDN Supabase JS cho nút đăng nhập/đăng ký.
- `auth.js` gọi trực tiếp Supabase Auth HTTP API bằng publishable key.
- Khi bấm Đăng nhập/Đăng ký, giao diện phản hồi ngay bằng trạng thái đang xử lý.
- Phiên đăng nhập được lưu cục bộ và tự refresh bằng refresh token.
- Đồng bộ `user_app_state` dùng trực tiếp Supabase PostgREST + JWT của user, vẫn chịu RLS.

## Chế độ khách
- Mặc định trang ở `guestMode`.
- Toàn bộ `<main>` được đặt `inert` khi chưa đăng nhập: người dùng chỉ xem/scroll, không click/nhập/khóa/chạy Learning.
- Khu đăng nhập nằm ngoài `<main>` nên vẫn tương tác bình thường.
- Sau đăng nhập, `inert` được gỡ và app hoạt động theo quyền/trạng thái hiện có.
- Đăng xuất lập tức trở lại read-only và dọn cache PowerAI cá nhân trên thiết bị.
