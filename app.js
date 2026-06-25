const { useState } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  // ✅ 保護されている項目（ヘッダー名）を記憶するState
  const [protectedFields, setProtectedFields] = useState([]);

  // ○×判定
  const isBool = (label) => label.includes("○") && label.includes("×");

  // 入力タイプ判定（値ベース）
  const getInputType = (value) => {
    if (!value) return "text";

    // Excel日付シリアル
    if (typeof value === "number" && value > 40000 && value < 50000) {
      return "date";
    }

    // yyyy/mm
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      return "date";
    }

    if (!isNaN(value) && value !== "") return "number";

    return "text";
  };

  // 日付表示変換
  function formatDate(value) {
    if (!value) return "";

    // Excelシリアル
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().substring(0, 10);
    }

    // yyyy/mm
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      const parts = value.split("/");
      return `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
    }

    return value;
  }

  // Excel読込
  const handleUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const currentHeaders = rows[0] || [];
      setHeaders(currentHeaders);
      setFields(rows[1] || []);

      // ✅ セルの保護情報を読み取る
      let lockedCols = [];
      currentHeaders.forEach((h, i) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i });
        const cell = ws[cellAddress];
        
        // 書式設定で「ロック」のチェックが外されていない（＝保護対象である）項目を特定
        const isLocked = !cell || !cell.s || !cell.s.protect || cell.s.protect.locked !== false;
        
        if (isLocked) {
          lockedCols.push(h);
        }
      });
      setProtectedFields(lockedCols);

      const data = rows.slice(2).map(row => {
        let obj = {};
        currentHeaders.forEach((h, i) => obj[h] = row[i] || "");
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

  // Excel出力
  const exportExcel = () => {
    const rows = records.map(r => headers.map(h => r[h] || ""));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...rows
    ]);

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
          const value = type === "date"
            ? formatDate(rawValue)
            : rawValue;

          // ✅ この列が保護対象（編集不可）か判定
          const isReadOnly = protectedFields.includes(h);

          return React.createElement("div", {
            key: i,
            className: `card ${isReadOnly ? "is-disabled" : ""}`
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
                  name: h, // 各項目ごとにグループを分ける
                  checked: rawValue === "○",
                  disabled: isReadOnly, // 保護時は操作不可
                  onChange: () => updateValue(h, "○")
                }),
                React.createElement("span", null, "○")
              ),

              React.createElement("label", { className: "radio-item is-batsu" },
                React.createElement("input", {
                  type: "radio",
                  name: h, // 各項目ごとにグループを分ける
                  checked: rawValue === "×",
                  disabled: isReadOnly, // 保護時は操作不可
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
              disabled: isReadOnly, // 保護時は入力不可
              onChange: (e) => updateValue(h, e.target.value)
            })
          );
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
