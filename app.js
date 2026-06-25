const { useState } = React;

function App() {
const [records, setRecords] = useState([]);
const [headers, setHeaders] = useState([]);
const [fields, setFields] = useState([]);
const [screen, setScreen] = useState("list");
const [selectedIndex, setSelectedIndex] = useState(null);

// ○×判定
const isBool = (label) => label && label.includes("○") && label.includes("×");

// 入力タイプ判定（値ベース）
const getInputType = (value) => {
if (!value) return "text";

// Excel日付シリアル
if (typeof value === "number" && value > 40000 && value < 50000) {
return "date";
}

// yyyy/mm/dd または yyyy/mm
if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
return "date";
}

if (!isNaN(value) && value !== "") return "number";

return "text";
};

// エクセル用の形式（yyyy/mm/dd）から input[type="date"] 用の形式（yyyy-mm-dd）に安全に変換
function formatDateForInput(value) {
if (!value) return "";

// Excelシリアル値の場合
if (typeof value === "number") {
const date = new Date((value - 25569) * 86400 * 1000);
return date.toISOString().substring(0, 10);
}

// yyyy/mm/dd などの文字列の場合、ハイフンに置換
if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
const parts = value.split("/");
const y = parts[0];
const m = (parts[1] || "").padStart(2, "0");
      const d = (parts[2] || "").padStart(2, "0");
      const d = (parts[2] || "01").padStart(2, "0");
return `${y}-${m}-${d}`;
}

return value;
}

// input[type="date"] から値が変わった時、エクセル用の「yyyy/mm/dd」に逆変換して保存
const handleDateChange = (key, rawValue) => {
if (!rawValue) {
updateValue(key, "");
return;
}
const formatted = rawValue.replace(/-/g, "/");
updateValue(key, formatted);
};

// Excel読込
const handleUpload = (e) => {
const files = e.target.files;
if (!files || files.length === 0) return;

const file = files[0];
const reader = new FileReader();

reader.onload = (evt) => {
try {
const wb = XLSX.read(evt.target.result, { type: "binary" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

if (!rows || rows.length === 0) return;

const currentHeaders = rows[0] || [];
const currentFields = rows[1] || [];

setHeaders(currentHeaders);
setFields(currentFields);

// 3行目以降をレコードとして処理
const data = rows.slice(2).map(row => {
let obj = {};
currentHeaders.forEach((h, i) => {
let val = row[i] === undefined || row[i] === null ? "" : row[i];
// 読み込み時に日付シリアル値があれば、yyyy/mm/dd 文字列に直しておく
if (typeof val === "number" && val > 40000 && val < 50000) {
const date = new Date((val - 25569) * 86400 * 1000);
const y = date.getFullYear();
const m = String(date.getMonth() + 1).padStart(2, "0");
const d = String(date.getDate()).padStart(2, "0");
val = `${y}/${m}/${d}`;
}
obj[h] = val;
});
return obj;
});

setRecords(data);
} catch (err) {
console.error("エクセル読み込みエラー:", err);
alert("エクセルファイルの読み込みに失敗しました。ファイル構造を確認してください。");
}
};

reader.readAsBinaryString(file);
};

// 更新
const updateValue = (key, value) => {
const newData = [...records];
newData[selectedIndex][key] = value;
setRecords(newData);
};

  // Excel出力（日付フォーマットの適用）
  // ✅ 修正：時差バグを防止したExcel出力処理
const exportExcel = () => {
const rows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

const ws = XLSX.utils.aoa_to_sheet([
headers,
fields,
...rows
]);

// 日付文字列（yyyy/mm/dd）をエクセルのシリアル値＋日付書式に置換
Object.keys(ws).forEach(cellRef => {
if (cellRef.startsWith("!")) return;
const cell = ws[cellRef];

if (cell && cell.v && typeof cell.v === "string" && cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
const parts = cell.v.split("/");
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        
        // 🔹 時差（UTC）の影響を受けないように、ローカルの時刻（昼の12時）としてDateオブジェクトを作成
        const dateObj = new Date(year, month - 1, day, 12, 0, 0);

if (!isNaN(dateObj.getTime())) {
          // エクセルのシリアル基準日に合わせた変換
const excelSerial = (dateObj.getTime() / (86400 * 1000)) + 25569;
          
cell.t = "n"; 
          cell.v = excelSerial; 
          cell.v = Math.floor(excelSerial); // 🔹 小数点を切り捨てて確実に該当日に固定
cell.z = "yyyy/mm/dd"; 
}
}
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "result.xlsx");
};

// ========================
// 一覧画面
// ========================
if (screen === "list") {
return (
React.createElement("div", null,
React.createElement("div", { className: "header" }, "点検一覧"),
React.createElement("div", { className: "container" },
React.createElement("input", {
type: "file",
onChange: handleUpload
}),
records.map((rec, i) =>
React.createElement("div", {
key: i,
className: "card",
onClick: () => {
setSelectedIndex(i);
setScreen("detail");
}
},
headers.slice(0, 4).map((h, idx) =>
React.createElement("div", { key: idx },
String(rec[h] || "")
)
)
            )
          ),
            ),
records.length > 0 &&
React.createElement("button", {
className: "button",
onClick: exportExcel
}, "Excelダウンロード")
)
)
);
}

// ========================
// 詳細画面
// ========================
return (
React.createElement("div", { className: "detail-screen" },
React.createElement("div", { className: "sticky-header" },
React.createElement("div", { className: "header" }, "点検入力"),
React.createElement("div", { className: "action-bar" },
React.createElement("button", {
className: "button-back",
onClick: () => setScreen("list")
}, "← 戻る")
)
),
React.createElement("div", { className: "container" },
headers.map((h, i) => {
const rawValue = records[selectedIndex][h] === undefined || records[selectedIndex][h] === null ? "" : records[selectedIndex][h];
const type = getInputType(rawValue);
const value = type === "date" ? formatDateForInput(rawValue) : rawValue;

return React.createElement("div", {
key: i,
className: "card"
},
React.createElement("div", { className: "card-title" }, h),

// ✅ ○×
isBool(h) &&
React.createElement("div", { className: "radio-row" },
React.createElement("label", { className: "radio-item is-maru" },
React.createElement("input", {
type: "radio",
name: h,
checked: rawValue === "○",
onChange: () => updateValue(h, "○")
}),
React.createElement("span", null, "○")
),
React.createElement("label", { className: "radio-item is-batsu" },
React.createElement("input", {
type: "radio",
name: h,
checked: rawValue === "×",
onChange: () => updateValue(h, "×")
}),
React.createElement("span", null, "×")
)
),

// ✅ 入力欄
!isBool(h) &&
React.createElement("input", {
type: type,
value: value,
onChange: (e) => {
if (type === "date") {
handleDateChange(h, e.target.value);
} else {
updateValue(h, e.target.value);
}
}
})
);
})
)
)
);
}

ReactDOM.createRoot(document.getElementById("root"))
.render(React.createElement(App));
