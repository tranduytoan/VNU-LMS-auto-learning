import axios from "axios";
import fs from "fs";

const BASE_URL = "https://hocluatmesay.wizardsf.workers.dev/api/questions?page=";

// Hàm lấy dữ liệu 1 trang
async function getPage(page) {
  try {
    const res = await axios.get(BASE_URL + page);
    return res.data;
  } catch (err) {
    console.error("Lỗi tải trang", page, err.message);
    return null;
  }
}

async function crawlAll() {
  let allQuestions = [];
  let page = 0;

  // Lấy trang đầu tiên để biết tổng số trang
  const first = await getPage(page);
  if (!first) return;
  const totalPages = first.meta.totalPages;
  console.log("Tổng số trang:", totalPages);

  allQuestions.push(...first.questions);

  // Lặp qua các trang tiếp theo
  for (page = 1; page < totalPages; page++) {
    const data = await getPage(page);
    if (data) {
      allQuestions.push(...data.questions);
      console.log(`Đã lấy xong trang ${page}`);
    }
  }

  // Lưu ra file JSON
  fs.writeFileSync("questions.json", JSON.stringify(allQuestions, null, 2), "utf-8");
  console.log("Hoàn tất. Đã lưu vào questions.json");
}

crawlAll();
