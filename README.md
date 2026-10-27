# game2D

Sảnh game 2D chạy thuần trên trình duyệt (HTML/CSS/JS, không cần build).

```
public/
  index.html          ← dashboard chọn game
  blockblast/         ← Block Chaos (xếp khối siêu khó với đột biến)
  brick/              ← Gạch Biến Dị (phá gạch)
  merge/              ← Số Biến Hình (ghép số)
  shared/             ← CSS giao diện chung, âm thanh, mã hồi sinh
render.yaml           ← cấu hình deploy Render (static site)
```

Khi thua, nhập mã hồi sinh trong màn "Toang rồi" để chơi tiếp
(mã chỉ được lưu dưới dạng băm trong `shared/revive.js`).

## Chạy thử trên máy

```bash
cd public && python3 -m http.server 8000
# mở http://localhost:8000
```

## Thêm game mới

1. Tạo thư mục `public/<ten-game>/` có `index.html` riêng.
2. Thêm một mục vào mảng `GAMES` trong `public/index.html` (`url: '<ten-game>/'`).

## Deploy lên Render

Push repo lên GitHub → trên Render chọn **New → Blueprint** và trỏ tới repo này.
Render sẽ đọc `render.yaml` và tạo một static site phục vụ thư mục `public/`.
