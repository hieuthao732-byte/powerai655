# Bộ D — Tự kiểm tra và điều chỉnh

## Tiến độ
- Bước 1 — Phần tính toán của D: xong
- Bước 2 — Đưa D vào web Power: xong
- Bước 3 — Theo dõi kết quả và thử cách mới khi cần: xong
- Bước 4 — Khu kiểm tra riêng: xong
- Bước 5 — Kiểm tra bộ D đã khóa có dựng lại đúng hay không: xong
- Bước 6 — Kiểm tra toàn bộ trước khi đưa lên bản chính: đang làm

## D đang dùng 4 cách phân tích
- D1 — Liên kết cặp số: xem cặp số nào nổi bật hơn mức bình thường.
- D2 — Nhịp xuất hiện: theo dõi khoảng cách giữa các lần xuất hiện của từng số.
- D3 — Mẫu kỳ quay: xem tổng, chẵn/lẻ, thấp/cao, độ trải và số liên tiếp.
- D4 — Mạng liên kết số: nhìn quan hệ giữa nhiều số cùng lúc.
- D xem nhiều khoảng dữ liệu: 30 / 60 / 120 / 250 kỳ.
- Mỗi kỳ D tạo 20 vé riêng, hạn chế trùng vé, trùng cặp và dồn quá nhiều vào vài số.
- D luôn so kết quả của mình với các bộ ngẫu nhiên có cách phân bổ số tương tự.

## Khi D hoạt động kém nhiều kỳ
- D không đổi cách chọn ngay chỉ vì vài kỳ xấu.
- Nếu kết quả yếu kéo dài, D mở tối đa 2 cách thử mới.
- Cách thử mới chạy riêng ít nhất 6 kỳ có kết quả chính thức.
- Chỉ khi kết quả tốt hơn và vẫn ổn qua các bài kiểm tra thì mới được thay cách đang dùng.
- Nếu không tốt hơn rõ ràng thì loại.
- Một cách phân tích yếu kéo dài có thể bị giảm ảnh hưởng hoặc tạm ngừng.
- D lưu lại những cách đã thử, kết quả ra sao và lý do giữ hay loại.

## Khu kiểm tra riêng
- Kiểm tra lại từng kỳ chỉ bằng dữ liệu có trước kỳ đó.
- Thử bỏ bớt một số kỳ hoặc thay đổi nhẹ mức ảnh hưởng để xem kết quả có còn ổn không.
- So D với nhiều bộ ngẫu nhiên có cùng cách phân bổ số.
- Kiểm tra xem D có bổ sung vùng số/cặp khác A/B/C/L hay chỉ đang lặp lại chúng.
- Phần kiểm tra này chỉ để đánh giá, không được tính ngược thành dự đoán chính thức.

## Kiểm tra bộ D đã khóa
Mỗi bộ D đã khóa trước kỳ quay sẽ lưu:
- phiên bản D;
- mã bộ 20 vé;
- dữ liệu được dùng đến kỳ nào;
- số dùng để dựng lại đúng bộ vé;
- cấu hình tạo vé.

Khi có kết quả chính thức, hệ thống phải dựng lại đúng bộ D đã khóa. Nếu không khớp thì kỳ đó bị đánh dấu **KHÔNG HỢP LỆ** và không được dùng để D tự điều chỉnh.

## Điều kiện trước khi đưa lên bản chính
- Bộ chọn kỳ của Power phải ổn định.
- Phần tính toán D phải kiểm tra đạt.
- Giao diện D phải kiểm tra đạt.
- Power A/B/C/L cũ phải vẫn chạy bình thường.
- Bản xem thử trên Vercel phải chạy thành công.
- Chỉ đưa D vào bản chính khi tất cả các mục trên đều đạt.

## Quy tắc dữ liệu
- Chỉ kết quả chính thức mới được dùng để D tự điều chỉnh.
- Kết quả nhập tay và xem lại kỳ cũ không được dùng để học.
- D không được nhìn kết quả của kỳ đang chọn hoặc các kỳ tương lai.
- Điểm của D chỉ dùng để xếp hạng nội bộ, không phải xác suất trúng thưởng.
