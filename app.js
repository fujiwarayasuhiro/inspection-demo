const { useState, useMemo } = React;

function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [screen, setScreen] = useState("list");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [numericFields, setNumericFields] = useState([]);
  const [dateFields, setDateFields] = useState([]);
  const [yearMonthFields, setYearMonthFields] = useState([]);
  // 📌 編集不可（▲付き）項目を管理するStateを追加
  const [disabledFields, setDisabledFields] = useState([]);
  // 📌 各項目のフォント色（カラーコード）を保持するStateを追加
  const [headerColors, setHeaderColors] = useState({});
  const [fileName, setFileName] = useState("");
  const [selectOptions, setSelectOptions] = useState({});

  // ○×判定
  const isBool = (label) => label && label.includes("○") && label.includes("×");

  // 入力タイプ判定
  const getInputType = (headerName, value) => {
    if (yearMonthFields.includes(headerName)) return "month"; 
    if (dateFields.includes(headerName)) return "date";
    if (numericFields.includes(headerName)) return "number";
    if (!value) return "text";
    
    if (typeof value === "number" && value > 40000 && value < 50000) return "date";
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      return value.split("/").length === 2 ? "month" : "date";
    }
    
    if (typeof value === "number" || (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value))) return "number";

    return "text";
  };
  
  // 画面表示・入力欄に渡す値のフォーマット変換
  function formatDateForInput(value, isMonthType = false) {
    if (!value) return "";
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      if (isMonthType) {
        return `${y}-${m}`;
      }
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (typeof value === "string" && value.match(/^\d{4}\/\d{1,2}/)) {
      const parts = value.split("/");
      const y = parts[0];
      const m = (parts[1] || "").padStart(2, "0");
      if (isMonthType) {
        return `${y}-${m}`;
      }
      const d = (parts[2] || "01").padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return value;
  }

  // 画面で日付・年月が変更された際のデータ保存処理
  const handleDateChange = (key, rawValue, isMonthType = false) => {
    if (!rawValue) {
      updateValue(key, "");
      return;
    }
    const formatted = rawValue.replace(/-/g, "/");
    updateValue(key, formatted);
  };

  // 📌 Excelのフォントカラー構造からカラーコードを抽出するヘルパー関数
  const parseExcelColor = (colorObj) => {
    if (!colorObj) return null;
    if (colorObj.rgb) {
      // ARGB形式（例: FFFF0000）の場合は先頭のAlpha2文字をカットして #RRGGBB にする
      const rgbStr = String(colorObj.rgb);
      return rgbStr.length === 8 ? `#${rgbStr.substring(2)}` : `#${rgbStr}`;
    }
    // 標準テーマ色やインデックスカラーの一時的なマッピング（簡易フォールバック）
    if (colorObj.theme !== undefined) {
      const themes = ["#000000", "#FFFFFF", "#1F4E78", "#D9E1F2", "#5B9BD5", "#ED7D31", "#A5A5A5", "#FFC000", "#4472C4", "#70AD47"];
      return themes[colorObj.theme] || null;
    }
    return null;
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
        // スタイル情報を取得するため cellStyles: true を追加
        const wb = XLSX.read(evt.target.result, { type: "binary", cellNF: true, sheetStubs: true, cellStyles: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length === 0) return;

        const currentHeaders = rows[0] || [];
        const currentFields = rows[1] || [];
        
        setHeaders(currentHeaders);
        setFields(currentFields);

        // 選択肢一覧設定シートの読込
        const optionsSheet = wb.Sheets["選択肢一覧設定"];
        if (optionsSheet) {
          const optRows = XLSX.utils.sheet_to_json(optionsSheet);
          const optionsMap = {};
          optRows.forEach(row => {
            const fid = row["FID"];
            const optionVal = row["選択肢"];
            if (fid && optionVal) {
              if (!optionsMap[fid]) optionsMap[fid] = [];
              if (!optionsMap[fid].includes(optionVal)) optionsMap[fid].push(optionVal);
            }
          });
          setSelectOptions(optionsMap);
        }

        let numCols = [];
        let dateCols = []; 
        let ymCols = []; 
        let disCols = []; // 📌 編集不可（▲）項目リスト
        let colorsMap = {}; // 📌 フォントカラーマップ
        
        currentHeaders.forEach((h, i) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i }); // 1行目 (r: 0)
          const cell = ws[cellAddress];
          
          // 📌 1行目のセルの文字色を解析して保存
          if (cell && cell.s && cell.s.font && cell.s.font.color) {
            const parsedColor = parseExcelColor(cell.s.font.color);
            if (parsedColor) {
              colorsMap[h] = parsedColor;
            }
          }

          // 📌 ▲が含まれる項目を編集不可としてマーク
          if (h && h.includes("▲")) {
            disCols.push(h);
          }

          // 3行目のデータからデータ型書式を判定
          const dataCellAddress = XLSX.utils.encode_cell({ r: 2, c: i });
          const dataCell = ws[dataCellAddress];
          if (dataCell && dataCell.z) {
            const formatStr = String(dataCell.z).toLowerCase();
            const hasNumberFormat = formatStr.includes("0") || formatStr.includes("#");
            const isYearMonth = formatStr.includes("y") && formatStr.includes("m") && !formatStr.includes("d");
            
            if (isYearMonth) {
              ymCols.push(h);
            } else {
              const hasNumber = hasNumberFormat;
              const isNotDate = !formatStr.includes("y") && !formatStr.includes("m") && !formatStr.includes("d");
              if (hasNumber && isNotDate) numCols.push(h);

              const isRealDate = (formatStr.includes("y") || formatStr.includes("m") || formatStr.includes("d")) && !hasNumberFormat;
              if (isRealDate) {
                dateCols.push(h);
              }
            }
          }
        });
        setNumericFields(numCols);
        setDateFields(dateCols); 
        setYearMonthFields(ymCols);
        setDisabledFields(disCols); // 📌 状態を更新
        setHeaderColors(colorsMap); // 📌 状態を更新

        const data = rows.slice(2).map(row => {
          let obj = {};
          obj._isCompleted = false; 

          currentHeaders.forEach((h, i) => {
            let val = row[i] === undefined || row[i] === null ? "" : row[i];
            
            if (typeof val === "number" && val > 40000 && val < 50000 && !numCols.includes(h)) {
              const date = new Date((val - 25569) * 86400 * 1000);
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              
              if (ymCols.includes(h)) {
                val = `${y}/${m}`; 
              } else {
                const d = String(date.getDate()).padStart(2, "0");
                val = `${y}/${m}/${d}`;
              }
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

  const updateValue = (key, value) => {
    const newData = [...records];
    newData[selectedIndex][key] = value;
    setRecords(newData);
  };

  // Excel出力
  const exportExcel = () => {
    if (!window.XLSX) return;
    
    const dataRows = records.map(r => headers.map(h => r[h] === undefined || r[h] === null ? "" : r[h]));

    const ws = XLSX.utils.aoa_to_sheet([
      headers, 
      fields,
      ...dataRows 
    ]);

    Object.keys(ws).forEach(cellRef => {
      if (cellRef.startsWith("!")) return;
      const cell = ws[cellRef];
      if (cell && cell.v && typeof cell.v === "string") {
        
        if (cell.v.match(/^\d{4}\/\d{1,2}$/)) {
          const parts = cell.v.split("/");
          const year = Number(parts[0]);
          const month = Number(parts[1]);
          const dateObj = new Date(year, month - 1, 1, 12, 0, 0);
          if (!isNaN(dateObj.getTime())) {
            cell.t = "n"; 
            cell.v = Math.floor((dateObj.getTime() / (86400 * 1000)) + 25569); 
            cell.z = "yyyy/mm"; 
          }
        } 
        else if (cell.v.match(/^\d{4}\/\d{1,2}\/\d{1,2}/)) {
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
        className: `card ${rec._isCompleted ? "is-completed" : ""}`,
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
      React.createElement("div", { className: "list-screen" },
        React.createElement("div", { className: "header" }, 
          React.createElement("span", { className: "header-ver" }, "Ver.1.0.0"),
          "点検入力アプリ"
        ),
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

  const currentRecord = records[selectedIndex];

  // 詳細画面
  return (
    React.createElement("div", { className: "detail-screen" },
      React.createElement("div", { className: "sticky-header" },
        React.createElement("div", { className: "header" }, 
          React.createElement("span", { className: "header-ver" }, "Ver.1.0.0"),
          "点検詳細入力"
        ),
        React.createElement("div", { className: "action-bar" },
          React.createElement("div", { className: "action-left" },
            React.createElement("button", {
              className: "button-back",
              onClick: () => setScreen("list")
            }, "← 戻る")
          ),
          React.createElement("div", { className: "action-center" },
            `${selectedIndex + 1} ／ ${records.length}`
          ),
          React.createElement("div", { className: "action-right" },
            React.createElement("label", { className: "complete-checkbox-label" },
              React.createElement("input", {
                type: "checkbox",
                checked: !!currentRecord._isCompleted,
                onChange: (e) => updateValue("_isCompleted", e.target.checked)
              }),
              "点検完了"
            )
          )
        ),
        
        React.createElement("div", { className: "floating-card-container" },
          React.createElement("div", { 
            className: `floating-card ${currentRecord._isCompleted ? "is-completed" : ""}` 
          },
            headers.slice(0, 4).map((h, idx) =>
              React.createElement("div", { key: idx },
                String(currentRecord[h] || "")
              )
            )
          )
        )
      ),

      React.createElement("div", { className: "container" },
        headers.map((h, i) => {
          const rawValue = currentRecord[h] === undefined || currentRecord[h] === null ? "" : currentRecord[h];
          const currentFid = fields[i]; 
          
          const isHeading = h && h.includes("■");
          // 📌 当該項目が編集不可（▲付き）かどうかを判定
          const isDisabled = disabledFields.includes(h);

          // 📌 ① 見出し項目（■）かつフォント色が取得できている場合は動的スタイルを適用
          if (isHeading) {
            const customColor = headerColors[h];
            const headingStyle = customColor ? { color: customColor, borderBottomColor: customColor } : {};
            return React.createElement("div", {
              key: i,
              className: "card is-heading",
              style: headingStyle
            }, h);
          }

          const type = getInputType(h, rawValue);
          const value = (type === "date" || type === "month") ? formatDateForInput(rawValue, type === "month") : rawValue;

          const unitMatch = h && h.match(/『([^』]+)』/);
          const unitText = unitMatch ? unitMatch[1] : null;

          const isSelect = h && h.includes("▼");
          const hasOptions = currentFid && selectOptions[currentFid] && selectOptions[currentFid].length > 0;

          let inputElement;

          // 📌 ② 各種コンポーネントに disabled={isDisabled} を付与して制御
          if (isBool(h)) {
            inputElement = React.createElement("div", { className: `radio-row ${isDisabled ? "is-disabled" : ""}` },
              React.createElement("label", { className: "radio-item is-maru" },
                React.createElement("input", {
                  type: "radio",
                  name: h,
                  checked: rawValue === "○",
                  disabled: isDisabled, // 編集不可制御
                  onChange: () => updateValue(h, "○")
                }),
                React.createElement("span", null, "○")
              ),
              React.createElement("label", { className: "radio-item is-batsu" },
                React.createElement("input", {
                  type: "radio",
                  name: h,
                  checked: rawValue === "×",
                  disabled: isDisabled, // 編集不可制御
                  onChange: () => updateValue(h, "×")
                }),
                React.createElement("span", null, "×")
              )
            );
          } else if (isSelect && hasOptions) {
            inputElement = React.createElement("select", {
              className: "select-box",
              value: rawValue,
              disabled: isDisabled, // 編集不可制御
              onChange: (e) => updateValue(h, e.target.value)
            },
              React.createElement("option", { value: "" }, "-- 選択してください --"),
              selectOptions[currentFid].map((opt, idx) => 
                React.createElement("option", { key: idx, value: opt }, opt)
              )
            );
          } else {
            const inputField = React.createElement("input", {
              type: type,
              value: value,
              disabled: isDisabled, // 編集不可制御
              onChange: (e) => {
                if (type === "date" || type === "month") {
                  handleDateChange(h, e.target.value, type === "month");
                } else {
                  updateValue(h, e.target.value);
                }
              }
            });

            if (unitText) {
              inputElement = React.createElement("div", { className: "input-with-unit" },
                inputField,
                React.createElement("span", { className: "input-unit-text" }, unitText)
              );
            } else {
              inputElement = inputField;
            }
          }

          return React.createElement("div", {
            key: i,
            className: "card"
          },
            React.createElement("div", { className: "card-title" }, h),
            inputElement
          );
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root"))
  .render(React.createElement(App));
