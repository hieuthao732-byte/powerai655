# Bộ D — Tự kiểm tra và tự điều chỉnh

## Trạng thái
- Bước 1 — Bộ máy D: xong
- Bước 2 — Đưa D vào web Power: xong
- Bước 3 — Tự theo dõi và thử cách mới: xong
- Bước 4 — Khu kiểm tra riêng: xong
- Bước 5 — Kiểm tra dữ liệu khóa: xong
- Bước 6 — Kiểm tra toàn bộ và đưa lên bản chính: xong
- Bước 7 — Theo dõi nhiều kỳ bằng rolling scorecard: đang test

## 4 cách phân tích của D
- D1 — Liên kết cặp số: xem các cặp số có liên kết nổi bật hơn mức bình thường hay không.
- D2 — Nhịp xuất hiện: theo dõi khoảng cách và trạng thái xuất hiện của từng số.
- D3 — Mẫu kỳ quay: xem tổng, chẵn/lẻ, thấp/cao, độ trải và số liên tiếp.
- D4 — Mạng liên kết số: nhìn toàn bộ quan hệ giữa các số như một mạng để tìm cấu trúc yếu nhưng ổn định.
- D nhìn nhiều khoảng dữ liệu cùng lúc: 30 / 60 / 120 / 250 kỳ.
- D ưu tiên tín hiệu ổn định và luôn so với các bộ ngẫu nhiên có cùng cấu trúc.
- Mỗi kỳ D tạo 20 vé riêng, có giới hạn độ trùng và mức tập trung số.

## Cách D tự thay đổi
- D theo dõi kết quả của chính nó qua nhiều kỳ.
- Nếu kết quả yếu kéo dài, D mở tối đa 2 bản thử mới.
- Bản thử chạy âm thầm ít nhất 6 kỳ có kết quả chính thức.
- Trước khi thay bản đang dùng, bản thử phải vượt kiểm tra độ bền.
- Nếu bản thử không tốt hơn rõ ràng thì bị loại.
- Một cách phân tích yếu kéo dài có thể bị giảm ảnh hưởng hoặc tạm nghỉ.
- D nhớ những bản đã thử, bản nào tốt, bản nào thất bại và lý do đổi.
- D giữ 20 vé của mình đủ khác A/B/C/L để bổ sung vùng phủ.

## Rolling scorecard
Theo dõi 12 kỳ official gần nhất:
- số kỳ đã đủ trong cửa sổ 12;
- Best hit trung bình;
- số kỳ Best ≥3 và Best ≥4;
- chênh lệch Best của D so với matched-null;
- trạng thái WARMUP / NO EDGE DETECTED / ABOVE NULL WINDOW / CHALLENGER TEST;
- tiến độ shadow challenger nếu đang thử engine mới.

Scorecard chỉ dùng log prospective đã khóa và feed chính thức. Replay hoặc kết quả nhập tay không được tính.

## Khu kiểm tra riêng
- Kiểm tra lại từng kỳ theo đúng dữ liệu có trước kỳ đó.
- Thử bỏ bớt một số kỳ hoặc đổi nhẹ trọng số để xem kết quả có còn ổn không.
- So D với nhiều bộ ngẫu nhiên có cùng cách phân bổ số.
- Kiểm tra xem D có thực sự bổ sung vùng số/cặp mà A/B/C/L chưa phủ hay không.
- Các bài kiểm tra này chỉ dùng để đánh giá, không được ghi ngược vào lịch sử dự đoán chính thức.

## Kiểm tra dữ liệu khóa
Mỗi bộ D đã khóa trước kỳ quay sẽ lưu:
- mã phiên bản D;
- mã bộ 20 vé;
- dữ liệu được phép dùng đến kỳ nào;
- số dùng để tái tạo lại đúng bộ vé;
- cấu hình tạo vé.

Khi có kết quả chính thức, hệ thống phải dựng lại đúng bộ D đã khóa. Nếu không khớp thì kỳ đó bị đánh dấu **KHÔNG HỢP LỆ**, không được tính vào quá trình tự học của D.

## Quy tắc dữ liệu
- Chỉ kết quả chính thức từ feed mới được dùng để D tự điều chỉnh.
- Kết quả nhập tay và Replay không được dùng để học.
- D không được nhìn kết quả của kỳ đang dự đoán hoặc các kỳ tương lai.
- Điểm của D chỉ là điểm xếp hạng nội bộ, không phải xác suất trúng thưởng.
