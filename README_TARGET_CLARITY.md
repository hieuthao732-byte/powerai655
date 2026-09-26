# PowerAI 6/55 — RC6.6.1 Target Clarity

Mục tiêu của bản này: nhìn vào bất kỳ tab nào cũng biết ngay bộ số đang dành cho kỳ nào.

## A
Hiện rõ:
- Bộ A dành cho kỳ #xxxxx
- A không dùng lịch sử
- trạng thái kỳ: kỳ tiếp theo / đã khóa / đã có kết quả / xem lại

## B
Hiện rõ:
- Bộ B dành cho kỳ #xxxxx
- B chỉ dùng dữ liệu trước kỳ đó
- cutoff dữ liệu cụ thể

## C
Hiện rõ:
- Bộ C dành cho kỳ #xxxxx
- dùng khung A của cùng kỳ
- chỉ dùng dữ liệu lịch sử trước kỳ đó

## Learning / L
Hiện rõ:
- Learning học từ các kỳ đã hoàn tất trước đó
- 20 vé L được tạo riêng cho kỳ #xxxxx đang chọn
- tiêu đề 20 vé L cũng ghi trực tiếp số kỳ
- nếu kỳ đã có kết quả thì không cho tạo hoặc khóa L mới

## Bảo vệ prospective
Nếu kỳ đã có kết quả (feed hoặc log):
- không cho khóa A/B/C mới
- không cho tạo lại B/C
- không cho tạo hoặc khóa L mới
- vẫn cho xem / sao chép các snapshot đã có

Không thay đổi thuật toán A/B/C/L.
