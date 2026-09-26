# RC6.6.4 — Manual Verification Guard

Mục tiêu: nhập bừa kết quả thủ công không được làm bẩn Learning hoặc thống kê.

## Quy tắc mới

1. Kết quả nhập tay = TẠM THỜI
- vẫn chấm A/B/C để xem ngay;
- gắn nhãn "TẠM • chưa xác nhận";
- không tính vào scoreboard chính thức;
- không dùng cho Learning.

2. Learning chỉ dùng source=feed
- không còn fallback sang log manual dù số kỳ chính thức còn ít.

3. Có thể mở tạm kỳ kế tiếp
Ví dụ feed mới tới #01402, người dùng nhập tay #01403:
- có thể bấm "Mở tạm #01404";
- A vẫn xem được vì A không cần lịch sử;
- B/C/L bị khóa chờ feed chính thức #01403.

4. B/C/L không dùng dữ liệu nhập tay
- chỉ mở khi dữ liệu chính thức đã đủ tới kỳ ngay trước target.

5. Khi feed chính thức tới
- nếu khớp manual: manual được thay bằng feed chính thức;
- nếu khác: feed ghi đè manual;
- sau đó B/C/L cho kỳ kế tiếp mới được phép chạy.

6. Trend và scoreboard
- chỉ tính các log source=feed;
- log manual vẫn hiện trong bảng lịch sử nhưng không được tính thống kê.

Không thay đổi thuật toán A/B/C/L.
