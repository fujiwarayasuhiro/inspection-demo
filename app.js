const { useState } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  // 🔹 追加：ライブラリが読み込み中かどうかを管理する状態
  const [isLoading, setIsLoading] = useState(false);

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

  // エクセル用の形式（yyyy/mm/dd）から input[type="date"] 用の形式（yyyy-mm-dd）に変換
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

  // input[type="date"] から値が変わった時、エクセル用の「yyyy/mm/dd」に逆変換して保存
  const handleDateChange = (key, rawValue) => {
    if (!rawValue) {
      updateValue(key, "");
      return;
    }
    const formatted = rawValue.replace(/-/g, "/");
    updateValue(key, formatted);
  };

  // 🔹 修正：SheetJSライブラリをオンデマンドで動的読み込みする関数
  const loadSheetJS = () => {
    return new Promise((resolve, reject) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      const script = document.createElement("script");
      // 信頼性の高い大手CDN（cdnjs）から必要最小限の軽量版ミニマムファイルを非同期でロード
      script.src = "https://cloudflare.com";
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error("SheetJSの読み込みに失敗しました"));
      document.head.appendChild(script);
    });
  };

  // Excel読込
  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();

    setIsLoading(true); // 🔹 読み込み中アニメーションON

    try {
      // 🔹 ファイルが選択された「この瞬間」に初めて大容量ライブラリをロードする（初回起動が爆速に）
      const XLSXLib = await loadSheetJS();

      reader.onload = (evt) => {
        try {
          const wb = XLSXLib.read(evt.target.result, { type: "binary", cellNF: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSXLib.utils.sheet_to_json(ws, { header: 1 });

          if (!rows || rows.length === 0) {
            setIsLoading(false);
            return;
          }

          const currentHeaders = rows[0] || [];
          const currentFields = rows[1] || [];
          
          setHeaders(currentHeaders);
          setFields(currentFields);

          let numCols = [];
          currentHeaders.forEach((h, i) => {
            const cellAddress = XLSXLib.utils.encode_cell({ r: 2, c: i });
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
          setIsLoading(false); // 🔹 処理完了
        } catch (err) {
          console.error(err);
          alert("エクセルのデータ処理に失敗しました。");
          setIsLoading(false);
        }
      };
      reader.readAsBinaryString(file);

    } catch (err) {
      console.error(err);
      alert("ファイル解析ライブラリの準備に失敗しました。ネット環境を確認してください。");
      setIsLoading(false);
    }
  };

  // 更新
  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

  // Excel出力
  const exportExcel = async () => {
    try {
      setIsLoading(true);
      const XLSXLib = await loadSheetJS(); // 出力時にもライブラリを確認
      
      const rows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));
      const ws = XLSXLib.utils.aoa_to_sheet([headers, fields, ...rows]);

      Object.keys(ws).forEach(cellRef => {
        if (cellRef.startsWith("!")) return;
        const cell = ws[cellRef];
        if (cell && cell.v && typeof cell.v === "string" && cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
          const parts = cell.v.split("/");
          const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
          if (!isNaN(dateObj.getTime())) {
            cell.t = "n"; 
            cell.v = Math.floor((dateObj.getTime() / (86400 * 1000)) + 25569); 
            cell.z = "yyyy/mm/dd"; 
          }
        }
      });

      const wb = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSXLib.writeFile(wb, "result.xlsx");
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      alert("エクセル出力に失敗しました。");
      setIsLoading(false);
    }
  };

  // ========================
  // 一覧画面
  // ========================
  if (screen === "list") {
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "header" }, "点検一覧"),
        React.createElement("div", { className: "container" },
          // 🔹 ローディング表示
          isLoading && React.createElement("div", { className: "loading-overlay" }, "処理中..."),
          
          React.createElement("input", {
            type: "file",
            onChange: handleUpload,
            disabled: isLoading
          }),
          records.map((rec, i) =>
            React.createElement("div", {
              key: i,
              className: "card",
              onClick: () => {
                if (isLoading) return;
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
          records.length > 0 &&
          React.createElement("button", {
            className: "button",
            onClick: exportExcel,
            disabled: isLoading
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
