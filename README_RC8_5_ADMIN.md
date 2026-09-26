# RC8.5 — Admin Access

- Người dùng thường: email + mật khẩu, có thể tự đăng ký.
- Admin được whitelist theo email trong Supabase và không cần tự đăng ký trước.
- Admin nhập email quản trị trong màn hình Đăng nhập rồi chọn “Đăng nhập Admin bằng email”.
- Supabase gửi Magic Link; khi vào lại app, role `admin` được đọc từ bảng `user_roles` có RLS.
- Tài khoản admin hiện có badge ADMIN trên thanh trên cùng.
- Chế độ khách vẫn chỉ xem.
