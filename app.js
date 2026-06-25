const { useState, useMemo } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  // 🔹 ファイル名を安全に保持するState
  const [fileName, setFileName] = useState("");

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value) => {
    if (numericFields.includes(headerName)) return "number";
    if (!value) return "text";
    if (typeof value === "number" && value > 40000 && value < 50000) return "date";
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) return "date";
    if (!isNaN(value) && value !== "") return "number";
    return "text";
  };

  // エクセル用の形式から input[type="date"] 用の形式に変換
  function formatDateForInput(value) {
    if (!value) return "";
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().substring(0, 10);
    }
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      const parts = value.split("/");
      const y = parts;
      const m = (parts || "").padStart(2, "0");
      const d = (parts || "01").padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return value;
  }

  // input[type="date"] から値が変わった時、エクセル用の形式に逆変換して保存
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
    
    const file = files;
    setFileName(file.name); // 🔹 選択されたファイル名を記憶
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (!window.XLSX) {
          alert("SheetJSライブラリが読み込まれていません。HTML側の記述を確認してください。");
          return;
        }
        const wb = XLSX.read(evt.target.result, { type: "binary", cellNF: true });
        const ws = wb.Sheets[wb.SheetNames];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length === 0) return;

        const currentHeaders = rows || [];
        const currentFields = rows || [];
        
        setHeaders(currentHeaders);
        setFields(currentFields);

        let numCols = [];
        currentHeaders.forEach((h, i) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 2, c: i });
          const cell = ws[cellAddress];
          if (cell && cell.z) {
            const formatStr = String(cell.z).toLowerCase();
            const hasNumberFormat = formatStr.includes("0") || formatStr.includes("#");
            const isNotDate = !formatStr.includes("y") && !formatStr.includes("m") && !formatStr.includes("d");
            if (hasNumberFormat && isNotDate) numCols.push(h);
          }
        });
        setNumericFields(numCols);

        const data = rows.slice(2).map(row => {
          let obj = {};
          currentHeaders.forEach((h, i) => {
            let val = row[i] === undefined || row[i] === null ? "" : row[i];
            if (typeof val === "number" && val > 40000 && val < 50000 && !numCols.includes(h)) {
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

  // Excel出力
  const exportExcel = () => {
    if (!window.XLSX) return;
    const rows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...rows
    ]);

    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith("!")) return;
      const cell = ws[cellRef];
      if (cell && cell.v && typeof cell.v === "string" && cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
        const parts = cell.v.split("/");
        const year = Number(parts);
        const month = Number(parts);
        const day = Number(parts);
        const dateObj = new Date(year, month - 1, day, 12, 0, 0);
        if (!isNaN(dateObj.getTime())) {
          cell.t = "n"; 
          cell.v = Math.floor((dateObj.getTime() / (86400 * 1000)) + 25569); 
          cell.z = "yyyy/mm/dd"; 
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "result.xlsx");
  };

  // 初回表示高速化のための工夫
  const renderListCards = useMemo(() => {
    return records.map((rec, i) =>
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
    );
  }, [records, headers]);

  // ========================
  // 一覧画面
  // ========================
  if (screen === "list") {
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "header" }, "点検一覧"),
        React.createElement("div", { className: "container" },
          
          // 🔹 修正：不要な赤枠ラベルを完全撤去。通常の使い慣れた file 入力欄を復活
          React.createElement("div", { className: "file-wrapper-box" },
            // 未選択時は通常のinputを表示
            !fileName && React.createElement("input", {
              type: "file",
              onChange: handleUpload
            }),
            
            // 🔹 戻るボタンで戻ってきた時、ファイル名が消えないように「偽装ボタン」を表示してファイル名を維持
            fileName && React.createElement("div", { className: "fake-file-input" },
              React.createElement("label", { className: "fake-file-button" }, 
                "ファイルを選択",
                React.createElement("input", { type: "file", onChange: handleUpload, style: { display: "none" } })
              ),
              React.createElement("span", { className: "fake-file-text" }, fileName)
            )
          ),

          renderListCards,
          
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
          const type = getInputType(h, rawValue);
          const value = type === "date" ? formatDateForInput(rawValue) : rawValue;

          return React.createElement("div", {
            key: i,
            className: "card"
          },
            React.createElement("div", { className: "card-title" }, h),
            
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
