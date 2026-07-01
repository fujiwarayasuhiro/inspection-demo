const { useState, useMemo } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  const [ dateFields, setDateFields] = useState([]);
  const [fileName, setFileName] = useState("");

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value) => {
    // 💡日付書式の列なら、空欄でも最優先で date にする
    if (dateFields.includes(headerName)) return "date";
    
    // 💡修正（位置を上に移動）：数値書式の列なら、空欄であっても最優先で number にする
    if (numericFields.includes(headerName)) return "number";
    
    // 💡空欄チェックの順番を下げます
    if (!value) return "text";
    
    if (typeof value === "number" && value > 40000 && value < 50000) return "date";
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) return "date";
    
    // 完全に半角数字（またはマイナス・小数）のみの文字列の時だけ number にする
    if (typeof value === "number" || (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value))) return "number";

    return "text";
  };
  
  // ✅ 【修正】日付分解のタイポ（parts[0]など）を完全に修正
  function formatDateForInput(value) {
    if (!value) return "";
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().substring(0, 10);
    }
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      const parts = value.split("/");
      const y = parts[0];
      const m = (parts[1] || "").padStart(2, "0");
      const d = (parts[2] || "01").padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return value;
  }

  // 日付の逆変換（yyyy-mm-dd -> yyyy/mm/dd）
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
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (!window.XLSX) {
          alert("SheetJSライブラリが読み込まれていません。");
          return;
        }
        const wb = XLSX.read(evt.target.result, { type: "binary", cellNF: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length === 0) return;

        // ✅ 【修正】rows[0] と rows[1] を明示的に指定して取得
        const currentHeaders = rows[0] || [];
        const currentFields = rows[1] || [];
        
        setHeaders(currentHeaders);
        setFields(currentFields);

        // 3行目のセルから数値書式（ユーザー定義含む）を解析
        let numCols = [];
        let dateCols = []; // 💡追加
        currentHeaders.forEach((h, i) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 2, c: i });
          const cell = ws[cellAddress];
          if (cell && cell.z) {
            const formatStr = String(cell.z).toLowerCase();
            const hasNumberFormat = formatStr.includes("0") || formatStr.includes("#");
            const isNotDate = !formatStr.includes("y") && !formatStr.includes("m") && !formatStr.includes("d");
            if (hasNumberFormat && isNotDate) numCols.push(h);

            // 💡判定を厳格に修正：y, m, dを含み、かつ純粋な数値書式（0や#）を含まない場合のみ日付列とする
            const isRealDate = (formatStr.includes("y") || formatStr.includes("m") || formatStr.includes("d")) && !hasNumberFormat;
            if (isRealDate) {
              dateCols.push(h);
            }
          }
        });
        setNumericFields(numCols);
        setDateFields(dateCols); // 💡追加

        // データ行（3行目以降）を正確にマップ
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
        alert("エクセルファイルの読み込みに失敗しました。");
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

  // ✅ 【修正】Excel出力時のデータ二重化バグを完全に修正
  const exportExcel = () => {
    if (!window.XLSX) return;
    // records（オブジェクトの配列）から、純粋な値のみの2次元配列を作成
    const dataRows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      fields,
      ...dataRows // 🔹 rows ではなく、データ行だけを展開するように修正
    ]);

    // 日付セルのエクセルシリアル変換 ＆ 書式設定
    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith("!")) return;
      const cell = ws[cellRef];
      if (cell && cell.v && typeof cell.v === "string" && cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
        const parts = cell.v.split("/");
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
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

  // 高速化キャッシュ処理
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

  // 一覧画面
  if (screen === "list") {
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "header" }, "点検入力アプリ"),
        React.createElement("div", { className: "container" },
          
          React.createElement("div", { className: "file-wrapper-box" },
            !fileName && React.createElement("input", {
              type: "file",
              onChange: handleUpload
            }),
            
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

  // 詳細画面
  return (
    React.createElement("div", { className: "detail-screen" },
      React.createElement("div", { className: "sticky-header" },
        React.createElement("div", { className: "header" }, "点検詳細入力"),
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
