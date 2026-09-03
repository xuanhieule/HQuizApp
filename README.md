# HQuizApp
# HQuizApp

## GitHub Pages

Workflow trong `.github/workflows/deploy-pages.yml` tự quét toàn bộ file `.csv` trong thư mục `question` và tạo `question-files.json` khi deploy. Không cần duy trì file danh sách thủ công.

Để bật deploy, vào **Settings > Pages**, chọn **GitHub Actions** làm nguồn triển khai, sau đó push lên nhánh `main`. Mỗi lần thêm hoặc xóa bài thi trong `question`, push thay đổi và workflow sẽ tự cập nhật cây bài thi.
