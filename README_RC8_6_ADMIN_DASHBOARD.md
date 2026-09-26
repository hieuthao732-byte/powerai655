# RC8.6 — Admin Dashboard + Account Delete

- Admin dùng email + mật khẩu bình thường; role ADMIN được xác nhận từ Supabase, bỏ Magic Link để tránh quota email.
- Admin Dashboard: tổng tài khoản, email đã xác nhận, hoạt động 7 ngày, trạng thái lock, sync gần nhất.
- Admin có thể khóa/mở tài khoản khác và cấp USER/ADMIN; tài khoản admin chính được bảo vệ.
- Dashboard không hiển thị bộ số riêng của user.
- User có mục Tài khoản và có thể tự hủy tài khoản bằng xác nhận hai bước; xóa tài khoản Auth và dữ liệu cloud liên quan.
- Admin không thể tự hủy từ web.
