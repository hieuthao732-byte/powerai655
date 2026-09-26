# RC6.6.3 — Next Draw Fix

Lỗi:
RC6.6.2 chỉ lấy `latest.id + 1` từ feed chính thức để xác định “Kỳ sau”.

Ví dụ:
- feed chính thức mới đến #01402
- người dùng đã nhập thủ công kết quả #01403
- app vẫn coi #01403 là kỳ tiếp theo
- vì vậy nút “Kỳ sau” bị khóa và không cho sang #01404

Sửa:
- xác định kỳ đã hoàn tất cao nhất bằng MAX(feed latest, các log có đủ 6 số kết quả)
- kỳ prospective tiếp theo = kỳ đã hoàn tất cao nhất + 1
- nếu log #01403 đã có kết quả thì nút Kỳ sau cho phép sang #01404
- Learning cũng dùng cùng logic này, nên khi tạo L sẽ nhắm đúng kỳ tiếp theo thực sự

Không thay đổi thuật toán A/B/C/L.
