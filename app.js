const { useState } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);

  // ○×判定
  const isBool = (label) => label.includes("○") && label.includes("×");

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

  // 🔹 修正：エクセル用の形式（yyyy/mm/dd）から input[type="date"] 用の形式（yyyy-mm-dd）に変換
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
      const m = parts[1].padStart(2, "0");
      const d = parts[2] ? parts[2].padStart(2, "0") : "01";
      return `${y}-${m}-${d}`;
    }

    return value;
  }

  // 🔹 追加：input[type="date"] から値が変わった時、エクセル用の「yyyy/mm/dd」に逆変換して保存
  const handleDateChange = (key, rawValue) => {
    if (!rawValue) {
      updateValue(key, "");
      return;
    }
    // yyyy-mm-dd -> yyyy/mm/dd
    const formatted = rawValue.replace(/-/g, "/");
    updateValue(key, formatted);
  };

  // Excel読込
  const handleUpload = (e) => {
    const file = e.target.files;
    const reader = new FileReader();

    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      setHeaders(rows || []);
      setFields(rows || []);

      const data = rows.slice(2).map(row => {
        let obj = {};
        rows.forEach((h, i) => {
          let val = row[i] || "";
          // 読み込み時に日付シリアル値があれば、一旦 yyyy/mm/dd 文字列に直して保持しておく
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
    };

    reader.readAsBinaryString(file);
  };

  // 更新
  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

  // 🔹 修正：Excel出力（日付フォーマットの適用）
  const exportExcel = () => {
    const rows = records.map(r => headers.map(h => r[h] || ""));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...rows
    ]);

    // 🔹 シート内の全セルをスキャンし、日付文字列（yyyy/mm/dd）をエクセルの「シリアル値＋日付書式」に置換
    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith("!")) return;
      const cell = ws[cellRef];
      
      if (cell && cell.v && typeof cell.v === "string" && cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
        const parts = cell.v.split("/");
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        
        // エクセルのシリアル値に計算し直す
        const excelSerial = (dateObj.getTime() / (86400 * 1000)) + 25569;
        
        cell.t = "n"; // タイプを数値(number)に変更
        cell.v = excelSerial; // 値をシリアル値に変更
        cell.z = "yyyy/mm/dd"; // 🔹 エクセル上の表示形式を固定指定
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

          // 🔹 カード（左から4列）
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
                  rec[h] || ""
                )
              )
            )
          ),

          // ダウンロード
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

      // ✅ 画面上部にスクロール固定されるヘッダーエリア
      React.createElement("div", { className: "sticky-header" },
        React.createElement("div", { className: "header" }, "点検入力"),
        React.createElement("div", { className: "action-bar" },
          React.createElement("button", {
            className: "button-back",
            onClick: () => setScreen("list")
          }, "← 戻る")
        )
      ),

      // ✅ 下部にスクロールするカードコンテンツ
      React.createElement("div", { className: "container" },

        headers.map((h, i) => {
          const rawValue = records[selectedIndex][h] || "";
          const type = getInputType(rawValue);
          
          // 🔹 変更：日付の場合は input 用フォーマット(yyyy-mm-dd)を適用
          const value = type === "date"
            ? formatDateForInput(rawValue)
            : rawValue;

          return React.createElement("div", {
            key: i,
            className: "card"
          },

            React.createElement("div", {
              className: "card-title"
            }, h),

            // ✅ ○×（完全1行固定）
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

            // ✅ 入力欄（はみ出しなし）
            !isBool(h) &&
            React.createElement("input", {
              type: type,
              value: value,
              // 🔹 変更：日付タイプの場合は専用のハンドラーでスラッシュに自動逆変換
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
