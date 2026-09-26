# PowerAI 6/55 — RC7.0 A Simulation Optimizer

Track A cũ đã được thay thế hoàn toàn cho các kỳ chưa khóa.

## A7 làm gì?
- Không dùng lịch sử xổ số.
- Sinh tối đa 72 cấu trúc 20 vé hợp lệ.
- Mọi cấu trúc đều giữ: 55/55 số, 45 số ×2, 10 số ×3, không lặp cặp, hai vé trùng tối đa 1 số.
- Dùng hai ngân hàng mô phỏng ngẫu nhiên chung để lọc cấu trúc ổn định.
- Lấy nhóm tốt nhất sang vòng final simulation.
- Sau khi chọn xong, đánh giá lại trên một mẫu hiển thị độc lập.
- Mục tiêu chính: coverage của Best >=3; mục tiêu phụ: Best-hit trung bình và độ cân bằng cấu trúc.

## Xếp hạng từng vé A
Không còn dùng điểm đơn giản triple-count/contact.
Mỗi vé được chấm theo đóng góp trong mô phỏng:
- số lần là vé tốt nhất duy nhất;
- top-credit khi hòa best;
- số lần đạt >=3;
- marginal improvement khi bỏ vé đó sẽ làm best-hit giảm.

## Tương thích C
A7 vẫn giữ toàn bộ invariant hình học cũ, vì vậy C vẫn dùng A làm skeleton mà không phải đổi thuật toán C.

## Snapshot cũ
Các kỳ đã khóa từ A cũ không bị viết lại. Đây là yêu cầu bắt buộc để giữ prospective evaluation công bằng. A7 chỉ áp dụng cho target chưa khóa.

## Lưu ý
Mô phỏng dùng phân phối xổ số ngẫu nhiên đồng nhất. Nó tối ưu cấu trúc danh mục vé, không tạo bằng chứng rằng số nào có xác suất ra cao hơn.
